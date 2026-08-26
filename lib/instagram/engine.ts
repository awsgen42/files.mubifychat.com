/**
 * Everything expensive: reading the zip, parsing JSON, repairing encoding,
 * merging split threads, searching.
 *
 * A 2 GB archive is never held in memory — zip.js reads the central directory
 * and decompresses entries on demand. The scan is deliberately lazy: it reads
 * message JSON only, and counts the media from the central directory without a
 * byte being decompressed, which is also where the media-volume figure for the
 * media default comes from, for free, before anything renders.
 *
 * Nothing here touches `self`, a worker global, or the DOM. It is a plain
 * module that takes a function to send responses to, which is what makes
 * "does this actually need a worker?" a question that can be answered by
 * measurement rather than asserted — perf/controls.mjs runs this same engine on
 * the main thread and counts what it does to frame times.
 */
import { BlobReader, BlobWriter, TextWriter, ZipReader, type Entry } from '@zip.js/zip.js';
import { mergeThread, parseThreadFile, searchableText, type ParsedFile } from './parse';
import {
  HTML_EXPORT_HINT,
  KNOWN_TOP_LEVEL,
  MEDIA_EXTENSION,
  MESSAGE_FILE,
  MESSAGE_MEDIA,
  threadKeyFor,
} from './schema';
import type { ArchiveIndex, Message, SearchHit, ThreadSummary } from './types';

/**
 * zip.js types Entry as a union, and only the file half carries getData. The
 * scan skips directories anyway, so narrowing once here keeps every call site
 * from re-checking.
 */
type FileEntry = Extract<Entry, { getData: unknown }>;
const isFile = (entry: Entry): entry is FileEntry => !entry.directory;

export type WorkerRequest =
  | { kind: 'open'; file: File }
  | { kind: 'openFiles'; files: File[] }
  | { kind: 'thread'; key: string }
  | { kind: 'media'; uri: string }
  | { kind: 'search'; query: string; scope: 'all' | 'thread'; key?: string }
  | { kind: 'close' };

export type WorkerResponse =
  | { kind: 'progress'; threadsFound: number; filesRead: number; totalFiles: number }
  | { kind: 'index'; index: ArchiveIndex; ms: number }
  | { kind: 'thread'; key: string; messages: Message[]; ms: number }
  | { kind: 'media'; uri: string; blob: Blob | null }
  | { kind: 'results'; hits: SearchHit[]; scanned: number; ms: number }
  | { kind: 'error'; message: string };

/** Sends a response back to whoever is driving the engine. */
export type Post = (response: WorkerResponse) => void;

