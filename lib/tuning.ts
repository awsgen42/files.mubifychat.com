/**
 * Client-side timing knobs, kept together so they are easy to tune.
 *
 * Server-side limits live in worker/ratelimit.ts and wrangler.jsonc. The two
 * are coupled: POLL_ACTIVE_MS sets the request rate per device, and the
 * POLL_LIMITER binding has to stay comfortably above it or real users behind
 * one NAT get limited. At 5s that is ~12 req/min per device against a 60/min
 * cap, i.e. room for five devices on one IP.
 */

/** Poll interval while the session is actively changing. */
export const POLL_ACTIVE_MS = 5_000;

/** Slower interval once nothing has changed for a while. */
export const POLL_IDLE_MS = 15_000;

/** How long without a change before dropping to the idle interval. */
export const POLL_IDLE_AFTER_MS = 60_000;

/** Window used to smooth the upload speed/ETA readout. */
export const SPEED_WINDOW_MS = 3_000;

/**
 * Attempts per part beyond the first. A part is a self-contained request, so
 * retrying it costs at most one part's worth of bytes.
 */
export const PART_RETRIES = 4;

/** First backoff step; doubles each attempt, so 1s, 2s, 4s, 8s. */
export const PART_RETRY_BASE_MS = 1_000;
