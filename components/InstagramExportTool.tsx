'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultMediaMode, type MediaMode } from '@/lib/instagram/media-mode';
import type { ArchiveIndex, Message, SearchHit, ThreadSummary } from '@/lib/instagram/types';
import { RowOffsets, scrollToShow, windowFor } from '@/lib/instagram/virtual';
import type { WorkerRequest, WorkerResponse } from '@/lib/instagram/archive.worker';
import { Button, Card, cx } from './ui';

/**
 * The whole viewer.
 *
 * Nothing in this file sends anything anywhere. There is no fetch, no upload
 * field, no share link, and no endpoint to add one to. The archive contains
 * other people's messages — they never agreed to it being sent to a server, and
 * that is not a setting.
 *
 * The main thread does layout and paint only. Reading the zip, parsing JSON,
 * repairing encoding, merging split thread files and searching all happen in
 * archive.worker.ts.
 */

const ESTIMATED_ROW = 64;

const fmtDate = (ts: number) =>
  ts ? new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtTime = (ts: number) =>
  ts ? new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';

type Stage =
  | { kind: 'idle' }
  | { kind: 'opening'; label: string }
  | { kind: 'open' }
  | { kind: 'error'; message: string };

interface Jump {
  index: number;
  /** Set when arriving from search, so "back to results" can appear. */
  fromSearch: boolean;
}

