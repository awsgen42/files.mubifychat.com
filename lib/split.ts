'use client';

/**
 * Splitting a file into parts, and joining them back.
 *
 * The premise is File.slice(): a Blob range is a view onto bytes on disk, not
 * a copy in memory, so a 20 GB file can be cut into parts on a laptop that
 * could never hold it. Every online splitter uploads first, which is why every
 * online splitter has a size cap. This one has none.
 *
 * Parts are raw byte ranges with no header of any kind. That is a deliberate
 * constraint rather than a simplification: it means `cat file.* > file` and
 * `copy /b` reassemble them without this tool, so nobody is locked into a
 * website to get their own data back.
 */

import { MANIFEST_SUFFIX, buildManifest, manifestName } from './manifest';
import { Sha256 } from './sha256';

/** Read granularity when copying bytes through a stream. */
const CHUNK_BYTES = 8 * 1024 * 1024;

/** Part sizes people actually hit, rather than round numbers. */
export const PART_PRESETS = [
  { bytes: 25 * 1024 * 1024, label: '25 MB', note: 'email attachment' },
  { bytes: 100 * 1024 * 1024, label: '100 MB', note: 'common upload cap' },
  { bytes: 700 * 1024 * 1024, label: '700 MB', note: 'CD / chunked transfer' },
  { bytes: 2 * 1024 * 1024 * 1024 - 1, label: '2 GB', note: 'FAT32 file limit' },
] as const;

export interface PartRange {
  index: number;
  start: number;
  end: number;
}

export function partCount(totalBytes: number, partBytes: number): number {
  if (totalBytes <= 0 || partBytes <= 0) return 0;
  return Math.ceil(totalBytes / partBytes);
}

export function partRanges(totalBytes: number, partBytes: number): PartRange[] {
  const ranges: PartRange[] = [];
  for (let index = 1, start = 0; start < totalBytes; index++, start += partBytes) {
    ranges.push({ index, start, end: Math.min(start + partBytes, totalBytes) });
  }
  return ranges;
}

/**
 * `<original>.001`, the HJSplit and 7-Zip convention.
 *
 * Three digits because that is what those tools write and what every joiner
 * expects; beyond 999 parts it widens rather than wrapping, since a name that
 * collides is worse than one that is unusual.
 */
export function partName(baseName: string, index: number): string {
  return `${baseName}.${String(index).padStart(3, '0')}`;
}

export interface ParsedPart {
  base: string;
  index: number;
}

/** Splits `holiday.mp4.007` into its original name and its number. */
export function parsePartName(name: string): ParsedPart | null {
  const match = /^(.*)\.(\d{2,})$/.exec(name);
  if (!match) return null;
  const index = Number(match[2]);
  return Number.isInteger(index) && match[1] !== '' ? { base: match[1], index } : null;
}

/**
 * The name to save a join as: the parts' shared name without the number.
 * The user can override it; this is the sensible default rather than a rule.
 */
export function outputNameFor(names: readonly string[]): string {
  for (const name of names) {
    const parsed = parsePartName(name);
    if (parsed) return parsed.base;
  }
  return 'joined-file';
}

/* ------------------------------------------------------------------ */
/* Raw byte split, or a structured archive?                            */
/* ------------------------------------------------------------------ */

/**
 * The question behind "how do I open a .001 file", which no article answers
 * because answering it requires looking at the bytes.
 *
 * The rule usually proposed — an archive signature at the start of part 001
 * means the parts are a structured archive and must not be joined raw — is
 * wrong, and wrong in the most common direction. Splitting a .zip is the
 * ordinary case for this tool, and the first part of a raw split of a .zip
 * begins with `PK\x03\x04` because the *file* begins with it. Refusing that
 * would refuse the join that works.
 *
 * What actually separates the two is whether the signature repeats. A raw byte
 * split puts the header in part 001 and nowhere else; every subsequent part
 * starts mid-stream. A genuine multi-volume archive — RAR's .partN.rar, ZIP's
 * .z01 — is a sequence of independently framed volumes, so *every* volume
 * carries a header, and concatenating them produces garbage no matter what
 * order they are in. So the test is on the first two parts together.
 *
 * Checked against both real cases in the tests, including the one that matters:
 * a raw split of a ZIP is reported as joinable.
 */
export type SplitKind =
  | { kind: 'raw'; container: string | null }
  | { kind: 'structured'; container: string };

interface Signature {
  name: string;
  bytes: number[];
}

