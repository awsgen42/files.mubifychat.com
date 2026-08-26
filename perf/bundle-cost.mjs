/**
 * Shipped-bytes cost of each zip library, measured at the bundle rather than
 * from the package's unpacked size.
 *
 * "Tree-shakeable" is a claim; this counts the JavaScript the browser actually
 * downloads for the page and its worker, in a production static build. Three
 * variants of the same worker are built in turn — no zip library, zip.js,
 * fflate — and every .js response is summed.
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';

const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const WORKER = `${REPO}/lib/instagram/probe.worker.ts`;
const original = readFileSync(WORKER, 'utf8');

const VARIANTS = Object.fromEntries(
  ['none', 'zipjs', 'fflate'].map((name) => [
    name,
    readFileSync(`${import.meta.dirname}/variants/${name}.ts`, 'utf8'),
  ]),
);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

const results = {};
for (const [name, source] of Object.entries(VARIANTS)) {
  writeFileSync(WORKER, source);
  try {
    execSync('npx next build', { cwd: REPO, stdio: 'pipe' });
  } catch (error) {
    console.log(`  ${name}: BUILD FAILED — ${String(error.stderr ?? error).slice(-400)}`);
    results[name] = null;
    continue;
  }
  // No server restart: `serve` reads from disk per request, so a rebuilt out/
  // is picked up as-is. An earlier version killed and restarted it with pkill,
  // which matched this script's own process tree and SIGTERMed the run.

  const page = await browser.newPage();
  const js = new Map();
  page.on('response', async (r) => {
    if (!/\.js(\?|$)/.test(r.url())) return;
    try {
      const body = await r.body();
      js.set(r.url(), body.length);
    } catch {}
  });
  await page.goto('http://127.0.0.1:8791/tools/instagram-data-download-viewer/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500); // let the worker's own chunks load
  const total = [...js.values()].reduce((a, b) => a + b, 0);
  results[name] = { files: js.size, bytes: total };
  console.log(`  ${name.padEnd(7)} ${js.size} js files, ${total} bytes (${(total / 1024).toFixed(0)} KB)`);
  await page.close();
}

writeFileSync(WORKER, original);
await browser.close();

const base = results.none?.bytes ?? 0;
console.log('\n=== delta over the no-zip-library build ===');
for (const lib of ['zipjs', 'fflate']) {
  if (!results[lib]) { console.log(`  ${lib}: no result`); continue; }
  const d = results[lib].bytes - base;
  console.log(`  ${lib.padEnd(7)} +${d} bytes  (+${(d / 1024).toFixed(1)} KB)`);
}
