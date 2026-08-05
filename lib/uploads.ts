'use client';

import type { UploadedPart } from '@/shared/types';

/**
 * Where a multipart upload's progress is remembered between attempts.
 *
 * It lives in localStorage rather than in the session document because the
 * server would otherwise write to KV once per part — around 40 extra writes
 * for a single large file, against a daily budget of 1,000. Keeping the
 * manifest here means multipart costs no more KV writes than a single-request
 * upload did. The server keeps the uploadId, so the two halves are useless
 * without each other and a client cannot drive someone else's upload.
 *
 * The consequence is that only the tab that started an upload can resume it.
 * That is not a real restriction: the File itself is a handle into the local
 * machine, so no other device could continue the transfer anyway.
 */

const STORAGE_KEY = 'mubifiles.uploads';

export interface UploadRecord {
  code: string;
  itemId: string;
  /** Set when the user paused, so a returning tab says so rather than looking crashed. */
  paused?: boolean;
  /** Identity of the file, so a resumed upload cannot be fed a different one. */
  name: string;
  size: number;
  lastModified: number;
  partSize: number;
  parts: UploadedPart[];
}

type Store = Record<string, UploadRecord>;

function read(): Store {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    if (Object.keys(store).length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private-mode browsers refuse storage. Uploads still work; they just
    // cannot be resumed after the tab goes away.
  }
}

/**
 * The record for this file, but only if it is unmistakably the same file. A
 * resumed upload splices new bytes into parts that are already in R2, so
 * matching the wrong file would produce a silently corrupt object.
 */
export function findResumable(code: string, file: File): UploadRecord | null {
  const match = Object.values(read()).find(
    (record) =>
      record.code === code &&
      record.name === file.name &&
      record.size === file.size &&
      record.lastModified === file.lastModified,
  );
  return match ?? null;
}

export function beginUpload(record: Omit<UploadRecord, 'parts'>): void {
  write({ ...read(), [record.itemId]: { ...record, parts: [] } });
}

/**
 * Records a landed part. The etag is stored exactly as R2 returned it —
 * quotes, case and all. R2 compares it byte for byte at completion, and a
 * normalised etag fails there with an error that points nowhere near the
 * actual cause.
 */
export function recordPart(itemId: string, part: UploadedPart): void {
  const store = read();
  const record = store[itemId];
  if (!record) return;
  const parts = [...record.parts.filter((p) => p.partNumber !== part.partNumber), part];
  parts.sort((a, b) => a.partNumber - b.partNumber);
  write({ ...store, [itemId]: { ...record, parts } });
}

export function markPaused(itemId: string, paused: boolean): void {
  const store = read();
  const record = store[itemId];
  if (!record) return;
  write({ ...store, [itemId]: { ...record, paused } });
}

export function forgetUpload(itemId: string): void {
  const store = read();
  if (!(itemId in store)) return;
  delete store[itemId];
  write(store);
}

/** Drops every record for a session, used when the session ends. */
export function forgetSessionUploads(code: string): void {
  const store = read();
  const kept = Object.fromEntries(Object.entries(store).filter(([, r]) => r.code !== code));
  if (Object.keys(kept).length !== Object.keys(store).length) write(kept);
}
