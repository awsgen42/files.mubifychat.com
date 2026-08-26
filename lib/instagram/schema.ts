/**
 * Everything this code believes about Instagram's export format.
 *
 * One file on purpose. This ships without ever having seen a real "Download
 * your information" archive — the fixtures are synthetic, built to the
 * documented shape — so the first real export will disagree with it somewhere.
 * When it does, the fix should be one file to open rather than a search across
 * the parser.
 *
 * The rule for everything here: assume no field is present. Instagram has
 * message kinds nobody outside Meta has enumerated — stickers, polls, calls,
 * "unsupported message type", system notices, disappearing-mode entries,
 * reactions on removed messages. An unknown shape must render as a labelled row
 * with a timestamp. It must never crash the thread and never vanish silently,
 * because a message that disappears is worse than one we cannot describe.
 */

/** Where message JSON lives. Matched loosely: the prefix has changed before. */
export const MESSAGE_FILE = /(^|\/)message_(\d+)\.json$/i;

/**
 * Directories that mark an export. Used only to explain what a zip contained
 * when no messages were found — never to reject one.
 */
export const KNOWN_TOP_LEVEL = [
  'your_instagram_activity',
  'messages',
  'media',
  'personal_information',
  'connections',
  'ads_information',
  'logged_information',
  'preferences',
  'security_and_login_information',
];

/** An HTML export has these instead of message JSON. */
export const HTML_EXPORT_HINT = /(^|\/)messages\/inbox\/[^/]+\/message_\d+\.html$/i;

/**
 * Media that a conversation can actually show.
 *
 * Restricted to the inbox on purpose. An export also carries your posts,
 * stories, reels, profile pictures and ads media, and in the fixtures that is
 * the majority of the bytes — but none of it ever renders in a thread. Counting
 * it would put the media default on the wrong side of its cutoff for exactly
 * the archives where the cutoff matters. Message attachments live in
 * photos/, videos/, audio/ and gifs/ beside the message JSON.
 */
export const MESSAGE_MEDIA =
  /(^|\/)messages\/(inbox|archived_threads|message_requests)\/[^/]+\/(photos|videos|audio|gifs|stickers)\/[^/]+$/i;

/** Extensions treated as media when they appear in a message media directory. */
export const MEDIA_EXTENSION = /\.(jpg|jpeg|png|webp|gif|mp4|mov|m4a|aac|mp3|heic|wav|ogg)$/i;

/**
 * Media attachment arrays, in the order they are checked. Each maps to the
 * label shown when media is not being rendered.
 *
 * `audio_files` covers voice messages. `share` is a linked post or reel and
 * carries its own text. `sticker` and `gifs` are separate arrays that behave
 * like photos.
 */
export const MEDIA_FIELDS = [
  { field: 'photos', kind: 'photo', label: 'Photo' },
  { field: 'videos', kind: 'video', label: 'Video' },
  { field: 'audio_files', kind: 'audio', label: 'Voice message' },
  { field: 'gifs', kind: 'gif', label: 'GIF' },
  { field: 'sticker', kind: 'sticker', label: 'Sticker' },
] as const;

export type MediaKind = (typeof MEDIA_FIELDS)[number]['kind'];

/**
 * Fields that carry human text and therefore need the encoding repair.
 * Anything not listed here is passed through untouched.
 */
export const TEXT_FIELDS = ['content', 'sender_name', 'title', 'name', 'reaction', 'actor'];

/**
 * Instagram writes UTF-8 bytes as latin-1 code points, so Urdu, Arabic,
 * accented Latin and emoji all arrive corrupted. This is the single most
 * visible thing existing viewers get wrong.
 *
 * The guard matters as much as the repair: a string that is already correct
 * must be returned untouched, and a string that only looks like mojibake must
 * not be mangled. Two safeguards — the lead-byte test, and TextDecoder in
 * fatal mode, which throws rather than producing replacement characters if the
 * bytes are not in fact valid UTF-8.
 *
 * The lead-byte range is c2-f4, not the c2-c5 that circulates for this bug.
 * The narrow version only catches two-byte sequences from the Latin-1
 * supplement, and misses every script this tool exists to fix: Arabic and Urdu
 * lead with d8/d9, CJK with e6, emoji with f0. Measured against the samples in
 * the tests, c2-c5 repairs accented Latin and returns Urdu, Arabic, CJK and
 * emoji still corrupted. c2-f4 is the full set of UTF-8 lead bytes, and the
 * fatal decode is what makes widening it safe.
 */
export function fix(value: unknown): string {
  if (typeof value !== 'string' || !value) return typeof value === 'string' ? value : '';
  if (!/[\u00c2-\u00f4][\u0080-\u00bf]/.test(value)) return value;
  try {
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code > 255) return value;
      bytes[i] = code;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}

/**
 * The thread a message file belongs to.
 *
 * One conversation is split across message_1.json, message_2.json … in the same
 * directory, so the directory is the identity. Every existing tool gets this
 * wrong: the most-starred one tells users to merge the files by hand, and the
 * leading hosted one takes a single message_1.json at a time.
 */
export function threadKeyFor(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

/** Unrecognised shapes, collected so a real export can tell us what we missed. */
const unknownShapes = new Map<string, number>();

export function noteUnknownShape(sample: Record<string, unknown>): void {
  const signature = Object.keys(sample).sort().join(',');
  unknownShapes.set(signature, (unknownShapes.get(signature) ?? 0) + 1);
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[instagram] unrecognised message shape:', signature, sample);
  }
}

export function unknownShapeReport(): { signature: string; count: number }[] {
  return [...unknownShapes.entries()].map(([signature, count]) => ({ signature, count }));
}
