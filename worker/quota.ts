import { IP_DAILY_BYTE_QUOTA, QUOTA_KEY_TTL_SECONDS } from '../shared/limits';
import type { Env } from './env';
import { ApiError } from './http';

/**
 * Per-IP daily byte quota.
 *
 * What it is for: stopping one client from emptying the storage allowance in
 * an afternoon. What it is not: a fair share. With no accounts an address is
 * all we have, and behind carrier-grade NAT one address is thousands of
 * phones. See IP_DAILY_BYTE_QUOTA.
 *
 * Bytes are charged where session bytes are already charged — reserved against
 * the declared size when an item is created, reconciled to the measured size
 * when it completes, released on cancel. Charging per part instead would cost
 * a KV write for every 25 MB, which is around 41 writes for a single 1 GB file
 * against a budget of 1,000 a day.
 */

/**
 * The counter key.
 *
 * The address is HMAC'd rather than hashed. A plain SHA-256 of an IPv4 is not
 * anonymisation — the whole address space is 2^32, so a digest is reversible
 * by brute force in seconds. Without the secret the HMAC is not, which is the
 * difference between keeping a pseudonymous counter for a day and keeping
 * someone's address for a day.
 */
async function counterKey(salt: string, ip: string, now: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const day = new Date(now).toISOString().slice(0, 10); // UTC calendar day
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${day}:${ip}`));
  // 16 bytes is far past collision concerns for a per-day counter and keeps
  // the key short.
  const hex = Array.from(new Uint8Array(mac).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
  return `q:${day}:${hex}`;
}

/**
 * Quota enforcement requires the salt. Without it the only options would be to
 * keep a reversible hash of an address for a day or to keep the address
 * itself, and neither is worth a byte counter — so the quota is skipped
 * instead. Production sets the secret; local development does not, which is
 * also why `wrangler dev` never enforces it.
 */
function quotaSalt(env: Env): string | null {
  return env.QUOTA_SALT && env.QUOTA_SALT.length > 0 ? env.QUOTA_SALT : null;
}

async function read(env: Env, key: string): Promise<number> {
  const raw = await env.SESSIONS.get(key, 'text');
  const value = Number(raw ?? '0');
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function write(env: Env, key: string, value: number): Promise<void> {
  await env.SESSIONS.put(key, String(Math.max(0, Math.round(value))), {
    expirationTtl: QUOTA_KEY_TTL_SECONDS,
  });
}

export function quotaExceeded(): ApiError {
  return new ApiError(
    429,
    'quota_exceeded',
    'This network has reached its daily upload limit. It resets at midnight UTC.',
  );
}

/**
 * Reserves `bytes` against the day's budget, or rejects. Called before an
 * upload is allowed to start, so a file that would blow the budget is refused
 * up front rather than after it has been transferred.
 */
export async function reserveQuota(env: Env, ip: string, bytes: number, now: number): Promise<void> {
  const salt = quotaSalt(env);
  if (!salt || ip === 'unknown' || bytes <= 0) return;

  const key = await counterKey(salt, ip, now);
  const used = await read(env, key);
  if (used + bytes > IP_DAILY_BYTE_QUOTA) throw quotaExceeded();
  await write(env, key, used + bytes);
}

/**
 * Corrects the reservation once the real size is known, and releases it when
 * an upload is cancelled or discarded. `delta` may be negative.
 *
 * Never rejects: the bytes have already moved by the time this runs, and
 * failing here would leave the counter overstated with nothing gained.
 */
export async function adjustQuota(env: Env, ip: string, delta: number, now: number): Promise<void> {
  const salt = quotaSalt(env);
  if (!salt || ip === 'unknown' || delta === 0) return;

  const key = await counterKey(salt, ip, now);
  const used = await read(env, key);
  await write(env, key, used + delta);
}
