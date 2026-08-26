/**
 * Which of the two media states an archive opens in.
 *
 * There are exactly two: text only, and show media. No per-thread setting, no
 * "load images but not video", no quality slider. The choice is a memory lever
 * and it should read as one.
 *
 * The rule this replaces keyed the default off the archive's size on disk. That
 * measures the wrong thing. A 900 MB archive that is almost all message JSON
 * renders like a text file, and a 600 MB archive that is almost all video will
 * hurt — the two land on opposite sides of an archive-size cutoff from the
 * quantity that actually predicts the cost. What predicts it is the media
 * itself: how many bytes of it there are, and how big each item is.
 *
 * Both inputs are free. zip.js reads the central directory when the file is
 * opened, so the uncompressed size of every photo and video is known before a
 * single byte is decompressed — the decision is made from data we already have,
 * not from a scan we pay for.
 */

import type { ArchiveIndex } from './types';

export type MediaMode = 'text' | 'media';

export interface MediaDecision {
  mode: MediaMode;
  /** Shown next to the toggle, so the default is never unexplained. */
  reason: string;
  mediaBytes: number;
  mediaCount: number;
}

const MB = 1024 * 1024;

/**
 * Media bytes above which the archive opens text-only.
 *
 * Chosen from the measurements in perf/: scrolling a thread with media on costs
 * roughly the working set of the items currently resolved, and the archives
 * that pushed the tab past a comfortable ceiling were the ones whose media
 * total ran into the hundreds of megabytes. 250 MB sits below the media-heavy
 * fixture and above the ordinary ones.
 */
export const MEDIA_BYTES_CUTOFF = 250 * MB;

/**
 * A second gate on item size. Twelve 40 MB videos are 480 MB in twelve blobs;
 * the byte cutoff catches that. The reverse case — a great many small items —
 * costs in blob URLs and decode work rather than bytes, so the count is capped
 * independently.
 */
export const MEDIA_COUNT_CUTOFF = 4000;

/**
 * A single item large enough that resolving it is itself the problem. A blob
 * this size has to be materialised whole before it can be shown.
 */
export const MEAN_ITEM_CUTOFF = 8 * MB;

const round = (bytes: number) =>
  bytes >= 1024 * MB ? `${(bytes / (1024 * MB)).toFixed(1)} GB` : `${Math.round(bytes / MB)} MB`;

/**
 * The default state for an archive.
 *
 * Deliberately not a function of the archive's total size, the number of
 * threads, or the device — `navigator.deviceMemory` is absent on the platform
 * where the answer matters most (iOS reports nothing), so keying the default
 * off it would mean the strictest devices get the loosest rule.
 */
export function defaultMediaMode(index: Pick<ArchiveIndex, 'mediaBytes' | 'mediaCount'>): MediaDecision {
  const { mediaBytes, mediaCount } = index;
  const base = { mediaBytes, mediaCount };
  const mean = mediaCount > 0 ? mediaBytes / mediaCount : 0;

  if (mediaCount === 0) {
    return { ...base, mode: 'text', reason: 'This export contains no photos or videos.' };
  }
  if (mediaBytes > MEDIA_BYTES_CUTOFF) {
    return {
      ...base,
      mode: 'text',
      reason: `${round(mediaBytes)} of photos and video. Starting text-only so the archive opens; turn media on when you want it.`,
    };
  }
  if (mediaCount > MEDIA_COUNT_CUTOFF) {
    return {
      ...base,
      mode: 'text',
      reason: `${mediaCount.toLocaleString()} attachments. Starting text-only; turn media on when you want it.`,
    };
  }
  if (mean > MEAN_ITEM_CUTOFF) {
    return {
      ...base,
      mode: 'text',
      reason: `The attachments here average ${round(mean)} each. Starting text-only; turn media on when you want it.`,
    };
  }
  return {
    ...base,
    mode: 'media',
    reason: `${round(mediaBytes)} of photos and video — small enough to show as you scroll.`,
  };
}

/**
 * The rule this replaced, kept so the control can run it.
 *
 * Not exported for use anywhere in the page. It exists because the claim "the
 * briefed threshold measures the wrong thing" is only worth anything if it can
 * be shown failing on a real fixture, side by side.
 */
export function archiveSizeMediaMode(archiveBytes: number): MediaMode {
  return archiveBytes > 1024 * MB ? 'text' : 'media';
}
