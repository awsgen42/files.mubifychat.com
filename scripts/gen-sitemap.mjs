/**
 * Writes out/sitemap.xml from the static export.
 *
 * Replaces a hand-maintained public/sitemap.xml, which had nothing tying it to
 * the routes that actually build — a page could ship unlisted, or a listed URL
 * could stop existing, and neither would show up until Search Console did.
 *
 * Runs after `next build`, alongside gen-sw.mjs, for the same reason: the list
 * can only be built from what the export contains.
 *
 * Usage: node scripts/gen-sitemap.mjs
 */
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = 'out';
const SITE_URL = 'https://www.mubifiles.com';

/**
 * Below this, something has gone wrong rather than pages having been removed.
 *
 * The failure that matters here is not a crash — it is a generator that emits
 * an empty or truncated list, deploys green, and quietly drops URLs out of the
 * index. Removing a page is rare and deliberate; if this number needs lowering,
 * lower it in the same commit that removes the page.
 */
const MIN_URLS = 6;

/**
 * Deliberately NO <lastmod>.
 *
 * The obvious implementation stamps build time on every URL, which tells
 * Google that all of them changed on every deploy. That is false, and the
 * documented consequence is that the signal stops being trusted. Per-URL git
 * mtimes would be real, but `git log` for a page's content is not the same as
 * the page having meaningfully changed, and the export has no per-route source
 * of truth for it. An absent lastmod is honest; a wrong one is worse than
 * none.
 *
 * changefreq and priority are hand-set editorial values, not derived — which
 * is why they live in a table rather than being computed.
 */
const ROUTES = [
  { url: '/', changefreq: 'weekly', priority: '1.0' },
  { url: '/snapdrop-alternative/', changefreq: 'monthly', priority: '0.8' },
  { url: '/send-files-between-different-networks/', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/', changefreq: 'monthly', priority: '0.7' },
  { url: '/tools/checksum/', changefreq: 'monthly', priority: '0.7' },
  { url: '/report/', changefreq: 'yearly', priority: '0.3' },
  { url: '/privacy/', changefreq: 'yearly', priority: '0.3' },
  { url: '/terms/', changefreq: 'yearly', priority: '0.3' },
];

const DEFAULTS = { changefreq: 'monthly', priority: '0.5' };

/**
 * Routes that build but must never be listed, with the reason each is here.
 * Explicit rather than incidental: a sitemap is a list of pages we are asking
 * to have indexed, and every omission should be a decision someone made.
 *
 *   /404/            Next emits both 404.html and 404/index.html for the
 *                    not-found route. A 404 page is not indexable content;
 *                    gen-sw.mjs is right to precache it, and this is right not
 *                    to list it. The two lists have different jobs.
 *   /_not-found/     The App Router's internal name for the same page.
 *
 * Not listed here because they are excluded by the file filter instead:
 * every non-HTML asset (og.png, sw.js, manifest.webmanifest, robots.txt,
 * sitemap.xml itself, the _next bundles, the __next.*.txt RSC payloads and
 * index.txt). A sitemap lists pages, so only index.html files are considered
 * at all.
 *
 * Checked and deliberately not an issue: a shared session is `/?code=123456`,
 * a query string on the home page rather than a route of its own, so it never
 * appears in the export and cannot leak in here. It is kept out of the index
 * by the X-Robots-Tag rule in vercel.json, which is a separate mechanism and
 * remains the one that matters for it.
 */
const EXCLUDED_ROUTES = new Set(['/404/', '/_not-found/']);

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else found.push(path);
  }
  return found;
}

/**
 * The URL a page is served at. `trailingSlash: true` means the export writes
 * `privacy/index.html` and the browser asks for `/privacy/`, so the sitemap,
 * the canonical tag and the breadcrumb must all agree on that form rather than
 * pointing at a redirect.
 */
function toUrl(path) {
  const rel = relative(OUT, path).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return null;
}

const built = new Set(
  walk(OUT)
    .map(toUrl)
    .filter((url) => url !== null && !EXCLUDED_ROUTES.has(url)),
);

// A table entry with no page behind it is a stale row pointing at a 404.
const missing = ROUTES.filter((route) => !built.has(route.url)).map((route) => route.url);
if (missing.length > 0) {
  throw new Error(
    `gen-sitemap: these are listed but did not build: ${missing.join(', ')}. ` +
      'Remove them from ROUTES or fix the route.',
  );
}

// A page with no table entry still gets listed — failing to index a new page
// is the worse outcome — but it is announced so the priority can be set.
const declared = new Set(ROUTES.map((route) => route.url));
const undeclared = [...built].filter((url) => !declared.has(url)).sort();
for (const url of undeclared) {
  console.warn(`gen-sitemap: ${url} has no entry in ROUTES; using ${DEFAULTS.priority}/${DEFAULTS.changefreq}`);
}

const entries = [
  ...ROUTES.filter((route) => built.has(route.url)),
  ...undeclared.map((url) => ({ url, ...DEFAULTS })),
];

if (entries.length < MIN_URLS) {
  throw new Error(
    `gen-sitemap: only ${entries.length} URLs, expected at least ${MIN_URLS}. ` +
      'Refusing to write a sitemap that would drop pages out of the index.',
  );
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries.flatMap((entry) => [
    '  <url>',
    `    <loc>${SITE_URL}${entry.url}</loc>`,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    '  </url>',
  ]),
  '</urlset>',
  '',
].join('\n');

writeFileSync(join(OUT, 'sitemap.xml'), xml);
console.log(`gen-sitemap: ${entries.length} URLs`);
