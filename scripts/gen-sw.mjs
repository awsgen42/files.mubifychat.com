/**
 * Fills in the service worker's precache list from the static export.
 *
 * Runs after `next build`, because the list can only be built from what the
 * export actually contains — asset filenames are content-hashed, so hardcoding
 * them would go stale on every build and precache 404s reject install
 * silently.
 *
 * Usage: node scripts/gen-sw.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = 'out';
const SW = join(OUT, 'sw.js');

/** Source maps are for debugging and the worker must not cache itself. */
const EXCLUDED = (name) => name.endsWith('.map') || name === 'sw.js';

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else if (!EXCLUDED(entry)) found.push(path);
  }
  return found;
}

/**
 * The URL a file is actually requested at, which is not its path on disk.
 *
 * `trailingSlash: true` means the export writes `privacy/index.html` but the
 * browser asks for `/privacy/`. Precaching the disk path would leave every
 * page uncached under the URL it is fetched by — the cache would look full and
 * match nothing.
 */
function toUrl(path) {
  const rel = relative(OUT, path).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

const files = walk(OUT).sort();
if (files.length === 0) throw new Error('gen-sw: out/ is empty — run `next build` first.');

const urls = [...new Set(files.map(toUrl))].sort();

/**
 * Version derived from the content of everything precached, so a build that
 * changed nothing keeps its cache and a build that changed anything replaces
 * it wholesale. A timestamp would evict the cache on every deploy for nothing.
 */
const hash = createHash('sha256');
for (const path of files) {
  hash.update(relative(OUT, path));
  hash.update(readFileSync(path));
}
const buildId = hash.digest('hex').slice(0, 12);

let source = readFileSync(SW, 'utf8');
for (const [placeholder, value] of [
  ["'__BUILD_ID__'", JSON.stringify(buildId)],
  ["['__PRECACHE__']", JSON.stringify(urls)],
]) {
  if (!source.includes(placeholder)) {
    throw new Error(`gen-sw: ${placeholder} not found in ${SW} — the worker would ship unreplaced.`);
  }
  source = source.replace(placeholder, value);
}

writeFileSync(SW, source);

const bytes = files.reduce((total, path) => total + statSync(path).size, 0);
console.log(`gen-sw: ${urls.length} URLs, ${(bytes / 1024).toFixed(0)} KB, build ${buildId}`);
