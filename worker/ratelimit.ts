import { RATE_LIMIT_KEY_TTL_SECONDS, RATE_LIMIT_WINDOW_SECONDS } from '../shared/limits';
import type { Env } from './env';
import { rateLimited } from './http';

export interface RateLimit {
  /** Requests allowed per window. */
  limit: number;
  /** Namespace so creating sessions and guessing codes are counted separately. */
  bucket: string;
}

/**
 * Fixed-window counter in KV. It is approximate — KV writes are eventually
 * consistent, so a burst across colos can overshoot — but it is enough to make
 * brute-forcing a 6-digit code impractical within a 15 minute session window,
 * which is the property that actually matters here.
 */
export async function enforceRateLimit(env: Env, ip: string, { limit, bucket }: RateLimit): Promise<void> {
  if (ip === 'unknown') return;
  const window = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SECONDS);
  const key = `rl:${bucket}:${ip}:${window}`;

  const current = Number((await env.SESSIONS.get(key, 'text')) ?? '0');
  if (current >= limit) throw rateLimited();

  await env.SESSIONS.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_KEY_TTL_SECONDS });
}

/**
 * Every server-side rate limit, per IP per 60s window.
 *
 * The polled session-state route is NOT here: it is guarded by the
 * POLL_LIMITER binding in wrangler.jsonc instead, because a KV write per
 * request is far too expensive for a route that runs every few seconds per
 * device. See enforcePollLimit below.
 */
export const LIMITS = {
  createSession: { bucket: 'create', limit: 10 },
  joinSession: { bucket: 'join', limit: 20 },
  sendItem: { bucket: 'send', limit: 120 },
} satisfies Record<string, RateLimit>;

/**
 * Guards GET /api/sessions/:code, the highest-volume endpoint in the app.
 *
 * This is an availability control, not a cost one: unmetered, a single loop
 * could exhaust the daily Workers request budget and take the site down for
 * everyone until midnight UTC. The configured 60/min sits well above real
 * polling — POLL_ACTIVE_MS is 5s, so ~12 req/min per device, i.e. five devices
 * behind one NAT — while capping any single IP at 86,400/day, below the free
 * tier's 100,000.
 *
 * Being limited is deliberately soft: the client treats a 429 on a poll as
 * transient and retries, so a busy shared IP sees slightly stale state rather
 * than a broken session.
 */
export async function enforcePollLimit(env: Env, ip: string): Promise<void> {
  if (ip === 'unknown') return;
  const { success } = await env.POLL_LIMITER.limit({ key: ip });
  if (!success) throw rateLimited();
}