export function InstagramExportTool() {
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [index, setIndex] = useState<ArchiveIndex | null>(null);
  const [openMs, setOpenMs] = useState(0);
  const [threadKey, setThreadKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mediaMode, setMediaMode] = useState<MediaMode>('text');
  const [mediaReason, setMediaReason] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'thread' | 'all'>('all');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searchNote, setSearchNote] = useState('');
  const [jump, setJump] = useState<Jump | null>(null);
  /**
   * Whether the results list is on screen, kept separately from the results
   * themselves. Clearing the hits on a jump is the obvious implementation and
   * it throws away exactly what "back to results" and next/previous need — so
   * going back re-ran the search, which is slower and can return a different
   * list if anything about the archive has changed underneath.
   */
  const [showResults, setShowResults] = useState(false);
  const [hitAt, setHitAt] = useState(0);

  const worker = useRef<Worker | null>(null);
  const pending = useRef<{ thread?: (m: Message[]) => void }>({});

  useEffect(() => {
    // The URL form matters: a bare string path is not traced by the bundler in
    // a static export, and the worker 404s at runtime.
    const w = new Worker(new URL('../lib/instagram/archive.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = w;
    w.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      if (data.kind === 'progress') {
        setStage({
          kind: 'opening',
          label: `${data.threadsFound} conversations · ${data.filesRead} of ${data.totalFiles} files`,
        });
      } else if (data.kind === 'index') {
        setIndex(data.index);
        setOpenMs(data.ms);
        const decision = defaultMediaMode(data.index);
        setMediaMode(decision.mode);
        setMediaReason(decision.reason);
        setStage({ kind: 'open' });
      } else if (data.kind === 'thread') {
        pending.current.thread?.(data.messages);
        pending.current.thread = undefined;
      } else if (data.kind === 'results') {
        setHits(data.hits);
        setSearchNote(
          `${data.hits.length}${data.hits.length >= 500 ? '+' : ''} of ${data.scanned.toLocaleString()} messages · ${Math.round(data.ms)} ms`,
        );
      } else if (data.kind === 'error') {
        setStage({ kind: 'error', message: data.message });
      }
    };
    w.onerror = (event) =>
      setStage({ kind: 'error', message: event.message || 'The reader failed to start.' });
    return () => {
      w.postMessage({ kind: 'close' } satisfies WorkerRequest);
      w.terminate();
    };
  }, []);

  const send = useCallback((request: WorkerRequest) => worker.current?.postMessage(request), []);

  const openFile = useCallback(
    (file: File) => {
      setIndex(null);
      setThreadKey(null);
      setMessages([]);
      setHits(null);
      setQuery('');
      setStage({ kind: 'opening', label: 'reading the archive index…' });
      send({ kind: 'open', file });
    },
    [send],
  );

  const openThread = useCallback(
    (key: string, jumpTo: Jump | null) => {
      setThreadKey(key);
      setJump(jumpTo);
      pending.current.thread = (m) => setMessages(m);
      send({ kind: 'thread', key });
    },
    [send],
  );

  const runSearch = useCallback(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      setSearchNote(q.length ? 'Type at least two characters.' : '');
      return;
    }
    setSearchNote('searching…');
    setHitAt(0);
    setShowResults(true);
    send({ kind: 'search', query: q, scope, key: threadKey ?? undefined });
  }, [query, scope, threadKey, send]);

  const thread = index?.threads.find((t) => t.key === threadKey) ?? null;

  return (
    <>
      <Card>
        <h2 className="text-base font-semibold">Open your export</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Pick the zip Instagram sent you. It is read in this page — no part of it is uploaded, and
          there is nowhere for it to be uploaded to. Your conversations contain other people&rsquo;s
          messages, and they did not agree to those being sent anywhere.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="glass-input flex min-h-12 cursor-pointer items-center gap-3 p-3 text-sm">
            <input
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) openFile(file);
              }}
            />
            <span className="font-medium">Choose the .zip</span>
          </label>

          {/* The fallback. Someone who already extracted the archive — or who
              downloaded it in parts — has a folder, not a zip, and telling them
              to re-zip it is telling them to do the tool's job. */}
          <label className="glass-input flex min-h-12 cursor-pointer items-center gap-3 p-3 text-sm">
            <input
              type="file"
              multiple
              className="sr-only"
              // Non-standard but the only way to pick a directory; unsupported
              // browsers get a plain multi-file picker, which also works.
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                if (files.length) openFolder(files, send, setStage);
              }}
            />
            <span className="font-medium">…or the extracted folder</span>
          </label>
        </div>

        <p className="mt-3 min-h-10 font-mono text-xs text-muted-foreground" data-status>
          {stage.kind === 'idle' && 'Nothing loaded.'}
          {stage.kind === 'opening' && stage.label}
          {stage.kind === 'error' && stage.message}
          {stage.kind === 'open' &&
            index &&
            (index.problem
              ? problemText(index)
              : `${index.threads.length} conversations · ${index.totalMessages.toLocaleString()} messages · opened in ${Math.round(openMs)} ms`)}
        </p>
      </Card>

      {/* The reading area exists from the moment a file is chosen, not from the
          moment it finishes opening. Rendering it on `index` alone measured
          0.1049 CLS: an archive takes a second or two to read, which is well
          outside the 500 ms window in which a shift is excused as a
          consequence of input, so the card arriving pushed the whole page
          down and it counted. Now it appears immediately, at its final size,
          and fills in. */}
      {(stage.kind === 'opening' || (index && !index.problem)) && (
        <Card className="min-w-0">
          <SearchBar
            query={query}
            setQuery={setQuery}
            scope={scope}
            setScope={setScope}
            hasThread={Boolean(threadKey)}
            note={searchNote}
            onSubmit={runSearch}
            onClear={() => {
              setQuery('');
              setHits(null);
              setShowResults(false);
              setSearchNote('');
            }}
          />

          <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <ThreadList
              threads={index?.threads ?? []}
              selected={threadKey}
              onSelect={(key) => openThread(key, null)}
              className={cx((threadKey || showResults) && 'hidden lg:block')}
            />

            {/* On a phone these two share the space rather than stacking: the
                list is 34rem and so is the reading column, so showing both
                and then hiding one shrank the page by 34rem — measured as
                0.0265 CLS on top of everything below it. One at a time on
                mobile, side by side from lg. */}
            <div
              className={cx(
                'flex h-[34rem] min-w-0 flex-col',
                !threadKey && !showResults && 'hidden lg:flex',
              )}
            >
              {showResults && hits ? (
                <Results
                  hits={hits}
                  onJump={(hit, at) => {
                    setHitAt(at);
                    setShowResults(false);
                    openThread(hit.threadKey, { index: hit.i, fromSearch: true });
                  }}
                />
              ) : thread ? (
                <ThreadView
                  key={thread.key}
                  thread={thread}
                  messages={messages}
                  mediaMode={mediaMode}
                  mediaReason={mediaReason}
                  onMediaMode={setMediaMode}
                  jump={jump}
                  onBack={() => {
                    setThreadKey(null);
                    setMessages([]);
                    setJump(null);
                  }}
                  onBackToResults={jump?.fromSearch && hits ? () => setShowResults(true) : undefined}
                  hitPosition={jump?.fromSearch && hits ? { at: hitAt, of: hits.length } : undefined}
                  onStep={(delta) => {
                    if (!hits) return;
                    const next = hitAt + delta;
                    if (next < 0 || next >= hits.length) return;
                    setHitAt(next);
                    openThread(hits[next].threadKey, { index: hits[next].i, fromSearch: true });
                  }}
                  send={send}
                  workerRef={worker}
                />
              ) : (
                <p className="min-h-0 flex-1 p-6 text-sm text-muted-foreground">
                  {index
                    ? 'Pick a conversation. Ones split across several message files are marked — they are merged back into a single timeline here.'
                    : 'Reading the archive…'}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

function problemText(index: ArchiveIndex): string {
  if (index.problem?.kind === 'html-export') {
    return 'This is the HTML version of the export. Request the export again and choose JSON — the HTML one has no machine-readable messages in it.';
  }
  const folders = index.problem?.folders ?? [];
  return `No message files in this archive. It contains: ${folders.join(', ') || 'nothing recognisable'}.`;
}

/**
 * The extracted-folder fallback.
 *
 * Every other guide tells people to unzip the export first, so a good number of
 * them arrive holding a folder. A folder pick hands over the files already
 * decompressed — the message JSON is read straight off them and attachments
 * resolve from the same list, so nothing downstream changes. If the folder
 * happens to contain the zip itself, that is read instead.
 */
function openFolder(files: File[], send: (r: WorkerRequest) => void, setStage: (s: Stage) => void) {
  const zip = files.find((f) => f.name.toLowerCase().endsWith('.zip'));
  setStage({ kind: 'opening', label: `reading ${files.length.toLocaleString()} files…` });
  if (zip) return void send({ kind: 'open', file: zip });
  send({ kind: 'openFiles', files });
}

function SearchBar({
  query,
  setQuery,
  scope,
  setScope,
  hasThread,
  note,
  onSubmit,
  onClear,
}: {
  query: string;
  setQuery: (q: string) => void;
  scope: 'thread' | 'all';
  setScope: (s: 'thread' | 'all') => void;
  hasThread: boolean;
  note: string;
  onSubmit: () => void;
  onClear: () => void;
}) {
  return (
    <div className="min-w-0">
      <form
        className="flex min-w-0 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder="Search messages"
          aria-label="Search messages"
          className="glass-input min-h-12 min-w-0 flex-1 p-3 text-base outline-none placeholder:text-muted-foreground/60"
        />
        <Button type="submit" className="min-h-12 shrink-0 px-4 text-sm">
          Search
        </Button>
      </form>
      {/* Two fixed rows, never one wrapping row. The scope buttons and the note
          shared a flex-wrap line, and enabling "This conversation" was enough
          to push the note onto a second line — 44px of growth above the
          conversation, measured as 0.0265 CLS. A row that can wrap is a row
          that will. */}
      <div className="mt-2 flex min-w-0 items-center gap-2">
        <div className="flex shrink-0 gap-1" role="group" aria-label="Search scope">
          {(['all', 'thread'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              disabled={s === 'thread' && !hasThread}
              className={cx(
                'min-h-9 rounded-full border px-3 text-xs font-medium disabled:opacity-40',
                scope === s ? 'border-accent/25 bg-accent-soft text-accent' : 'border-border text-muted-foreground',
              )}
            >
              {s === 'all' ? 'All conversations' : 'This conversation'}
            </button>
          ))}
        </div>
        {/* Fixed height whether or not there is a note: an appearing line is a
            layout shift under everything below it. */}
        <span className="min-w-0 flex-1" />
        {/* Always rendered, so its arrival is not a layout change; invisible
            rather than absent when there is nothing to clear. */}
        <button
          type="button"
          onClick={onClear}
          className={cx('min-h-9 shrink-0 px-2 text-xs underline', !query && 'invisible')}
        >
          Clear
        </button>
      </div>
      <p data-note className="h-9 min-w-0 truncate py-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function ThreadList({
  threads,
  selected,
  onSelect,
  className,
}: {
  threads: ThreadSummary[];
  selected: string | null;
  onSelect: (key: string) => void;
  className?: string;
}) {
  return (
    // Fixed height, not max-height: a list that grows from empty to 199 rows
    // is a layout change under everything after it.
    <ul data-threads className={cx('h-[34rem] min-w-0 overflow-y-auto', className)}>
      {threads.map((t) => (
        <li key={t.key} className="min-w-0">
          <button
            type="button"
            onClick={() => onSelect(t.key)}
            data-count={t.messageCount}
            data-media={t.mediaCount}
            className={cx(
              'flex min-h-14 w-full min-w-0 flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left',
              selected === t.key ? 'bg-accent-soft' : 'hover:bg-surface-muted',
            )}
          >
            <span className="w-full min-w-0 truncate text-sm font-medium">{t.title}</span>
            <span className="w-full min-w-0 truncate text-xs text-muted-foreground tabular-nums">
              {t.messageCount.toLocaleString()} messages
              {t.mediaCount > 0 && ` · ${t.mediaCount.toLocaleString()} attachments`}
              {t.fileCount > 1 && ` · merged from ${t.fileCount} files`}
              {t.lastTs > 0 && ` · ${fmtDate(t.lastTs)}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Results({ hits, onJump }: { hits: SearchHit[]; onJump: (h: SearchHit, at: number) => void }) {
  if (hits.length === 0) {
    return <p className="min-h-0 flex-1 p-6 text-sm text-muted-foreground">No messages contain that.</p>;
  }
  return (
    <ul data-results className="min-h-0 flex-1 overflow-y-auto">
      {hits.map((hit, at) => (
        <li key={`${hit.threadKey}:${hit.i}`} className="min-w-0">
          <button
            type="button"
            onClick={() => onJump(hit, at)}
            data-hit-i={hit.i}
            className="w-full min-w-0 rounded-lg px-3 py-2 text-left hover:bg-surface-muted"
          >
            <span className="flex min-w-0 justify-between gap-2 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">{hit.threadTitle}</span>
              <span className="shrink-0 tabular-nums">{fmtDate(hit.ts)}</span>
            </span>
            <span className="mt-0.5 block min-w-0 truncate text-sm">
              <span className="text-muted-foreground">{hit.sender}: </span>
              {hit.text}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ThreadView({
  thread,
  messages,
  mediaMode,
  mediaReason,
  onMediaMode,
  jump,
  onBack,
  onBackToResults,
  hitPosition,
  onStep,
  send,
  workerRef,
}: {
  thread: ThreadSummary;
  messages: Message[];
  mediaMode: MediaMode;
  mediaReason: string;
  onMediaMode: (m: MediaMode) => void;
  jump: Jump | null;
  onBack: () => void;
  onBackToResults?: () => void;
  /** Where this message sits in the result list, when arriving from search. */
  hitPosition?: { at: number; of: number };
  onStep?: (delta: number) => void;
  send: (r: WorkerRequest) => void;
  workerRef: React.RefObject<Worker | null>;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const offsets = useMemo(() => new RowOffsets(messages.length, ESTIMATED_ROW), [messages]);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [total, setTotal] = useState(0);
  const [highlight, setHighlight] = useState<number | null>(null);

  const recompute = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setRange(windowFor(offsets, el.scrollTop, el.clientHeight));
    setTotal(offsets.total());
  }, [offsets]);

  useEffect(() => {
    setTotal(offsets.total());
    recompute();
  }, [offsets, recompute]);

  // The jump. Runs after the offsets exist for this thread's messages.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !jump || messages.length === 0) return;
    el.scrollTop = scrollToShow(offsets, jump.index, el.clientHeight);
    setHighlight(jump.index);
    recompute();
  }, [jump, messages, offsets, recompute]);

  /**
   * A measured row moves everything after it. If the row is above the viewport,
   * the correction has to be applied to scrollTop in the same frame or the
   * content under the reader's finger jumps — which is the failure that makes
   * hand-rolled virtual lists feel broken.
   */
  const measure = useCallback(
    (i: number, height: number) => {
      const el = scroller.current;
      if (!el) return;
      const before = offsets.offset(i);
      const delta = offsets.set(i, height);
      if (delta !== 0 && before < el.scrollTop) el.scrollTop += delta;
      if (delta !== 0) setTotal(offsets.total());
    },
    [offsets],
  );

  const visible = messages.slice(range.start, range.end);

  return (
    <div className="flex min-h-0 flex-1 min-w-0 flex-col">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={onBack}
          data-back-all
          className="min-h-9 px-2 text-xs underline lg:hidden"
        >
          All conversations
        </button>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{thread.title}</h3>
        {onBackToResults && (
          <button type="button" onClick={onBackToResults} className="min-h-9 px-2 text-xs underline">
            Back to results
          </button>
        )}
        {hitPosition && onStep && (
          // Stepping through matches without going back to the list, which is
          // how you read around a result rather than at it.
          <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums">
            <button
              type="button"
              onClick={() => onStep(-1)}
              disabled={hitPosition.at === 0}
              aria-label="Previous match"
              className="min-h-9 min-w-9 rounded-full border border-border disabled:opacity-40"
            >
              ‹
            </button>
            {/* Fixed width: 9 of 47 and 10 of 47 are different lengths, and a
                header that resizes moves the whole conversation under it. */}
            <span className="inline-block min-w-[5.5rem] text-center text-muted-foreground">
              {hitPosition.at + 1} of {hitPosition.of}
            </span>
            <button
              type="button"
              onClick={() => onStep(1)}
              disabled={hitPosition.at + 1 >= hitPosition.of}
              aria-label="Next match"
              className="min-h-9 min-w-9 rounded-full border border-border disabled:opacity-40"
            >
              ›
            </button>
          </span>
        )}
        <div className="flex shrink-0 gap-1" role="group" aria-label="Media">
          {(['text', 'media'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMediaMode(m)}
              className={cx(
                'min-h-9 rounded-full border px-3 text-xs font-medium',
                mediaMode === m
                  ? 'border-accent/25 bg-accent-soft text-accent'
                  : 'border-border text-muted-foreground',
              )}
            >
              {m === 'text' ? 'Text only' : 'Show media'}
            </button>
          ))}
        </div>
      </div>
      <p className="min-h-8 py-1.5 text-xs text-muted-foreground">{mediaReason}</p>

      <div
        ref={scroller}
        onScroll={recompute}
        data-scroller
        data-rows={visible.length}
        data-messages={messages.length}
        className="min-h-0 flex-1 min-w-0 overflow-y-auto overscroll-contain"
      >
        {/* One spacer of the full height, rows positioned inside it. The
            container's scrollbar therefore reflects the whole thread even
            though a few dozen rows exist in the DOM. */}
        <div style={{ height: total, position: 'relative' }}>
          {visible.map((message, n) => {
            const i = range.start + n;
            return (
              <Row
                key={i}
                index={i}
                message={message}
                top={offsets.offset(i)}
                highlighted={highlight === i}
                mediaMode={mediaMode}
                onMeasure={(h) => measure(i, h)}
                send={send}
                workerRef={workerRef}
              />
            );
          })}
        </div>
      </div>
      <p className="min-h-8 py-1.5 text-xs text-muted-foreground tabular-nums">
        {messages.length.toLocaleString()} messages
        {thread.fileCount > 1 && ` · merged from ${thread.fileCount} files`} · {visible.length} in
        the page
      </p>
    </div>
  );
}

function Row({
  index,
  message,
  top,
  highlighted,
  mediaMode,
  onMeasure,
  send,
  workerRef,
}: {
  index: number;
  message: Message;
  top: number;
  highlighted: boolean;
  mediaMode: MediaMode;
  onMeasure: (height: number) => void;
  send: (r: WorkerRequest) => void;
  workerRef: React.RefObject<Worker | null>;
}) {
  const el = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (el.current) onMeasure(el.current.offsetHeight);
  });

  return (
    <div
      ref={el}
      style={{ position: 'absolute', top, left: 0, right: 0 }}
      // The index is on the element because the jump has to be checkable from
      // outside: "a row is highlighted" is not the same claim as "the row that
      // was searched for is highlighted", and only the second one is the feature.
      data-i={index}
      data-highlighted={highlighted ? 'true' : undefined}
      className={cx('min-w-0 px-1 py-1.5', highlighted && 'rounded-lg bg-accent-soft')}
    >
      <p className="min-w-0 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{message.sender || 'Unknown'}</span>
        {message.ts > 0 && ` · ${fmtDate(message.ts)} ${fmtTime(message.ts)}`}
      </p>
      {message.kind === 'text' || message.kind === 'share' ? (
        <p className="mt-0.5 min-w-0 break-words text-sm">{message.text}</p>
      ) : message.uri && mediaMode === 'media' ? (
        <Attachment uri={message.uri} label={message.label ?? 'Attachment'} send={send} workerRef={workerRef} />
      ) : (
        // Text-only, or a kind with nothing to render. The record survives
        // either way: a message that happened must never leave a blank.
        <p className="mt-0.5 text-sm text-muted-foreground">{message.label ?? 'Message'}</p>
      )}
      {message.reactions && message.reactions.length > 0 && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {message.reactions.map((r) => r.reaction).join(' ')}
        </p>
      )}
    </div>
  );
}

/**
 * One attachment, resolved on demand.
 *
 * The zip entry is decompressed only when the row is on screen, and the blob
 * URL is revoked when the row leaves. Holding them costs real memory — a blob
 * URL keeps its blob alive for the lifetime of the document, so a scroll
 * through a photo thread without revoking is a leak that survives until the tab
 * closes.
 */
function Attachment({
  uri,
  label,
  send,
  workerRef,
}: {
  uri: string;
  label: string;
  send: (r: WorkerRequest) => void;
  workerRef: React.RefObject<Worker | null>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    const w = workerRef.current;
    if (!w) return;

    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      if (data.kind !== 'media' || data.uri !== uri) return;
      w.removeEventListener('message', onMessage);
      if (cancelled) return;
      if (!data.blob) return void setMissing(true);
      objectUrl = URL.createObjectURL(data.blob);
      setUrl(objectUrl);
    };
    w.addEventListener('message', onMessage);
    send({ kind: 'media', uri });

    return () => {
      cancelled = true;
      w.removeEventListener('message', onMessage);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uri, send, workerRef]);

  const video = /\.(mp4|mov)$/i.test(uri);

  // The box is the same size before and after the bytes arrive, so a photo
  // loading does not push the rest of the thread down.
  return (
    <div className="mt-1 h-40 w-40 overflow-hidden rounded-lg bg-surface-muted">
      {missing ? (
        <p className="p-2 text-xs text-muted-foreground">{label} — not in this archive</p>
      ) : url ? (
        video ? (
          <video src={url} controls className="h-40 w-40 object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-40 w-40 object-cover" loading="lazy" />
        )
      ) : (
        <p className="p-2 text-xs text-muted-foreground">{label}</p>
      )}
    </div>
  );
}
