export interface Env {
  SESSIONS: KVNamespace;
  FILES: R2Bucket;
  ASSETS: Fetcher;

  SESSION_IDLE_TTL_SECONDS: string;
  SESSION_MAX_TTL_SECONDS: string;
  MAX_FILE_BYTES: string;
  MAX_SESSION_BYTES: string;
  MAX_ITEMS: string;
  MAX_TEXT_CHARS: string;

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

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readConfig(env: Env): Config {
  return {
    idleTtlSeconds: num(env.SESSION_IDLE_TTL_SECONDS, 900),
    maxTtlSeconds: num(env.SESSION_MAX_TTL_SECONDS, 86_400),
    maxFileBytes: num(env.MAX_FILE_BYTES, 100 * 1024 * 1024),
    maxSessionBytes: num(env.MAX_SESSION_BYTES, 500 * 1024 * 1024),
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
