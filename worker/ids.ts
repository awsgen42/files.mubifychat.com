/** Code / token generation and the small amount of hardening around them. */

const CODE_LENGTH = 6;
const CODE_SPACE = 10 ** CODE_LENGTH; // 000000-999999

/**
 * Uniformly random 6-digit code. Rejection sampling avoids the modulo bias a
 * plain `% 1_000_000` would introduce, which matters because the code is the
 * only secret guarding an anonymous session.
 */
export function generateCode(): string {
  const buffer = new Uint32Array(1);
  const limit = Math.floor(0xffff_ffff / CODE_SPACE) * CODE_SPACE;
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return String(value % CODE_SPACE).padStart(CODE_LENGTH, '0');
}

export function isValidCode(code: unknown): code is string {
  return typeof code === 'string' && /^[0-9]{6}$/.test(code);
}

/** Strips separators people naturally type, e.g. "123 456" or "123-456". */
export function normalizeCode(input: string): string {
  return input.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
}

export function randomId(bytes = 12): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(): string {
  return randomId(32);
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison so token checks don't leak a prefix. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
