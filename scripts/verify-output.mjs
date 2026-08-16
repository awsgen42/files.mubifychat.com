/**
 * The last step of a production build: refuse to ship an output directory that
 * is missing something a search engine or a browser depends on.
 *
 * This exists because of a failure that was silent for as long as it lasted.
 * public/sitemap.xml was a real file, so it could not go missing; replacing it
 * with a post-build script moved it into the build command, and a build command
 * is a string that can lose a step — or never have had it. A deploy running
 * `next build` produces a complete, working site with no sitemap in it and exit
 * code 0. The sitemap is a route again now, so that particular hole is closed,
 * but sw.js still comes from a post-build step and the tests that would catch
 * either are skipped when out/ is absent, which it is when `npm test` runs
 * before the build.
 *
 * So the rule is: the artifacts are named here, and their absence is a build
 * failure rather than a thing someone notices in Search Console eight weeks
 * later.
 *
 * Usage: node scripts/verify-output.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = 'out';
const SITE_URL = 'https://www.mubifiles.com';

/** Re-checked here against the built file, not just asserted in the route. */
const MIN_URLS = 6;

const problems = [];
const fail = (message) => problems.push(message);
const ok = [];

/* ------------------------------------------------------------------ */
/* The directory itself                                                */
/* ------------------------------------------------------------------ */

if (!existsSync(OUT)) {
  console.error(`verify-output: ${OUT}/ does not exist. The export did not run.`);
  process.exit(1);
}

/**
 * The deploy config has to point at the directory that was just verified.
 * Verifying out/ and shipping something else would be a check that passes
 * while the site stays broken.
 */
const wrangler = readFileSync('wrangler.jsonc', 'utf8');
const assetsDir = /"directory"\s*:\s*"([^"]+)"/.exec(wrangler)?.[1] ?? null;
if (assetsDir === null) fail('wrangler.jsonc has no assets.directory — cannot tell what would be deployed.');
else if (assetsDir.replace(/^\.\//, '').replace(/\/$/, '') !== OUT) {
  fail(`wrangler.jsonc deploys ${assetsDir} but this verified ${OUT}/. One of them is wrong.`);
} else ok.push(`wrangler assets.directory is ${assetsDir}, which is what was verified`);

/* ------------------------------------------------------------------ */
/* sitemap.xml                                                         */
/* ------------------------------------------------------------------ */

const sitemapPath = join(OUT, 'sitemap.xml');
let locs = [];
if (!existsSync(sitemapPath)) {
  fail('out/sitemap.xml is missing. app/sitemap.ts did not emit — this build did not export it.');
} else {
  const xml = readFileSync(sitemapPath, 'utf8');
  if (readFileSync(sitemapPath).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    fail('out/sitemap.xml starts with a byte-order mark, which some parsers reject.');
  }
  if (!xml.startsWith('<?xml')) fail('out/sitemap.xml does not start with an XML declaration.');
  if (!xml.includes('<urlset')) fail('out/sitemap.xml has no <urlset> element.');
  locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  if (locs.length < MIN_URLS) {
    fail(`out/sitemap.xml lists ${locs.length} URLs, fewer than the ${MIN_URLS} floor.`);
  }
  const foreign = locs.filter((url) => !url.startsWith(`${SITE_URL}/`));
  if (foreign.length > 0) fail(`out/sitemap.xml lists URLs on another host: ${foreign.slice(0, 3).join(', ')}`);
  const duplicates = locs.filter((url, i) => locs.indexOf(url) !== i);
  if (duplicates.length > 0) fail(`out/sitemap.xml lists ${duplicates[0]} more than once.`);
  if (problems.length === 0) ok.push(`out/sitemap.xml: ${locs.length} URLs, all on ${SITE_URL}`);
}

/**
 * And every listed URL has to be a page that actually built — a sitemap of
 * 404s is worse than no sitemap, and is the shape a stale generator produces.
 */
const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const builtPages = new Set(
  walk(OUT)
    .map((path) => relative(OUT, path).split(sep).join('/'))
    .filter((rel) => rel === 'index.html' || rel.endsWith('/index.html'))
    .map((rel) => (rel === 'index.html' ? '/' : `/${rel.slice(0, -'index.html'.length)}`)),
);
const dead = locs.map((url) => url.replace(SITE_URL, '')).filter((path) => !builtPages.has(path));
if (dead.length > 0) fail(`out/sitemap.xml lists pages that did not build: ${dead.slice(0, 3).join(', ')}`);

/* ------------------------------------------------------------------ */
/* robots.txt                                                          */
/* ------------------------------------------------------------------ */

const robotsPath = join(OUT, 'robots.txt');
if (!existsSync(robotsPath)) {
  fail('out/robots.txt is missing, so nothing points a crawler at the sitemap.');
} else {
  const robots = readFileSync(robotsPath, 'utf8');
  const declared = /^\s*Sitemap:\s*(\S+)\s*$/im.exec(robots)?.[1] ?? null;
  if (declared === null) fail('out/robots.txt has no Sitemap: line.');
  else if (declared !== `${SITE_URL}/sitemap.xml`) {
    // A sitemap announced on the apex while every canonical says www is a
    // cross-host reference, and Search Console treats it as one.
    fail(`out/robots.txt announces ${declared}, not ${SITE_URL}/sitemap.xml.`);
  } else ok.push(`out/robots.txt points at ${declared}`);
}

/* ------------------------------------------------------------------ */
/* the service worker, which has its own way of going quietly wrong    */
/* ------------------------------------------------------------------ */

const swPath = join(OUT, 'sw.js');
if (!existsSync(swPath)) fail('out/sw.js is missing.');
else {
  const sw = readFileSync(swPath, 'utf8');
  // The two gen-sw.mjs substitutes, named exactly. A pattern like /__[A-Z_]+__/
  // looks more thorough and is wrong: the precache list legitimately contains
  // thirteen `__PAGE__` RSC payload URLs, and a check that fails on correct
  // output would be turned off within a week.
  const unfilled = ["'__BUILD_ID__'", "['__PRECACHE__']"].filter((token) => sw.includes(token));
  if (unfilled.length > 0) fail(`out/sw.js still contains unreplaced ${unfilled.join(' and ')}.`);
  else ok.push('out/sw.js has both placeholders replaced');
}

if (!existsSync(join(OUT, 'index.html'))) fail('out/index.html is missing.');

/* ------------------------------------------------------------------ */

for (const line of ok) console.log(`verify-output: ok — ${line}`);
if (problems.length > 0) {
  console.error('');
  for (const problem of problems) console.error(`verify-output: ${problem}`);
  console.error('');
  console.error('Refusing to finish the build. These are served files; a missing one is a');
  console.error('production 404 that no local check would catch.');
  process.exit(1);
}
console.log(`verify-output: ${ok.length} checks passed`);