export function createEngine(post: Post) {
  let reader: ZipReader<unknown> | null = null;
  let entries: Entry[] = [];
  /**
   * One source of bytes, so the zip path and the extracted-folder path share
   * everything downstream. A zip entry and a File both answer "give me the text"
   * and "give me a blob"; nothing after this point needs to know which it has.
   */
  interface Source {
    name: string;
    size: number;
    text(): Promise<string>;
    blob(): Promise<Blob | null>;
  }

  const fromEntry = (entry: FileEntry): Source => ({
    name: entry.filename,
    size: entry.uncompressedSize ?? 0,
    text: async () => (await entry.getData(new TextWriter())) ?? '',
    blob: async () => ((await entry.getData(new BlobWriter())) as Blob | null) ?? null,
  });

  const fromFile = (file: File, path: string): Source => ({
    name: path,
    size: file.size,
    text: () => file.text(),
    blob: async () => file,
  });

  /** Thread key -> its message files, in name order. */
  let threadFiles = new Map<string, Source[]>();
  /** Parsed threads, kept so search and re-opening do not re-read the zip. */
  const parsed = new Map<string, ParsedFile>();
  let mediaEntries = new Map<string, Source>();

  async function open(file: File) {
    reader = new ZipReader(new BlobReader(file));
    entries = await reader.getEntries();
    await scan(entries.filter(isFile).map(fromEntry), performance.now());
  }

  /**
   * The extracted-folder path.
   *
   * Someone who has already unzipped the export — or who was told to, by every
   * other guide — has a folder. `webkitRelativePath` carries the path inside it,
   * which is the same string the zip entries use once the top-level folder is
   * dropped, so the rest of the scan is unchanged.
   */
  async function openFiles(files: File[]) {
    const started = performance.now();
    const sources = files.map((file) => {
      const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      // Drop the chosen directory's own name so paths line up with a zip's.
      const trimmed = path.includes('/') ? path.slice(path.indexOf('/') + 1) : path;
      return fromFile(file, trimmed);
    });
    await scan(sources, started);
  }

  async function scan(sources: Source[], started: number) {
    threadFiles = new Map();
    mediaEntries = new Map();
    parsed.clear();

    let mediaBytes = 0;
    let mediaCount = 0;
    for (const source of sources) {
      if (MESSAGE_FILE.test(source.name)) {
        const key = threadKeyFor(source.name);
        const list = threadFiles.get(key) ?? [];
        list.push(source);
        threadFiles.set(key, list);
      } else if (MEDIA_EXTENSION.test(source.name)) {
        // Indexed by path so a message's uri resolves, but only the attachments
        // inside a conversation count towards the media default — posts, stories
        // and profile media are in the same archive and never render here.
        mediaEntries.set(source.name, source);
        if (MESSAGE_MEDIA.test(source.name)) {
          // From the central directory: nothing is decompressed.
          mediaBytes += source.size;
          mediaCount += 1;
        }
      }
    }

    if (threadFiles.size === 0) {
      const folders = [
        ...new Set(sources.map((s) => s.name.split('/')[0]).filter(Boolean)),
      ].slice(0, 12);
      const html = sources.some((s) => HTML_EXPORT_HINT.test(s.name));
      post({
        kind: 'index',
        ms: performance.now() - started,
        index: {
          threads: [],
          mediaBytes,
          mediaCount,
          ownerGuess: '',
          senders: [],
          totalMessages: 0,
          problem: {
            kind: html ? 'html-export' : 'no-messages',
            folders: folders.filter((f) => KNOWN_TOP_LEVEL.includes(f) || folders.length < 12),
          },
        },
      });
      return;
    }

    const totalFiles = [...threadFiles.values()].reduce((n, list) => n + list.length, 0);
    const summaries: ThreadSummary[] = [];
    const senderThreadCounts = new Map<string, number>();
    let filesRead = 0;
    let totalMessages = 0;

    for (const [key, list] of threadFiles) {
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const files: ParsedFile[] = [];
      for (const entry of list) {
        try {
          files.push(parseThreadFile(JSON.parse(await entry.text())));
        } catch {
          // A single unreadable file must not lose the rest of the conversation.
          files.push({ participants: [], title: '', messages: [] });
        }
        filesRead += 1;
        if (filesRead % 25 === 0) {
          post({ kind: 'progress', threadsFound: summaries.length, filesRead, totalFiles });
        }
      }

      const merged = mergeThread(files);
      parsed.set(key, merged);
      totalMessages += merged.messages.length;

      for (const sender of new Set(merged.messages.map((m) => m.sender).filter(Boolean))) {
        senderThreadCounts.set(sender, (senderThreadCounts.get(sender) ?? 0) + 1);
      }

      summaries.push({
        key,
        title: merged.title,
        participants: merged.participants,
        messageCount: merged.messages.length,
        lastTs: merged.messages.length ? merged.messages[merged.messages.length - 1].ts : 0,
        fileCount: list.length,
        mediaCount: merged.messages.filter((m) => m.uri).length,
      });
    }

    summaries.sort((a, b) => b.lastTs - a.lastTs);
    const senders = [...senderThreadCounts.entries()].sort((a, b) => b[1] - a[1]);

    post({
      kind: 'index',
      ms: performance.now() - started,
      index: {
        threads: summaries,
        mediaBytes,
        mediaCount,
        // The account owner is the person present in the most conversations.
        ownerGuess: senders[0]?.[0] ?? '',
        senders: senders.map(([name]) => name),
        totalMessages,
      },
    });
  }

  return async function handle(request: WorkerRequest): Promise<void> {
    try {
      if (request.kind === 'open') return void (await open(request.file));
      if (request.kind === 'openFiles') return void (await openFiles(request.files));

      if (request.kind === 'thread') {
        const started = performance.now();
        const thread = parsed.get(request.key);
        post({
          kind: 'thread',
          key: request.key,
          messages: thread?.messages ?? [],
          ms: performance.now() - started,
        });
        return;
      }

      if (request.kind === 'media') {
        // A message's uri is written relative to the export root, but the entry
        // may be nested under a top-level folder, so fall back to a suffix match
        // rather than showing a missing attachment for a file that is present.
        const entry =
          mediaEntries.get(request.uri) ??
          [...mediaEntries.entries()].find(([name]) => name.endsWith(request.uri))?.[1];
        if (!entry) return void post({ kind: 'media', uri: request.uri, blob: null });
        post({ kind: 'media', uri: request.uri, blob: await entry.blob() });
        return;
      }

      if (request.kind === 'search') {
        const started = performance.now();
        const needle = request.query.toLowerCase();
        const hits: SearchHit[] = [];
        let scanned = 0;
        const scope =
          request.scope === 'thread' && request.key
            ? [[request.key, parsed.get(request.key)] as const].filter(([, t]) => t)
            : [...parsed.entries()];
        for (const [key, thread] of scope) {
          if (!thread) continue;
          for (const message of thread.messages) {
            const text = searchableText(message);
            scanned += 1;
            if (!text || !text.toLowerCase().includes(needle)) continue;
            hits.push({
              threadKey: key,
              threadTitle: thread.title,
              i: message.i,
              ts: message.ts,
              sender: message.sender,
              text,
            });
            if (hits.length >= 500) break;
          }
          if (hits.length >= 500) break;
        }
        post({ kind: 'results', hits, scanned, ms: performance.now() - started });
        return;
      }

      if (request.kind === 'close') {
        await reader?.close();
        reader = null;
        entries = [];
        threadFiles = new Map();
        mediaEntries = new Map();
        parsed.clear();
      }
    } catch (error) {
      post({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };
}
