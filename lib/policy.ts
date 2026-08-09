/**
 * Facts about how the service actually behaves, shared by every page that
 * states them — /report, /privacy and /terms.
 *
 * These are not marketing copy. Each one is derived from the implementation
 * and must be updated together with it:
 *
 *   browser storage     lib/uploads.ts, lib/useTheme.ts, public/sw.js
 *   idle / hard limit   wrangler.jsonc SESSION_IDLE_TTL_SECONDS, SESSION_MAX_TTL_SECONDS
 *   size limits         shared/limits.ts, mirrored in wrangler.jsonc
 *   IP handling         worker/ratelimit.ts and worker/quota.ts
 *   deletion            worker/api.ts purgeObjects, worker/index.ts collectGarbage
 *
 * A policy that misdescribes the architecture is worse than no policy, so
 * prefer deleting a sentence here over letting it go stale.
 */

import {
  MAX_FILE_BYTES,
  MAX_SESSION_BYTES,
  QUOTA_KEY_TTL_SECONDS,
  RATE_LIMIT_KEY_TTL_SECONDS,
  formatLimit,
} from '@/shared/limits';

export const ABUSE_EMAIL = 'abuse@mubifiles.com';

export const SESSION_IDLE_MINUTES = 15;
export const SESSION_HARD_LIMIT_HOURS = 24;
/** Written out, not in megabytes: the limits are gigabytes now. */
export const MAX_FILE_LABEL = formatLimit(MAX_FILE_BYTES);
export const MAX_SESSION_LABEL = formatLimit(MAX_SESSION_BYTES);

/**
 * How IP addresses are handled. Stated identically on /report and /privacy.
 *
 * Deliberately does not claim we "never store" an IP. enforceRateLimit writes
 * the address into a KV key, and the daily byte quota keeps a keyed hash of it
 * for a day. Both are brief and neither is attached to a file, but they are
 * real, and overstating this would be the exact kind of false assurance a
 * policy should avoid.
 */
export const IP_HANDLING =
  'IP addresses are used only to limit how much any one network can send. They appear in two kinds of counter — one that expires within a couple of minutes, and one that records a running total of bytes uploaded and expires within a day — and never against a session, a file, or a particular upload. We keep no record of what was sent from an address, only how much.';

/**
 * The mechanics behind IP_HANDLING, stated exactly. Rendered on /privacy only;
 * /report gets the summary above.
 *
 * Both retention figures are imported rather than written out, so retuning the
 * limiter or the quota cannot silently make this page wrong.
 */
export const IP_HANDLING_DETAIL = [
  `Most endpoints are rate-limited with a counter held in Cloudflare KV. The address forms part of that counter's key — literally written down, alongside which limit it counts and which time window it belongs to. The key is set to expire ${RATE_LIMIT_KEY_TTL_SECONDS} seconds after it is written, and is discarded then. We never read these keys for any purpose other than deciding whether to allow the next request.`,
  'The session-state endpoint, which your browser polls while a session is open, uses Cloudflare’s own rate-limiting service instead. Your address is passed to it as a key; nothing is stored on our side at all.',
  `There is also a daily cap on how much one network can upload. That counter is kept for up to ${Math.round(QUOTA_KEY_TTL_SECONDS / 3600)} hours — long enough to cover the day it counts — which makes it the longest-lived thing here derived from an address. It is not keyed on the address itself: the address is put through a keyed hash using a secret we hold, so the stored key cannot be turned back into an address by anyone who obtains it. What it holds is a number of bytes and nothing else — no filenames, no session, no record of what any of those bytes were.`,
  'In none of these cases is the address written into the session record, attached to a file, or kept anywhere that would let it be matched to something you sent. There is no join to make.',
] as const;

/** What the browser keeps, and why. Nothing here leaves the device. */
export const LOCAL_STORAGE_ITEMS = [
  {
    key: 'mubifiles.session',
    what: 'The six-digit code of your current session and the token that authorises this device to use it.',
    why: 'So refreshing the page does not lose the session. Cleared when the session ends.',
  },
  {
    key: 'mubifiles.uploads',
    what: 'For a large file being uploaded: its name, size and the identifiers of the pieces that have already been sent.',
    why: 'So an upload interrupted by a dropped connection or a closed tab resumes instead of starting over. Cleared when the upload finishes or the session ends.',
  },
  {
    key: 'mubifiles.theme',
    what: 'Your light or dark theme preference, if you have set one.',
    why: 'So the page does not flash the wrong theme on load.',
  },
] as const;

/**
 * What the service worker keeps, which is a different kind of storage from the
 * values above and worth naming separately — someone auditing the site will
 * see a Cache Storage entry in devtools and should find it described here.
 */
export const CACHE_STORAGE = {
  what: 'A copy of the pages, scripts and images that make up the site, so it still opens when you are offline.',
  why: 'Nothing you send or receive is in it. Files and text go straight to the server and are never written to this cache — it holds only the site itself, the same files anyone downloads by visiting.',
} as const;

/** Third parties that process data on our behalf. */
export const SUBPROCESSORS = [
  {
    name: 'Vercel',
    role: 'Serves the website itself — the pages and scripts your browser loads. Vercel receives the requests your browser makes for those files.',
  },
  {
    name: 'Cloudflare',
    role: 'Runs the API (Workers), holds session records (KV) and stores uploaded files (R2). Everything you send passes through and is stored by Cloudflare until it is deleted.',
  },
] as const;
