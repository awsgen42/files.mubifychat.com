/**
 * Turning one message file's JSON into normalised messages.
 *
 * Pure and synchronous so it can be tested without a zip, a worker or a
 * browser — the same functions run in the worker and in vitest, and a real
 * export can be dropped in as another fixture without changing them.
 */

import { MEDIA_FIELDS, fix, noteUnknownShape } from './schema';
import type { Message, MessageKind } from './types';

interface RawMessage {
  sender_name?: unknown;
  timestamp_ms?: unknown;
  content?: unknown;
  is_unsent?: unknown;
  reactions?: unknown;
  share?: unknown;
  [key: string]: unknown;
}

export interface RawThreadFile {
  participants?: unknown;
  messages?: unknown;
  title?: unknown;
  thread_path?: unknown;
}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/**
 * One message, normalised.
 *
 * The order of the checks is the order of precedence, and it matters: a removed
 * message can still carry an empty content field, and a share can carry both a
 * link and a caption.
 */
export function normaliseMessage(raw: RawMessage, index: number): Message {
  const sender = fix(raw.sender_name);
  const ts = typeof raw.timestamp_ms === 'number' ? raw.timestamp_ms : 0;
  const base = { i: index, ts, sender };

  const reactions = asArray(raw.reactions)
    .map((r) => {
      const rec = asRecord(r);
      return { reaction: fix(rec.reaction), actor: fix(rec.actor) };
    })
    .filter((r) => r.reaction || r.actor);
  const withReactions = reactions.length > 0 ? { reactions } : {};

  // Sent, then removed. Sender and timestamp survive; content does not. This is
  // its own state — never an empty bubble, because "nothing here" and "they
  // took it back" are different facts and only one of them is true.
  if (raw.is_unsent === true) {
    return { ...base, ...withReactions, kind: 'removed', label: 'Removed by sender' };
  }

  for (const media of MEDIA_FIELDS) {
    const items = asArray(raw[media.field]);
    if (items.length === 0) continue;
    const first = asRecord(items[0]);
    const uri = typeof first.uri === 'string' ? first.uri : undefined;
    return {
      ...base,
      ...withReactions,
      kind: media.kind as MessageKind,
      label: items.length > 1 ? `${media.label} (${items.length})` : media.label,
      ...(uri ? { uri } : {}),
    };
  }

  if (raw.share !== undefined) {
    const share = asRecord(raw.share);
    const text = fix(share.share_text ?? share.original_content_owner ?? share.link);
    return { ...base, ...withReactions, kind: 'share', label: 'Shared post', text };
  }

  if (typeof raw.content === 'string') {
    return { ...base, ...withReactions, kind: 'text', text: fix(raw.content) };
  }

  // Something we have not seen. It still happened, at a time, from a person, so
  // it renders as a labelled row rather than disappearing. The shape is
  // recorded so a real export tells us what to add here.
  noteUnknownShape(raw as Record<string, unknown>);
  return { ...base, ...withReactions, kind: 'unknown', label: 'Unsupported message' };
}

export interface ParsedFile {
  participants: string[];
  title: string;
  messages: Message[];
}

/** One message_N.json. Indices are assigned later, after the merge. */
export function parseThreadFile(json: unknown): ParsedFile {
  const doc = asRecord(json) as RawThreadFile;
  const participants = asArray(doc.participants)
    .map((p) => fix(asRecord(p).name))
    .filter(Boolean);
  return {
    participants,
    title: fix(doc.title),
    messages: asArray(doc.messages).map((m, i) => normaliseMessage(asRecord(m) as RawMessage, i)),
  };
}

/**
 * Merge a thread's files into one ascending timeline.
 *
 * Instagram writes newest-first *within* a file, and the files themselves are
 * not ordered relative to each other — message_2.json can hold older or newer
 * messages than message_1.json depending on how the export was chunked. So the
 * only safe key is the timestamp, applied across the concatenation.
 *
 * The sort is stable on ties, which matters: several messages can share a
 * millisecond, and their order within that millisecond is the order Instagram
 * wrote them.
 */
export function mergeThread(files: ParsedFile[]): ParsedFile {
  const messages = files
    .flatMap((f) => f.messages)
    .map((m, n) => ({ m, n }))
    .sort((a, b) => a.m.ts - b.m.ts || a.n - b.n)
    .map(({ m }, i) => ({ ...m, i }));

  const participants = [...new Set(files.flatMap((f) => f.participants))];
  const title = files.map((f) => f.title).find(Boolean) ?? participants[0] ?? 'Conversation';
  return { participants, title, messages };
}

/** Plain-text of a message, for search. Only real text — never a label. */
export function searchableText(message: Message): string {
  if (message.kind === 'text' || message.kind === 'share') return message.text ?? '';
  return '';
}
