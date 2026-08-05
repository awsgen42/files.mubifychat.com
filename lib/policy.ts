/**
 * Facts about how the service actually behaves, shared by every page that
 * states them — /report, /privacy and /terms.
 *
 * These are not marketing copy. Each one is derived from the implementation
 * and must be updated together with it:
 *
 *   idle / hard limit   wrangler.jsonc SESSION_IDLE_TTL_SECONDS, SESSION_MAX_TTL_SECONDS
 *   size limits         wrangler.jsonc MAX_FILE_BYTES, MAX_SESSION_BYTES
 *   IP handling         worker/ratelimit.ts enforceRateLimit / enforcePollLimit
 *   deletion            worker/api.ts purgeObjects, worker/index.ts collectGarbage
 *
 * A policy that misdescribes the architecture is worse than no policy, so
 * prefer deleting a sentence here over letting it go stale.
 */

import { RATE_LIMIT_KEY_TTL_SECONDS } from '@/shared/limits';

export const ABUSE_EMAIL = 'abuse@mubifiles.com';

export const SESSION_IDLE_MINUTES = 15;
export const SESSION_HARD_LIMIT_HOURS = 24;
export const MAX_FILE_MB = 100;
export const MAX_SESSION_MB = 500;

/**
 * How IP addresses are handled. Stated identically on /report and /privacy.
 *
 * Deliberately does not claim we "never store" an IP: enforceRateLimit builds
 * a KV key containing the address, so it is written down, just briefly and
 * never against a file. Overstating this would be the exact kind of false
 * assurance a policy should avoid.
 */
export const IP_HANDLING =
  'IP addresses are used only to rate-limit requests. They appear in short-lived rate-limiting counters that expire within a couple of minutes, and are never recorded against a session, a file, or an upload. We keep no record linking an address to anything that was sent.';

/**
 * The mechanics behind IP_HANDLING, stated exactly. Rendered on /privacy only;
 * /report gets the summary above.
 *
 * The TTL is imported rather than written out, so retuning the limiter cannot
 * silently make this page wrong.
 */
export const IP_HANDLING_DETAIL = [
  `Most endpoints are rate-limited with a counter held in Cloudflare KV. The address forms part of that counter's key — literally written down, alongside which limit it counts and which time window it belongs to. The key is set to expire ${RATE_LIMIT_KEY_TTL_SECONDS} seconds after it is written, and is discarded then. We never read these keys for any purpose other than deciding whether to allow the next request.`,
  'The session-state endpoint, which your browser polls while a session is open, uses Cloudflare’s own rate-limiting service instead. Your address is passed to it as a key; nothing is stored on our side at all.',
  'In neither case is the address written into the session record, attached to a file, or kept anywhere that would let it be matched to something you sent. There is no join to make.',
] as const;

/** What the browser keeps, and why. Nothing here leaves the device. */
export const LOCAL_STORAGE_ITEMS = [
  {
    key: 'mubifiles.session',
    what: 'The six-digit code of your current session and the token that authorises this device to use it.',
    why: 'So refreshing the page does not lose the session. Cleared when the session ends.',
  },
  {
    key: 'mubifiles.theme',
    what: 'Your light or dark theme preference, if you have set one.',
    why: 'So the page does not flash the wrong theme on load.',
  },
] as const;

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
