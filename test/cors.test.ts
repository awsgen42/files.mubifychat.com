import { describe, expect, it } from 'vitest';
import { allowedOrigins, corsHeaders, preflight, resolveOrigin } from '../worker/cors';
import type { Env } from '../worker/env';

const env = (origins?: string) => ({ ALLOWED_ORIGINS: origins }) as Env;

const req = (origin?: string, method = 'GET') =>
  new Request('https://api.example.com/api/sessions', {
    method,
    headers: origin ? { origin } : {},
  });

describe('allowedOrigins', () => {
  it('splits and trims the configured list', () => {
    expect(allowedOrigins(env('https://a.com, https://b.com'))).toEqual(['https://a.com', 'https://b.com']);
  });

  it('is empty when unset or blank', () => {
    expect(allowedOrigins(env())).toEqual([]);
    expect(allowedOrigins(env('  ,  '))).toEqual([]);
  });
});

describe('resolveOrigin', () => {
  it('accepts an allowlisted origin', () => {
    expect(resolveOrigin(req('https://app.vercel.app'), env('https://app.vercel.app'))).toBe(
      'https://app.vercel.app',
    );
  });

  it('rejects an origin that is not listed', () => {
    expect(resolveOrigin(req('https://evil.com'), env('https://app.vercel.app'))).toBeNull();
  });

  it('does not fall for a prefix or suffix that merely looks similar', () => {
    const allowed = env('https://app.vercel.app');
    expect(resolveOrigin(req('https://app.vercel.app.evil.com'), allowed)).toBeNull();
    expect(resolveOrigin(req('https://evil-app.vercel.app'), allowed)).toBeNull();
  });

  it('treats a missing Origin header as same-origin', () => {
    expect(resolveOrigin(req(), env('https://app.vercel.app'))).toBeNull();
  });

  it('rejects everything when no origins are configured', () => {
    expect(resolveOrigin(req('https://app.vercel.app'), env())).toBeNull();
  });
});

describe('corsHeaders', () => {
  it('emits nothing without an approved origin', () => {
    expect(corsHeaders(null)).toEqual({});
  });

  it('never answers with a wildcard', () => {
    const headers = corsHeaders('https://app.vercel.app');
    expect(headers['access-control-allow-origin']).toBe('https://app.vercel.app');
    expect(Object.values(headers)).not.toContain('*');
  });

  it('allows the Authorization header the client actually sends', () => {
    expect(corsHeaders('https://app.vercel.app')['access-control-allow-headers']).toContain('authorization');
  });

  it('does not enable credentials, since auth is header-based', () => {
    expect(corsHeaders('https://app.vercel.app')['access-control-allow-credentials']).toBeUndefined();
  });
});

describe('preflight', () => {
  it('ignores non-OPTIONS requests', () => {
    expect(preflight(req('https://app.vercel.app'), env('https://app.vercel.app'))).toBeNull();
  });

  it('answers 204 for an allowed origin', () => {
    const response = preflight(req('https://app.vercel.app', 'OPTIONS'), env('https://app.vercel.app'));
    expect(response?.status).toBe(204);
    expect(response?.headers.get('access-control-allow-origin')).toBe('https://app.vercel.app');
    expect(response?.headers.get('vary')).toBe('Origin');
  });

  it('answers 403 for an origin that is not allowed', () => {
    const response = preflight(req('https://evil.com', 'OPTIONS'), env('https://app.vercel.app'));
    expect(response?.status).toBe(403);
    expect(response?.headers.get('access-control-allow-origin')).toBeNull();
  });
});
