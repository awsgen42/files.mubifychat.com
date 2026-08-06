/**
 * Cloudflare's native rate limiter. Enforced in-colo and costs no KV
 * operations, which is what makes it usable on a high-frequency route.
 */
export interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  SESSIONS: KVNamespace;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  POLL_LIMITER: RateLimiterBinding;
  UPLOAD_LIMITER: RateLimiterBinding;

  SESSION_IDLE_TTL_SECONDS: string;
  SESSION_MAX_TTL_SECONDS: string;
  MAX_FILE_BYTES: string;
  MAX_SESSION_BYTES: string;
  MAX_ITEMS: string;
  MAX_TEXT_CHARS: string;

  /** Comma-separated origins allowed to call the API cross-origin. */
  ALLOWED_ORIGINS?: string;

  /**
   * Secret keying the per-IP byte quota counters. Without it the quota is not
   * enforced at all — see worker/quota.ts for why that is the right failure
   * mode rather than falling back to a reversible hash.
   *
   *   npx wrangler secret put QUOTA_SALT
   */
  QUOTA_SALT?: string;

  // Optional secrets enabling presigned browser -> R2 uploads.
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
}

export interface Config {
  idleTtlSeconds: number;
  maxTtlSeconds: number;
  maxFileBytes: number;
  maxSessionBytes: number;
  maxItems: number;
  maxTextChars: number;
}

import { MAX_FILE_BYTES, MAX_SESSION_BYTES } from '../shared/limits';

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readConfig(env: Env): Config {
  return {
    idleTtlSeconds: num(env.SESSION_IDLE_TTL_SECONDS, 900),
    maxTtlSeconds: num(env.SESSION_MAX_TTL_SECONDS, 86_400),
    // Defaults come from the shared constants every piece of copy is written
    // from; wrangler.jsonc sets the same numbers so they can be tuned without
    // a deploy. A test asserts the two agree.
    maxFileBytes: num(env.MAX_FILE_BYTES, MAX_FILE_BYTES),
    maxSessionBytes: num(env.MAX_SESSION_BYTES, MAX_SESSION_BYTES),
    maxItems: num(env.MAX_ITEMS, 50),
    maxTextChars: num(env.MAX_TEXT_CHARS, 100_000),
  };
}

/** Presigned uploads are only possible when all four R2 S3 values are set. */
export function hasPresignCredentials(
  env: Env,
): env is Env & Required<Pick<Env, 'R2_ACCOUNT_ID' | 'R2_ACCESS_KEY_ID' | 'R2_SECRET_ACCESS_KEY' | 'R2_BUCKET_NAME'>> {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME);
}
