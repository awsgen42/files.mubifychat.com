/**
 * The sitemap's editorial table, and the rules about what is left out.
 *
 * This used to live in scripts/gen-sitemap.mjs, which ran as a step in the
 * build command. That was the bug: a step in a command string can be dropped,
 * and when it was, the build still succeeded and /sitemap.xml became a 404.
 * A route file cannot be dropped that way — `next build` emits it or it emits
 * nothing at all.
 */

export const SITE_URL = 'https://www.mubifiles.com';

/**
 * Below this, something has gone wrong rather than pages having been removed.
 * Removing a page is rare and deliberate; if this needs lowering, lower it in
 * the same commit that removes the page.
 */
export const MIN_URLS = 6;

export interface RouteMeta {
  changefreq: 'weekly' | 'monthly' | 'yearly';
  priority: number;
}

/**
 * Deliberately NO lastmod anywhere.
 *
 * The obvious implementation stamps build time on every URL, which tells Google
 * that all of them changed on every deploy. That is false, and the documented
 * consequence is that the signal stops being trusted. An absent lastmod is
 * honest; a wrong one is worse than none.
 *
 * changefreq and priority are hand-set editorial values, not derived — which is
 * why they live in a table rather than being computed.
 */
export const ROUTE_META: Record<string, RouteMeta> = {
  '/': { changefreq: 'weekly', priority: 1.0 },
  '/snapdrop-alternative/': { changefreq: 'monthly', priority: 0.8 },
  '/send-files-between-different-networks/': { changefreq: 'monthly', priority: 0.8 },
  '/tools/': { changefreq: 'monthly', priority: 0.7 },
  '/tools/checksum/': { changefreq: 'monthly', priority: 0.7 },
  '/tools/qr/': { changefreq: 'monthly', priority: 0.7 },
  '/tools/image-compress/': { changefreq: 'monthly', priority: 0.7 },
  '/tools/video-frames/': { changefreq: 'monthly', priority: 0.7 },
  '/tools/split-file/': { changefreq: 'monthly', priority: 0.7 },
  '/blog/': { changefreq: 'monthly', priority: 0.6 },
  '/blog/how-to-open-a-001-file/': { changefreq: 'yearly', priority: 0.6 },
  '/blog/send-a-file-too-big-for-email/': { changefreq: 'yearly', priority: 0.6 },
  '/blog/verify-a-download-with-sha256/': { changefreq: 'yearly', priority: 0.6 },
  '/blog/extract-frames-from-video-without-uploading/': { changefreq: 'yearly', priority: 0.6 },
  '/blog/the-risk-of-uploading-files-to-online-tools/': { changefreq: 'yearly', priority: 0.6 },
  '/report/': { changefreq: 'yearly', priority: 0.3 },
  '/privacy/': { changefreq: 'yearly', priority: 0.3 },
  '/terms/': { changefreq: 'yearly', priority: 0.3 },
};

export const DEFAULT_META: RouteMeta = { changefreq: 'monthly', priority: 0.5 };

/**
 * Routes that build but must never be listed, with the reason each is here.
 * Explicit rather than incidental: a sitemap is a list of pages we are asking
 * to have indexed, and every omission should be a decision someone made.
 *
 *   /404/         A 404 page is not indexable content. gen-sw.mjs is right to
 *                 precache it and this is right not to list it; the two lists
 *                 have different jobs.
 *   /_not-found/  The App Router's internal name for the same page.
 *
 * A shared session is `/?code=123456` — a query string on the home page rather
 * than a route of its own — so it never appears here. It is kept out of the
 * index by the X-Robots-Tag rule in vercel.json, which is a separate mechanism
 * and remains the one that matters for it.
 */
export const EXCLUDED_ROUTES = new Set(['/404/', '/_not-found/']);
