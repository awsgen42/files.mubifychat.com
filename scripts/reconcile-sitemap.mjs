/**
 * Prints every page the export produced, the URL it is served at, and either
 * its sitemap entry or the named rule that kept it out. Nothing is allowed to
 * be unaccounted for in either direction.
 *
 * This exists because two counters disagreed — 15 built pages against 12
 * sitemap entries — and the gap turned out to be a definition rather than a
 * missing page. Next writes the not-found route twice, as 404.html and as
 * 404/index.html; they are one page served at one URL, and a counter that
 * treats every HTML file as a page counts it twice. The sitemap generator's
 * own counter never did, which is why it did not notice. Here both counters
 * are the same counter: a page is a served URL.
 *
 * Usage: node scripts/reconcile-sitemap.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = 'out';
const SITE_URL = 'https://www.mubifiles.com';

/** The rules, each with the reason it exists, quoted in the output. */
const RULES = {
  '/404/': 'not indexable: a 404 is a status, not content (lib/routes.ts EXCLUDED_ROUTES)',
  '/_not-found/': "not indexable: the App Router's internal name for the same page (lib/routes.ts EXCLUDED_ROUTES)",
  '/tools/instagram-data-download-viewer/': 'under construction, deliberately unlisted (lib/routes.ts EXCLUDED_ROUTES)',
};

/** Files that are the same page as another URL, not a page of their own. */
const ALIASES = { '404.html': '/404/' };

if (!existsSync(OUT)) {
  console.error('reconcile-sitemap: no out/ — run npm run build first.');
  process.exit(2);
}

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const htmlFiles = walk(OUT)
  .map((path) => relative(OUT, path).split(sep).join('/'))
  .filter((rel) => rel.endsWith('.html'))
  .sort();

/** file -> served URL, or null if the file is not served as a page at all. */
function servedUrl(rel) {
  if (ALIASES[rel]) return ALIASES[rel];
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return null;
}

const sitemap = readFileSync(join(OUT, 'sitemap.xml'), 'utf8');
const entries = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>\s*<changefreq>([^<]*)<\/changefreq>\s*<priority>([^<]*)<\/priority>/g)].map(
  (m) => ({ url: m[1].replace(SITE_URL, ''), changefreq: m[2], priority: m[3] }),
);
const listed = new Map(entries.map((e) => [e.url, e]));

const rows = [];
const pages = new Set();
for (const rel of htmlFiles) {
  const url = servedUrl(rel);
  if (url === null) {
    rows.push({ rel, url: '—', verdict: 'not a page: no URL serves this file', ok: true });
    continue;
  }
  const alias = ALIASES[rel] ? ` (same page as ${url}, written twice by Next)` : '';
  const entry = listed.get(url);
  if (entry) {
    pages.add(url);
    rows.push({ rel, url, verdict: `sitemap: priority ${entry.priority}, ${entry.changefreq}${alias}`, ok: true });
  } else if (RULES[url]) {
    pages.add(url);
    rows.push({ rel, url, verdict: `excluded — ${RULES[url]}${alias}`, ok: true });
  } else {
    pages.add(url);
    rows.push({ rel, url, verdict: 'UNACCOUNTED: built, not listed, and no rule excludes it', ok: false });
  }
}

const width = Math.max(...rows.map((r) => r.rel.length));
console.log('file'.padEnd(width), ' served as'.padEnd(42), 'verdict');
console.log('-'.repeat(width + 44 + 40));
for (const row of rows) {
  console.log(`${row.rel.padEnd(width)}  ${row.url.padEnd(41)} ${row.verdict}`);
}

const orphans = entries.filter((e) => !pages.has(e.url));
for (const entry of orphans) {
  console.log(`${'(none)'.padEnd(width)}  ${entry.url.padEnd(41)} UNACCOUNTED: listed in the sitemap but no page built`);
}

const uniquePages = pages.size;
const excluded = [...pages].filter((url) => RULES[url]).length;
const unaccounted = rows.filter((r) => !r.ok).length + orphans.length;

console.log('');
console.log(`  HTML files in out/     : ${htmlFiles.length}`);
console.log(`  pages (distinct URLs)  : ${uniquePages}   <- ${htmlFiles.length - uniquePages} file(s) are a second copy of a page, not a page`);
console.log(`  excluded by rule       : ${excluded}`);
console.log(`  sitemap <loc> entries  : ${entries.length}`);
console.log(`  ${uniquePages} - ${excluded} = ${uniquePages - excluded}, sitemap has ${entries.length} — ${uniquePages - excluded === entries.length ? 'they agree' : 'THEY DO NOT AGREE'}`);
console.log(`  unaccounted            : ${unaccounted}`);

process.exit(unaccounted === 0 && uniquePages - excluded === entries.length ? 0 : 1);
