import { describe, expect, it } from 'vitest';
import { contentDisposition, normalizeContentType, sanitizeFilename } from '../worker/files';
import { generateCode, isValidCode, normalizeCode, timingSafeEqual } from '../worker/ids';
import { idleExpiresAt, isExpired, sessionIdFromObjectKey, ttlSeconds, type StoredSession } from '../worker/session';
import type { Config, Env } from '../worker/env';
import { enforcePollLimit } from '../worker/ratelimit';

const config: Config = {
  idleTtlSeconds: 900,
  maxTtlSeconds: 86_400,
  maxFileBytes: 100 * 1024 * 1024,
  maxSessionBytes: 500 * 1024 * 1024,
  maxItems: 50,
  maxTextChars: 100_000,
};

function session(overrides: Partial<StoredSession> = {}): StoredSession {
  const now = 1_700_000_000_000;
  return {
    id: 'abc123',
    code: '123456',
    status: 'active',
    oneShot: false,
    createdAt: now,
    lastActivity: now,
    hardExpiresAt: now + config.maxTtlSeconds * 1000,
    version: 1,
    bytesUsed: 0,
    participants: [],
    items: [],
    ...overrides,
  };
}

describe('codes', () => {
  it('always generates a valid 6-digit code, including leading zeros', () => {
    for (let i = 0; i < 500; i++) expect(isValidCode(generateCode())).toBe(true);
  });

  it('rejects anything that is not exactly six digits', () => {
    for (const value of ['12345', '1234567', 'abcdef', '12 456', '', null, 123456]) {
      expect(isValidCode(value)).toBe(false);
    }
  });

  it('strips the separators people type', () => {
    expect(normalizeCode('123 456')).toBe('123456');
    expect(normalizeCode('123-456')).toBe('123456');
    expect(normalizeCode('12345678')).toBe('123456');
  });
});

describe('timingSafeEqual', () => {
  it('matches identical strings and rejects differing ones', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('filenames', () => {
  it('strips path separators so an upload cannot escape its name', () => {
    // Separators become underscores, then any leading dots are dropped so the
    // result can never be a relative path or a hidden file.
    expect(sanitizeFilename('../../etc/passwd')).toBe('_.._etc_passwd');
    expect(sanitizeFilename('C:\\Windows\\system32')).toBe('C__Windows_system32');
  });

  it('removes control characters and header-splitting newlines', () => {
    expect(sanitizeFilename('re\r\nport.pdf')).toBe('re  port.pdf');
    expect(sanitizeFilename('a"b.txt')).toBe('a_b.txt');
  });

  it('falls back to a placeholder for empty or hostile input', () => {
    expect(sanitizeFilename('')).toBe('file');
    expect(sanitizeFilename('...')).toBe('file');
    expect(sanitizeFilename(undefined)).toBe('file');
  });

  it('keeps unicode names intact', () => {
    expect(sanitizeFilename('résumé 履歴書.pdf')).toBe('résumé 履歴書.pdf');
  });

  it('emits both an ASCII and an encoded filename in the disposition header', () => {
    const header = contentDisposition('résumé.pdf');
    expect(header).toContain('attachment;');
    expect(header).toContain('filename="r_sum_.pdf"');
    expect(header).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9.pdf");
  });
});

describe('content types', () => {
  it('accepts well-formed types and drops parameters', () => {
    expect(normalizeContentType('text/plain; charset=utf-8')).toBe('text/plain');
    expect(normalizeContentType('IMAGE/PNG')).toBe('image/png');
  });

  it('falls back to a binary type for anything malformed', () => {
    for (const value of ['not a type', '', undefined, 'text/<script>']) {
      expect(normalizeContentType(value)).toBe('application/octet-stream');
    }
  });
});

describe('session expiry', () => {
  const now = 1_700_000_000_000;

  it('slides the deadline forward with activity', () => {
    const fresh = session({ lastActivity: now });
    expect(idleExpiresAt(fresh, config)).toBe(now + 900_000);
    expect(isExpired(fresh, config, now + 899_000)).toBe(false);
    expect(isExpired(fresh, config, now + 901_000)).toBe(true);
  });

  it('never slides past the 24h hard cap', () => {
    const nearlyOver = session({ lastActivity: now, hardExpiresAt: now + 60_000 });
    expect(idleExpiresAt(nearlyOver, config)).toBe(now + 60_000);
  });

  it('treats a closed session as expired regardless of the clock', () => {
    expect(isExpired(session({ status: 'closed' }), config, now)).toBe(true);
  });

  it('caps the KV TTL by the remaining hard lifetime and respects the 60s floor', () => {
    expect(ttlSeconds(session(), config, now)).toBe(900);
    expect(ttlSeconds(session({ hardExpiresAt: now + 120_000 }), config, now)).toBe(120);
    expect(ttlSeconds(session({ hardExpiresAt: now + 1_000 }), config, now)).toBe(60);
  });
});

describe('garbage collection keys', () => {
  it('recovers the session id from an object key', () => {
    expect(sessionIdFromObjectKey('sessions/abc123/def456')).toBe('abc123');
    expect(sessionIdFromObjectKey('sessions/')).toBe('');
  });
});

describe('poll rate limit', () => {
  const envWith = (results: boolean[]) => {
    const calls: string[] = [];
    let i = 0;
    return {
      calls,
      env: {
        POLL_LIMITER: {
          limit: async ({ key }: { key: string }) => {
            calls.push(key);
            return { success: results[i++] ?? true };
          },
        },
      } as unknown as Env,
    };
  };

  it('allows a request the limiter accepts', async () => {
    const { env, calls } = envWith([true]);
    await expect(enforcePollLimit(env, '203.0.113.9')).resolves.toBeUndefined();
    expect(calls).toEqual(['203.0.113.9']);
  });

  it('rejects with 429 once the limiter refuses', async () => {
    const { env } = envWith([false]);
    await expect(enforcePollLimit(env, '203.0.113.9')).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
    });
  });

  it('keys the limit on the client IP, so one abuser cannot lock out others', async () => {
    const { env, calls } = envWith([true, true]);
    await enforcePollLimit(env, '203.0.113.1');
    await enforcePollLimit(env, '203.0.113.2');
    expect(calls).toEqual(['203.0.113.1', '203.0.113.2']);
  });

  it('skips the limiter when the IP is unknown rather than failing closed', async () => {
    const { env, calls } = envWith([false]);
    await expect(enforcePollLimit(env, 'unknown')).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });
});