/**
 * `PK\x07\x08` is the spanning marker a multi-volume ZIP writes at the very
 * front, so it is listed separately from the ordinary local file header.
 */
const SIGNATURES: Signature[] = [
  { name: 'ZIP', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { name: 'ZIP', bytes: [0x50, 0x4b, 0x05, 0x06] },
  { name: 'ZIP (spanned)', bytes: [0x50, 0x4b, 0x07, 0x08] },
  { name: 'RAR', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
  { name: '7-Zip', bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { name: 'gzip', bytes: [0x1f, 0x8b] },
];

function signatureOf(head: Uint8Array): string | null {
  for (const sig of SIGNATURES) {
    if (sig.bytes.every((byte, i) => head[i] === byte)) return sig.name;
  }
  return null;
}

/**
 * Given the first bytes of the first two parts, says whether joining raw is
 * the right thing to do. With only one part there is nothing to compare
 * against, so it reports raw: one part joined raw is a copy, which is harmless.
 */
export function classifyParts(firstHead: Uint8Array, secondHead?: Uint8Array): SplitKind {
  const first = signatureOf(firstHead);
  if (!first) return { kind: 'raw', container: null };
  if (!secondHead || secondHead.length === 0) return { kind: 'raw', container: first };
  const second = signatureOf(secondHead);
  return second === first ? { kind: 'structured', container: first } : { kind: 'raw', container: first };
}

/** Reads enough of a part to look for a signature. */
export async function headOf(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, 8).arrayBuffer());
}

export function structuredMessage(container: string): string {
  return `These look like ${container} volumes, not a raw split: every part starts with a ${container} header, which only happens when each one is its own archive. Joining them end to end would produce a broken file. Open the first part with ${container === 'RAR' ? '7-Zip, WinRAR or The Unarchiver' : '7-Zip or The Unarchiver'} instead — it finds the other volumes itself.`;
}

export type OrderProblem =
  | { kind: 'unnamed'; names: string[] }
  | { kind: 'mixed'; bases: string[] }
  | { kind: 'duplicate'; index: number }
  | { kind: 'gap'; missing: number[] }
  | { kind: 'empty' };

export interface Ordering {
  ok: boolean;
  ordered: { index: number; name: string }[];
  problem?: OrderProblem;
}

/**
 * Puts the parts in order, or explains why it will not.
 *
 * The numeric sort is the whole point, though not for the reason usually
 * given. Zero-padding to a fixed width is precisely what makes a lexical sort
 * agree with a numeric one — '.002' really does sort before '.010' — so the
 * often-repeated example is wrong for names in this convention. Checked, not
 * assumed; a test asserts the two agree there.
 *
 * They diverge in three cases that do happen:
 *
 *   the padding width changes, at .999 -> .1000, where lexical puts .1000
 *   first and the join is silently corrupt;
 *
 *   the parts came from a tool that did not pad at all — .1, .2, .10 — which
 *   lexical orders as .1, .10, .2;
 *
 *   and the input is not sorted to begin with. `input.files` is in selection
 *   order, and a drop is in whatever order the OS handed over, so something
 *   has to sort them and the only safe key is the integer.
 *
 * Gaps and duplicates are refused here, before a single byte is written,
 * because the alternative is discovering them as a truncated output.
 */
export function orderParts(names: readonly string[]): Ordering {
  if (names.length === 0) return { ok: false, ordered: [], problem: { kind: 'empty' } };

  const parsed = names.map((name) => ({ name, part: parsePartName(name) }));
  const unnamed = parsed.filter((p) => p.part === null).map((p) => p.name);
  if (unnamed.length > 0) return { ok: false, ordered: [], problem: { kind: 'unnamed', names: unnamed } };

  const bases = [...new Set(parsed.map((p) => p.part!.base))];
  if (bases.length > 1) return { ok: false, ordered: [], problem: { kind: 'mixed', bases } };

  // Numeric, not lexical.
  const ordered = parsed
    .map((p) => ({ index: p.part!.index, name: p.name }))
    .sort((a, b) => a.index - b.index);

  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].index === ordered[i - 1].index) {
      return { ok: false, ordered, problem: { kind: 'duplicate', index: ordered[i].index } };
    }
  }

  const first = ordered[0].index;
  const last = ordered[ordered.length - 1].index;
  const present = new Set(ordered.map((p) => p.index));
  const missing: number[] = [];
  for (let i = first; i <= last; i++) if (!present.has(i)) missing.push(i);
  if (missing.length > 0) return { ok: false, ordered, problem: { kind: 'gap', missing } };

  return { ok: true, ordered };
}

