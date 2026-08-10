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

/**
 * Below this, "Stop now" is not offered while pausing: the current part will
 * be done before anyone could read the button, and one that appears for a
 * moment and vanishes is worse than none.
 */
export const PAUSE_STOP_NOW_THRESHOLD_S = 5;

/* ------------------------------------------------------------------ */
/* Direct (LAN) transfer                                               */
/* ------------------------------------------------------------------ */

/**
 * How long the sender waits for the peer's answer.
 *
 * The handshake travels by poll, so the floor is set by POLL_ACTIVE_MS at each
 * end — offer posted, peer polls, peer answers, sender polls — which is around
 * two intervals when both tabs are in front and longer when one has backed off
 * to POLL_IDLE_MS. 30s covers the slow case without leaving someone watching a
 * spinner for a peer that is not going to reply.
 */
export const LAN_ANSWER_TIMEOUT_MS = 30_000;

/**
 * Signals older than this are ignored.
 *
 * An abandoned attempt leaves its offer in the session until the same
 * participant posts another. Without an age check, a device joining later
 * would answer a handshake nobody is waiting on, and the answer would sit
 * there unread.
 */
export const LAN_SIGNAL_MAX_AGE_MS = 60_000;

/**
 * Above this, a direct transfer is suggested rather than merely available.
 *
 * Small files are not worth the handshake: the cloud path starts instantly and
 * a 5 MB upload is over before a direct connection would have finished
 * negotiating. The saving only becomes real once the transfer itself is the
 * slow part.
 */
export const LAN_SUGGEST_BYTES = 100 * 1024 * 1024;
