/**
 * The media-mode control.
 *
 * The brief says: force media on for a media-heavy archive in a phone profile,
 * and it must hurt. If it does not hurt, the default is doing nothing and
 * should not exist.
 *
 * Same archive, same conversation, same scroll, twice — once in each state.
 * Anything else compares two different things and proves nothing.
 *
 *   node perf/media-control.mjs [fixture]
 */
import { chromium, devices } from 'playwright';
import { CHROME, calibrate, pssMb } from './pss.mjs';

const HERE = import.meta.dirname;
const PAGE = `${process.env.MUBIFILES_URL ?? 'http://127.0.0.1:8791'}/tools/instagram-data-download-viewer/`;
const FIXTURE = `${HERE}/fixtures/${process.argv[2] ?? 'export-media-700mb.zip'}`;
const MOBILE = devices['Pixel 5'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(mode) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ ...MOBILE })).newPage();
  let crashed = false;
  page.on('crash', () => {
    crashed = true;
  });

  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const tick = (now) => {
      window.__frames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await wait(1200);

  await page.setInputFiles('input[type=file][accept*=zip]', FIXTURE);
  await page.waitForFunction(
    () => /opened in/.test(document.querySelector('[data-status]')?.textContent ?? ''),
    { timeout: 600_000 },
  );

  // The conversation with the most attachments — the one the default is about.
  const counts = await page.$$eval('[data-threads] li button', (els) =>
    els.map((el, i) => [i, Number(el.dataset.media ?? 0)]),
  );
  const target = [...counts].sort((a, b) => b[1] - a[1])[0];
  const buttons = await page.$$('[data-threads] li button');
  await buttons[target[0]].click();
  await page.waitForFunction(() => Number(document.querySelector('[data-scroller]')?.dataset.rows) > 0, {
    timeout: 120_000,
  });

  const label = mode === 'media' ? 'Show media' : 'Text only';
  await page.evaluate((l) => {
    [...document.querySelectorAll('button')].find((b) => b.textContent === l)?.click();
  }, label);
  await wait(600);

  // Measurement starts after the state is set, so the scroll is what is timed.
  await page.evaluate(() => (window.__frames.length = 0));
  const before = pssMb();
  let peak = before;
  const timer = setInterval(() => {
    const v = pssMb();
    if (v > peak) peak = v;
  }, 150);

  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => {
      const el = document.querySelector('[data-scroller]');
      el.scrollTop += el.clientHeight;
    });
    await wait(120);
  }
  await wait(1000);
  clearInterval(timer);

  const frames = await page.evaluate(() => window.__frames.slice()).catch(() => []);
  const blobs = await page.evaluate(
    () => document.querySelectorAll('img[src^="blob:"], video[src^="blob:"]').length,
  );
  await browser.close();

  const janky = frames.filter((f) => f > 32).length;
  const sorted = [...frames].sort((a, b) => a - b);
  const p99 = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] : 0;
  return { peak, before, growth: peak - before, janky, frames: frames.length, p99, blobs, crashed, attachments: target[1] };
}

{
  const r = await calibrate();
  console.log(`calibration: ${r.sees ? 'PASS' : 'FAIL'} (idle ${r.idle} -> ${r.held} MB)\n`);
  if (!r.sees) process.exit(1);
}

console.log(`${FIXTURE.split('/').pop()} (synthetic), Pixel 5 profile, 40 pages of scroll\n`);

const text = await run('text');
const media = await run('media');

for (const [name, r] of [
  ['text only  ', text],
  ['media on   ', media],
]) {
  console.log(
    `  ${name} peak PSS ${r.peak} MB (+${r.growth} over the scroll) · ${r.janky} of ${r.frames} frames over 32 ms · p99 ${Math.round(r.p99)} ms · ${r.blobs} attachments rendered${r.crashed ? ' · CRASHED' : ''}`,
  );
}

const worse =
  media.crashed ||
  media.growth > text.growth * 1.5 ||
  media.janky > Math.max(2, text.janky * 1.5) ||
  media.p99 > text.p99 * 1.5;

console.log(
  `\n  ${worse ? 'RED — forcing media on measurably hurts, so the default earns its place' : 'GREEN — THE CONTROL DID NOT FAIL: forcing media on cost nothing measurable here'}`,
);
console.log(`  (${media.attachments} attachments in the conversation measured)`);