/**
 * Splits a dropped selection into the parts, the manifest, and everything else.
 *
 * This runs before ordering, and it is the difference between working and not
 * for the commonest way anyone will use the join side: selecting a folder, or
 * dragging its whole contents in. That selection contains the manifest this
 * tool wrote, and on a Mac it contains .DS_Store whether anyone wanted it or
 * not. Sorting those into the sequence corrupts the output; treating them as an
 * error makes the tool refuse a selection that is perfectly fine.
 *
 * The rule is by shape rather than by a list of known nuisances: a part is a
 * name ending in a run of digits, and anything else is set aside and named in
 * the UI so nothing is silently dropped. CHECKSUMS.txt, Thumbs.db and a
 * README all fall out of that without being enumerated.
 */
export function partitionDropped<T extends { name: string }>(
  files: readonly T[],
): { parts: T[]; manifest: T | null; setAside: T[] } {
  const parts: T[] = [];
  const setAside: T[] = [];
  let manifest: T | null = null;

  for (const file of files) {
    if (file.name.toLowerCase().endsWith(MANIFEST_SUFFIX)) {
      // First one wins; a second is set aside rather than silently preferred.
      if (manifest === null) manifest = file;
      else setAside.push(file);
    } else if (parsePartName(file.name)) parts.push(file);
    else setAside.push(file);
  }

  return { parts, manifest, setAside };
}

/** The message shown for a refused set, naming what is wrong. */
export function orderProblemMessage(problem: OrderProblem, base = 'the file'): string {
  switch (problem.kind) {
    case 'empty':
      return 'No parts chosen yet.';
    case 'unnamed':
      return `${problem.names.slice(0, 3).join(', ')} ${problem.names.length === 1 ? 'does' : 'do'} not end in a part number like .001 — choose the numbered parts of one file.`;
    case 'mixed':
      return `These parts come from different files (${problem.bases.slice(0, 3).join(', ')}). Choose the parts of one file at a time.`;
    case 'duplicate':
      return `Part ${String(problem.index).padStart(3, '0')} was chosen twice. Remove the duplicate — joining it would produce a corrupt file.`;
    case 'gap':
      return `${problem.missing.length === 1 ? 'Part' : 'Parts'} ${problem.missing
        .slice(0, 5)
        .map((n) => String(n).padStart(3, '0'))
        .join(', ')} ${problem.missing.length === 1 ? 'is' : 'are'} missing from ${base}. Joining without ${problem.missing.length === 1 ? 'it' : 'them'} would produce a corrupt file, so nothing has been written.`;
  }
}

/* ------------------------------------------------------------------ */
/* Where the bytes go                                                  */
/* ------------------------------------------------------------------ */

/**
 * Anything that can be written to, one file at a time.
 *
 * Injected rather than reached for, so the streaming path can be exercised
 * against a handle obtained without a picker — the picker cannot be driven
 * from a test, and a code path that is only ever run by hand is not a code
 * path anyone should trust.
 */
export interface Sink {
  create(name: string): Promise<WritableStreamDefaultWriter<Uint8Array> | FileSystemWritableFileStream>;
}

export type SaveMode = 'directory' | 'file-picker' | 'download';

/**
 * Which saving path this browser can offer, decided before the user commits
 * to anything.
 *
 * Chrome and Edge can write straight to a folder. Firefox and Safari cannot,
 * so parts are saved one at a time behind a click each — slower, and honest,
 * which is better than a progress bar that ends in a browser refusing the
 * second download.
 */
export function saveMode(): SaveMode {
  if (typeof window === 'undefined') return 'download';
  if (typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function') {
    return 'directory';
  }
  if (typeof (window as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function') {
    return 'file-picker';
  }
  return 'download';
}

async function writeBlob(
  target: FileSystemWritableFileStream,
  blob: Blob,
  onBytes?: (n: number) => void,
): Promise<void> {
  // Copied a window at a time: `write(blob)` would be simpler and hands the
  // whole range to the implementation at once, which is exactly the thing this
  // tool exists to avoid doing.
  for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
    const slice = blob.slice(offset, Math.min(offset + CHUNK_BYTES, blob.size));
    await target.write(await slice.arrayBuffer());
    onBytes?.(slice.size);
  }
}

