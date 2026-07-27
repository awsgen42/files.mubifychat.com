import type { Env } from './env';
import { rateLimited } from './http';

/** KV's minimum TTL, which also sets the smallest usable window. */
const WINDOW_SECONDS = 60;

export interface RateLimit {
  /** Requests allowed per 60s window. */
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
  const window = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `rl:${bucket}:${ip}:${window}`;

  const current = Number((await env.SESSIONS.get(key, 'text')) ?? '0');
  if (current >= limit) throw rateLimited();

  await env.SESSIONS.put(key, String(current + 1), { expirationTtl: WINDOW_SECONDS * 2 });
}

export const LIMITS = {
  createSession: { bucket: 'create', limit: 10 },
  joinSession: { bucket: 'join', limit: 20 },
  sendItem: { bucket: 'send', limit: 120 },
} satisfies Record<string, RateLimit>;
