/**
 * One URL per page.
 *
 * Every page in the export is `<path>/index.html`, and the sitemap, canonical
 * tags, og:url, the JSON-LD and every internal link use the trailing-slash
 * form. The bare form has to redirect to it — permanently, so a crawler
 * collapses the two rather than keeping both.
 *
 * This lives in shared/ because the Worker enforces it and the tests check it,
 * and the rule is worth stating once. It is deliberately not a regex in a
 * config file: the two cases it must not touch — a path that already ends in a
 * slash, and a request for a file — are exactly the cases a regex gets wrong.
 */

/**
 * Where a request should be redirected, or null if the URL is already the one
 * URL for that page.
 *
 * Rules, in order:
 *   - anything under /api/ is not a page and is left alone
 *   - a path that already ends in "/" is canonical
 *   - a last segment containing a dot is a file — /sw.js, /og.png, /favicon.ico
 *     — and adding a slash to it would 404 something that currently works
 *   - everything else gets the slash, with the query string carried over
 */
export function canonicalRedirect(url: URL): string | null {
  const { pathname } = url;
  if (pathname.startsWith('/api/')) return null;
  if (pathname.endsWith('/')) return null;

  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (lastSegment.includes('.')) return null;
  if (lastSegment === '') return null;

  // The query string survives: a shared session is /?code=123456, and losing
  // the query on a redirect would break the link rather than tidy it.
  return `${pathname}/${url.search}`;
}

/** 308, not 301: it is the one that also guarantees the method is preserved. */
export const CANONICAL_REDIRECT_STATUS = 308;