export interface SplitOptions {
  partBytes: number;
  /** Hashing the original costs a full read; only done when asked for. */
  withChecksum: boolean;
  /** Write the sidecar .join.txt alongside the parts. */
  withManifest: boolean;
  onProgress?: (bytesDone: number, total: number) => void;
  signal?: AbortSignal;
}

export interface SplitResult {
  parts: { name: string; bytes: number }[];
  sha256?: string;
  manifest?: string;
}

/**
 * Writes each part straight through to the sink.
 *
 * Nothing is accumulated: a part is a Blob range that is streamed out a window
 * at a time, so peak memory is one window regardless of the file or the part
 * size. The checksum, when asked for, is fed the same windows rather than
 * costing a second pass.
 */
export async function splitFile(
  file: File,
  options: SplitOptions,
  open: (name: string) => Promise<FileSystemWritableFileStream>,
): Promise<SplitResult> {
  const ranges = partRanges(file.size, options.partBytes);
  const hash = options.withChecksum ? new Sha256() : null;
  const parts: { name: string; bytes: number }[] = [];
  let done = 0;

  for (const range of ranges) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const name = partName(file.name, range.index);
    const target = await open(name);
    const blob = file.slice(range.start, range.end);

    for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const slice = blob.slice(offset, Math.min(offset + CHUNK_BYTES, blob.size));
      const buffer = await slice.arrayBuffer();
      if (hash) hash.update(new Uint8Array(buffer));
      await target.write(buffer);
      done += slice.size;
      options.onProgress?.(done, file.size);
    }

    await target.close();
    parts.push({ name, bytes: blob.size });
  }

  const sha256 = hash ? hash.digest() : undefined;

  // Written last, and as a separate file: the parts are finished and correct
  // before this exists, and they stay correct if it never does.
  let manifest: string | undefined;
  if (options.withManifest) {
    const name = manifestName(file.name);
    const target = await open(name);
    const text = buildManifest({ original: file.name, bytes: file.size, sha256: sha256 ?? null, parts });
    await target.write(new TextEncoder().encode(text).buffer as ArrayBuffer);
    await target.close();
    manifest = name;
  }

  return { parts, ...(sha256 ? { sha256 } : {}), ...(manifest ? { manifest } : {}) };
}

export interface JoinOptions {
  withChecksum: boolean;
  onProgress?: (bytesDone: number, total: number) => void;
  signal?: AbortSignal;
}

export interface JoinResult {
  bytes: number;
  sha256?: string;
}

/**
 * Concatenates parts into one already-open stream, in the order given.
 *
 * The caller has already ordered and validated them: this does not sort, and
 * it is not the place that catches a gap, because by the time bytes are being
 * written it is too late to catch anything.
 */
export async function joinParts(
  parts: readonly File[],
  options: JoinOptions,
  target: FileSystemWritableFileStream,
): Promise<JoinResult> {
  const total = parts.reduce((sum, part) => sum + part.size, 0);
  const hash = options.withChecksum ? new Sha256() : null;
  let done = 0;

  for (const part of parts) {
    for (let offset = 0; offset < part.size; offset += CHUNK_BYTES) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const slice = part.slice(offset, Math.min(offset + CHUNK_BYTES, part.size));
      const buffer = await slice.arrayBuffer();
      if (hash) hash.update(new Uint8Array(buffer));
      await target.write(buffer);
      done += slice.size;
      options.onProgress?.(done, total);
    }
  }

  await target.close();
  return { bytes: total, ...(hash ? { sha256: hash.digest() } : {}) };
}

/**
 * The digest of the parts joined, without joining them.
 *
 * For the browsers that cannot stream to disk, where the output is handed over
 * as one download and there is nothing to read back afterwards. The same
 * windows and the same hash as joinParts, so the answer is the digest of the
 * file they are about to receive.
 */
export async function hashParts(parts: readonly File[], options: JoinOptions = { withChecksum: true }): Promise<string> {
  const total = parts.reduce((sum, part) => sum + part.size, 0);
  const hash = new Sha256();
  let done = 0;

  for (const part of parts) {
    for (let offset = 0; offset < part.size; offset += CHUNK_BYTES) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const slice = part.slice(offset, Math.min(offset + CHUNK_BYTES, part.size));
      hash.update(new Uint8Array(await slice.arrayBuffer()));
      done += slice.size;
      options.onProgress?.(done, total);
    }
  }

  return hash.digest();
}

export { writeBlob };
