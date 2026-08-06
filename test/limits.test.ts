import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  IP_DAILY_BYTE_QUOTA,
  MAX_FILE_BYTES,
  MAX_SESSION_BYTES,
  QUOTA_KEY_TTL_SECONDS,
  formatLimit,
} from '../shared/limits';

/**
 * The limits live in two places by design: shared/limits.ts, which every piece
 * of user-facing copy is generated from, and wrangler.jsonc, which lets them be
 * tuned without a code change. Two places means they can disagree, and the
 * failure would be silent and bad — the site advertising one limit while the
 * API enforced another. This is the guard.
 */
function wranglerVars(): Record<string, string> {
  const raw = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  // Strip // comments; the file is JSONC and JSON.parse will not take them.
  const json = raw.replace(/^\s*\/\/.*$/gm, '');
  return (JSON.parse(json) as { vars: Record<string, string> }).vars;
}

describe('configured limits', () => {
  it('matches wrangler.jsonc, which is what production actually enforces', () => {
    const vars = wranglerVars();
    expect(Number(vars.MAX_FILE_BYTES)).toBe(MAX_FILE_BYTES);
    expect(Number(vars.MAX_SESSION_BYTES)).toBe(MAX_SESSION_BYTES);
  });

  it('holds more than one file per session', () => {
    // A session cap equal to two files makes a one-file session in practice,
    // once anything else has been shared. Three is the point of the raise.
    expect(MAX_SESSION_BYTES / MAX_FILE_BYTES).toBeGreaterThanOrEqual(3);
  });

  it('lets a full session through the daily quota', () => {
    // If one session could exhaust the day's budget, a single ordinary use
    // would lock the address out — which is what a 3 GB quota would have done.
    expect(IP_DAILY_BYTE_QUOTA).toBeGreaterThan(MAX_SESSION_BYTES);
  });

  it('keeps the quota counter alive across the day it counts', () => {
    expect(QUOTA_KEY_TTL_SECONDS).toBeGreaterThanOrEqual(24 * 60 * 60);
  });

  it('is exact in float64 and safe to send as JSON', () => {
    for (const value of [MAX_FILE_BYTES, MAX_SESSION_BYTES, IP_DAILY_BYTE_QUOTA]) {
      expect(Number.isSafeInteger(value)).toBe(true);
      expect(JSON.parse(JSON.stringify({ value })).value).toBe(value);
    }
  });
});

describe('formatLimit', () => {
  it('writes a limit as the round number it is', () => {
    expect(formatLimit(MAX_FILE_BYTES)).toBe('1 GB');
    expect(formatLimit(MAX_SESSION_BYTES)).toBe('3 GB');
    expect(formatLimit(IP_DAILY_BYTE_QUOTA)).toBe('10 GB');
  });

  it('falls back to megabytes below a gigabyte', () => {
    expect(formatLimit(100 * 1024 * 1024)).toBe('100 MB');
    expect(formatLimit(500 * 1024 * 1024)).toBe('500 MB');
  });

  it('keeps one decimal for values that are not round', () => {
    expect(formatLimit(1536 * 1024 * 1024)).toBe('1.5 GB');
    expect(formatLimit(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});
