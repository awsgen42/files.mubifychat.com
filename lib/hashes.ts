'use client';

import type { BlockHash } from './blockhash';
import { Md5 } from './md5';
import { Sha1 } from './sha1';
import { Sha256 } from './sha256';

/**
 * The digests the checksum tool offers, and the streaming reader that feeds
 * them.
 *
 * All three are the same hand-rolled streaming implementations the LAN
 * transfer path uses, for the same reason: `crypto.subtle.digest` takes its
 * whole input at once, so a 1 GB file would mean a 1 GB ArrayBuffer. Reading
 * the file a chunk at a time and feeding every hasher the same chunk keeps
 * peak memory at one chunk however large the file is, and computes all three
 * in a single pass over the bytes.
 */

export type AlgorithmId = 'sha256' | 'sha1' | 'md5';

export interface Algorithm {
  id: AlgorithmId;
  label: string;
  /** Digest length in hex characters, used to find a hash in pasted text. */
  hexLength: number;
  /** Shown next to the choice; the weaknesses are not hidden. */
  note: string;
}

export const ALGORITHMS: readonly Algorithm[] = [
  {
    id: 'sha256',
    label: 'SHA-256',
    hexLength: 64,
    note: 'The current standard. Use this one unless the publisher gave you something else.',
  },
  {
    id: 'sha1',
    label: 'SHA-1',
    hexLength: 40,
    note: 'Still widely published. Collisions have been demonstrated, so it proves a download is not corrupted, not that nobody tampered with it.',
  },
  {
    id: 'md5',
    label: 'MD5',
    hexLength: 32,
    note: 'Old and thoroughly broken against a deliberate attacker. Fine for spotting a truncated or corrupted download, which is what most published MD5 lines are for.',
  },
];

function createHasher(id: AlgorithmId): BlockHash {
  switch (id) {
    case 'sha256':
      return new Sha256();
    case 'sha1':
      return new Sha1();
    case 'md5':
      return new Md5();
  }
}

/**
 * Fallback chunk size, used when the platform gives us no stream to read.
 * Large enough that the per-chunk overhead disappears, small enough that peak
 * memory stays flat for a file of any size.
 */
const CHUNK_BYTES = 4 * 1024 * 1024;

export interface HashOptions {
  onProgress?: (bytesRead: number) => void;
  signal?: AbortSignal;
}

/**
 * Hashes one file with every requested algorithm, in a single pass.
 *
 * Never reads the whole file: `Blob.stream()` hands over chunks the browser
 * chooses, and the slice fallback asks for a fixed window at a time. Either
 * way nothing bigger than one chunk is alive at once, which is the property
 * that makes a 1 GB file work in a tab.
 */
export async function hashFile(
  file: File,
  ids: readonly AlgorithmId[],
  options: HashOptions = {},
): Promise<Record<string, string>> {
  const hashers = ids.map((id) => [id, createHasher(id)] as const);
  let read = 0;

  const consume = (chunk: Uint8Array) => {
    for (const [, hasher] of hashers) hasher.update(chunk);
    read += chunk.length;
    options.onProgress?.(read);
  };

  const abort = () => {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  };

  abort();
  if (typeof file.stream === 'function') {
    const reader = file.stream().getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        abort();
        consume(value);
        // Yields to the event loop between chunks so the progress bar paints
        // and the tab stays responsive on a large file.
        await Promise.resolve();
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
      abort();
      consume(new Uint8Array(await file.slice(offset, offset + CHUNK_BYTES).arrayBuffer()));
    }
  }

  return Object.fromEntries(hashers.map(([id, hasher]) => [id, hasher.digest()]));
}

/* ------------------------------------------------------------------ */
/* Comparing against an expected hash                                  */
/* ------------------------------------------------------------------ */

export type CompareResult = 'empty' | 'match' | 'mismatch' | 'unrecognised';

/**
 * Pulls a digest out of whatever was pasted.
 *
 * People rarely paste a bare hash. They paste a line from a checksums file
 * ("<hash>  filename.iso"), or a hash with spaces in it, or one in capitals
 * from a vendor's download page. Any of those should work, so the first run of
 * hex characters of the right length wins.
 */
export function extractDigest(input: string, hexLength: number): string | null {
  const match = input.toLowerCase().match(new RegExp(`\\b[0-9a-f]{${hexLength}}\\b`));
  if (match) return match[0];

  // Some publishers print a hash in space-separated groups, which leaves no
  // token of the full length; fall back to every hex character present.
  const stripped = input.toLowerCase().replace(/[^0-9a-f]/g, '');
  return stripped.length === hexLength ? stripped : null;
}

/**
 * Whether the computed digest is the one that was expected.
 *
 * `unrecognised` is deliberately distinct from `mismatch`: telling someone
 * their file is wrong when in fact they pasted the SHA-1 into the SHA-256 box
 * would be a bad answer to a question they did not ask.
 */
export function compareDigest(actual: string, expected: string, hexLength: number): CompareResult {
  if (expected.trim() === '') return 'empty';
  const found = extractDigest(expected, hexLength);
  if (found === null) return 'unrecognised';
  return found === actual.toLowerCase() ? 'match' : 'mismatch';
}
