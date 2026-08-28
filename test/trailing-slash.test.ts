import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CANONICAL_REDIRECT_STATUS, canonicalRedirect } from '../shared/trailing-slash';

const at = (url: string) => canonicalRedirect(new URL(url, 'https://www.mubifiles.com'));

/**
 * Two URLs serving one page splits its ranking signal. Search Console carried
 * both /blog/send-a-file-too-big-for-email and .../email/ as separate rows,
 * 135 impressions against 127, for the same article.
 */
describe('the canonical form of a page URL', () => {
  it('sends the bare form to the slashed one', () => {
    expect(at('/blog/send-a-file-too-big-for-email')).toBe('/blog/send-a-file-too-big-for-email/');
    expect(at('/tools/split-file')).toBe('/tools/split-file/');
    expect(at('/blog')).toBe('/blog/');
  });

  it('leaves the slashed form alone, including the root', () => {
    expect(at('/')).toBeNull();
    expect(at('/blog/')).toBeNull();
    expect(at('/blog/send-a-file-too-big-for-email/')).toBeNull();
  });

  it('does not touch a file', () => {
    // A slash on any of these turns a working URL into a 404, which would be a
    // worse defect than the one being fixed.
    for (const file of [
      '/sw.js',
      '/og.png',
      '/favicon.ico',
      '/icon.svg',
      '/robots.txt',
      '/sitemap.xml',
      '/manifest.webmanifest',
      '/apple-touch-icon.png',
      '/_next/static/chunks/abc.js',
      '/blog/send-a-file-too-big-for-email/index.txt',
    ]) {
      expect(at(file), file).toBeNull();
    }
  });

  it('does not touch the API', () => {
    expect(at('/api/session')).toBeNull();
    expect(at('/api/session/123456')).toBeNull();
  });

  it('carries the query string across', () => {
    // A shared session is /?code=123456. Losing the query on the redirect
    // would break the link rather than tidy it.
    expect(at('/tools?code=123456')).toBe('/tools/?code=123456');
    expect(at('/blog/how-to-open-a-001-file?utm_source=x')).toBe(
      '/blog/how-to-open-a-001-file/?utm_source=x',
    );
  });

  it('redirects permanently', () => {
    // 301 and 308 are permanent; 302 and 307 are not. The asset server's own
    // trailing-slash handling issues a 307 in every mode, measured against
    // wrangler dev, which is why the Worker answers first.
    expect(CANONICAL_REDIRECT_STATUS).toBe(308);
  });
});

/**
 * The two host configurations, asserted from the files rather than assumed
 * from next.config.ts.
 *
 * `trailingSlash: true` in next.config.ts governs the links Next generates and
 * the dev server. It is not by itself a statement about what a deployment
 * serves when someone requests the bare form, and treating it as one is how
 * this went unnoticed.
 */
describe('what the hosts are configured to do', () => {
  it('vercel.json declares trailingSlash', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(vercel.trailingSlash).toBe(true);
  });

  it('vercel.json is strict JSON', () => {
    // It accepts no comments, so the reasoning for its contents lives here.
    expect(() => JSON.parse(readFileSync('vercel.json', 'utf8'))).not.toThrow();
  });

  it('the worker actually gets to run for a page request', () => {
    // run_worker_first was ["/api/*"], which meant the asset server answered
    // every page request first and the Worker never saw one. The redirect can
    // be perfectly correct and still never execute.
    const wrangler = readFileSync('wrangler.jsonc', 'utf8');
    expect(wrangler).toMatch(/"run_worker_first"\s*:\s*true/);
  });

  it('the worker redirects before the assets binding can answer', () => {
    const source = readFileSync('worker/index.ts', 'utf8');
    const redirect = source.indexOf('canonicalRedirect');
    const assets = source.indexOf('env.ASSETS.fetch');
    expect(redirect).toBeGreaterThan(-1);
    expect(assets).toBeGreaterThan(-1);
    // Order matters: after the assets binding, the 307 has already gone out.
    expect(redirect).toBeLessThan(assets);
  });
});
