/**
 * The memory instrument, and the calibration that has to pass before any
 * number it produces is worth quoting.
 *
 * Why PSS rather than the obvious alternatives, each of which was tried and
 * produced a confidently wrong answer at some point in this work:
 *
 *   JS heap counters (performance.memory, JSHeapUsedSize) cannot see an
 *   ArrayBuffer, a canvas backing store or a file-backed blob. They reported
 *   everything fine while the process grew by hundreds of megabytes.
 *
 *   RSS summed across the Chromium process tree double-counts every shared
 *   page — it put the idle floor at 850 MB and swamped the thing being
 *   measured. An earlier version also matched processes on /chrom/i, which
 *   caught this session's own agent process and moved the numbers for reasons
 *   unrelated to the browser.
 *
 * PSS divides each shared page by the number of processes mapping it, so a sum
 * over the tree means something. Processes are matched on the browser binary's
 * exact path.
 *
 * Usage:
 *   node pss.mjs --calibrate     run the calibration and exit non-zero if it fails
 *   import { pssMb, calibrate }  from another harness
 */
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

export const CHROME =
  process.env.MUBIFILES_CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Summed PSS, in MB, across every process running that browser binary. */
export function pssMb() {
  const out = execSync(
    `for p in $(pgrep -f '^${CHROME}'); do awk '/^Pss:/ {print $2}' /proc/$p/smaps_rollup 2>/dev/null; done | awk '{s+=$1} END {print s+0}'`,
    { encoding: 'utf8', shell: '/bin/bash' },
  );
  return Math.round(Number(out.trim()) / 1024);
}

/**
 * Allocate a known amount inside the browser and check the instrument sees it.
 *
 * Every page of the buffer is touched, because an untouched ArrayBuffer is not
 * resident and would make a working instrument look broken.
 *
 * Returns { idle, held, freed, sees } — `sees` is the only assertion made.
 * Release is reported but not asserted: without --expose-gc the collection is
 * at the engine's discretion and a "failure" there would be noise.
 */
export async function calibrate({ url = 'http://127.0.0.1:8791/tools/', mb = 300 } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await new Promise((r) => setTimeout(r, 2500));
    const idle = pssMb();

    await page.evaluate((size) => {
      const b = new Uint8Array(size * 1024 * 1024);
      for (let i = 0; i < b.length; i += 4096) b[i] = 1;
      window.__calibrationHold = b;
    }, mb);
    await new Promise((r) => setTimeout(r, 2000));
    const held = pssMb();

    await page.evaluate(() => {
      delete window.__calibrationHold;
    });
    await new Promise((r) => setTimeout(r, 4000));
    const freed = pssMb();

    const growth = held - idle;
    return { idle, held, freed, growth, sees: growth > mb * 0.8 && growth < mb * 1.35 };
  } finally {
    await browser.close();
  }
}

if (process.argv.includes('--calibrate')) {
  const r = await calibrate();
  console.log('PSS instrument calibration');
  console.log(`  idle            ${r.idle} MB`);
  console.log(`  holding 300 MB  ${r.held} MB   (+${r.growth})`);
  console.log(`  after release   ${r.freed} MB   (+${r.freed - r.idle} vs idle)`);
  console.log(`  ${r.sees ? 'PASS' : 'FAIL'}  the instrument sees a known 300 MB allocation`);
  process.exit(r.sees ? 0 : 1);
}
