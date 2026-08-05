/**
 * Rate-limiter timings, shared by the Worker that enforces them and the
 * privacy policy that describes them.
 *
 * The privacy page states how long an IP address survives in a counter key.
 * That number has to come from the same place the Worker reads it, or the
 * policy quietly becomes wrong the first time someone tunes the limiter.
 */

/** Fixed-window size. KV rejects TTLs below 60s, which sets the floor. */
export const RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * How long a counter key lives in KV. Two windows, so a counter written at the
 * end of one window is still readable through the next.
 */
export const RATE_LIMIT_KEY_TTL_SECONDS = RATE_LIMIT_WINDOW_SECONDS * 2;
