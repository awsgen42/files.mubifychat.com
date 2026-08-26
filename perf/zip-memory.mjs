/**
 * The other half of the zip library decision: what each one costs in memory to
 * list the entries of a ~2 GB archive.
 *
 * Measured as PSS summed over the Chromium process tree, from outside the
 * browser. JS heap counters cannot see an ArrayBuffer holding an archive, and
 * RSS summed across a dozen processes double-counts every shared page. The
 * instrument is calibrated against a known allocation before any number from
 * it is quoted — a previous round of this work produced a confident figure
 * from an instrument that was measuring the wrong process entirely.
 */
import { chromium } from 'playwright';
import { pssMb, calibrate, CHROME } from './pss.mjs';
import { execSync } from 'node:child_process';
import { copyFileSync, statSync } from 'node:fs';

const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const HERE = import.meta.dirname;
const ZIP = `${HERE}/fixtures/export-2gb.zip`;
const WORKER = `${REPO}/lib/instagram/probe.worker.ts`;


const zipBytes = statSync(ZIP).size;
console.log(`archive: ${zipBytes} bytes (${(zipBytes / 1024 ** 3).toFixed(2)} GB), synthetic\n`);

/* ---------- calibrate ------------------------------------------------ */
// Every run calibrates first. A number from an uncalibrated instrument is a
// guess with a unit attached, and this harness has produced one before.
{
  const r = await calibrate();
  console.log('calibration');
  console.log(`  idle ${r.idle} MB -> holding a known 300 MB ${r.held} MB (+${r.growth}) -> released ${r.freed} MB (+${r.freed - r.idle})`);
  console.log(`  ${r.sees ? 'PASS' : 'FAIL'}  the instrument sees a known 300 MB allocation\n`);
  if (!r.sees) process.exit(1);
}

/* ---------- each library, listing the entries ------------------------ */
for (const variant of ['zipjs', 'fflate']) {
  copyFileSync(`${HERE}/variants/${variant}.ts`, WORKER);
  try {
    execSync('npx next build', { cwd: REPO, stdio: 'pipe' });
  } catch (error) {
    console.log(`${variant}: BUILD FAILED`);
    continue;
  }

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('crash', () => console.log(`  ${variant}: PAGE CRASHED`));
  await page.goto('http://127.0.0.1:8791/tools/instagram-data-download-viewer/', { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 2500));

  const baseline = pssMb();
  let peak = baseline;
  const timer = setInterval(() => {
    const v = pssMb();
    if (v > peak) peak = v;
  }, 250);

  const started = Date.now();
  await page.locator('input[type=file]').setInputFiles(ZIP);
  const outcome = await page
    .waitForFunction(
      () => {
        const t = document.querySelector('[data-probe]')?.textContent ?? '';
        return /entries in|error|failed/.test(t) ? t : false;
      },
      null,
      { timeout: 600_000 },
    )
    .then((h) => h.jsonValue())
    .catch((e) => 'TIMED OUT / DIED: ' + e.message.split('\n')[0]);
  const elapsed = Math.round((Date.now() - started) / 1000);

  clearInterval(timer);
  console.log(`${variant}`);
  console.log(`  result       : ${String(outcome).slice(0, 110)}`);
  console.log(`  baseline PSS : ${baseline} MB`);
  console.log(`  peak PSS     : ${peak} MB   (+${peak - baseline} MB for a ${(zipBytes / 1024 ** 3).toFixed(2)} GB archive)`);
  console.log(`  fraction     : ${((peak - baseline) / (zipBytes / 1024 ** 2)).toFixed(2)}x the archive`);
  console.log(`  elapsed      : ${elapsed}s\n`);
  await browser.close();
}

copyFileSync(`${HERE}/variants/zipjs.ts`, WORKER);
console.log('worker restored to the zip.js variant');
