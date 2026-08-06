/**
 * The limits, shared by the Worker that enforces them, the UI that shows them
 * and the policy pages that describe them.
 *
 * Everything user-visible about a limit is derived from the numbers here.
 * Copy that hardcodes "100 MB" goes stale the first time someone tunes a
 * value, and a policy page that misdescribes the service is worse than no
 * policy page — so the numbers have exactly one home.
 */

const MB = 1024 * 1024;
const GB = 1024 * MB;

/* ------------------------------------------------------------------ */
/* Sizes                                                               */
/* ------------------------------------------------------------------ */

/**
 * Per file and per session. wrangler.jsonc carries the same two numbers as
 * env vars so they can be tuned without a code change; these are the defaults
 * and the values every piece of copy is generated from. A test asserts the two
 * agree, because a mismatch would have the site advertising one limit while
 * the API enforced another.
 */
export const MAX_FILE_BYTES = 1 * GB;

/** Three files at the per-file limit. Two would make a one-file session. */
export const MAX_SESSION_BYTES = 3 * GB;

/* ------------------------------------------------------------------ */
/* Per-IP daily byte quota                                             */
/* ------------------------------------------------------------------ */

/**
 * Bytes one address may upload per UTC day.
 *
 * Read this as a brake on a scripted burst, not as fair-share allocation.
 * With no accounts, an address is all we have, and an address is a poor proxy
 * for a person in both directions: carrier-grade NAT puts thousands of phones
 * behind one IPv4, so this budget can be spent by strangers, while anyone with
 * a pool of addresses sidesteps it entirely. It exists to stop one client
 * emptying the storage allowance in an afternoon. Do not tune it as though it
 * were fair.
 *
 * 10 GB rather than something tighter for that same reason. At 3 GB — one full
 * session — a single legitimate user on a carrier address could be locked out
 * by other people's traffic, and the owner would hit it after three large
 * transfers. The storage it actually protects is billed per GB-month, and our
 * objects live minutes to hours, so the difference between a 3 GB and a 10 GB
 * cap is around 0.07 GB-month of real exposure: almost nothing bought, at the
 * cost of blocking normal use.
 */
export const IP_DAILY_BYTE_QUOTA = 10 * GB;

/**
 * How long a quota counter survives. An hour beyond the 24h window it counts,
 * so a counter written just before midnight UTC is still readable through the
 * rollover rather than vanishing early.
 *
 * This is the longest anything derived from an IP address is kept, and the
 * privacy page states it. Change one and change the other.
 */
export const QUOTA_KEY_TTL_SECONDS = 25 * 60 * 60;

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

/** Fixed-window size. KV rejects TTLs below 60s, which sets the floor. */
export const RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * How long a counter key lives in KV. Two windows, so a counter written at the
 * end of one window is still readable through the next.
 */
export const RATE_LIMIT_KEY_TTL_SECONDS = RATE_LIMIT_WINDOW_SECONDS * 2;

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/**
 * A limit as it should be written in prose: "1 GB", "500 MB", "2.5 GB".
 *
 * Deliberately not lib/format.ts formatBytes — that one is for live transfer
 * readouts and rounds for compactness. A stated limit should read as the round
 * number it is.
 */
export function formatLimit(bytes: number): string {
  if (bytes >= GB) {
    const value = bytes / GB;
    return `${Number.isInteger(value) ? value : value.toFixed(1)} GB`;
  }
  const value = bytes / MB;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} MB`;
}
