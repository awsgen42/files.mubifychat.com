/**
 * Layout shift, measured through interaction.
 *
 * A page that is still on load is trivially 0.0000 and tells you nothing: these
 * tools change their own layout when you use them, which is when the shifts
 * happen. So the harness drives the page — types, opens an archive, scrolls,
 * searches — and reads the layout-shift entries the browser reported.
 *
 * The trap this harness was rebuilt around: a shift only counts if the moved
 * elements were in the viewport. An earlier version of this measured 0.0000 on
 * a page that was visibly jumping, because the rows that moved were below the
 * fold. Anything being measured has to be scrolled into view first.
 *
 *   node perf/cls.mjs                       # every page
 *   node perf/cls.mjs /tools/stylish-name/  # one
 */
import { chromium, devices } from 'playwright';
import { CHROME } from './pss.mjs';

const BASE = process.env.MUBIFILES_URL ?? 'http://127.0.0.1:8791';
const HERE = import.meta.dirname;
const MOBILE = devices['Pixel 5'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Each page, and what "using it" means there. */
const PAGES = {
  '/tools/stylish-name/': async (page) => {
    const input = page.locator('input[aria-label="Your name"]');
    await input.scrollIntoViewIfNeeded();
    for (const text of ['A', 'Al', 'Alex', 'Alexandra', 'Alexandra Q', '']) {
      await input.fill(text);
      await wait(220);
    }
    // The rows are below the fold on a phone; a shift there is real and would
    // not be counted from the top of the page.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await wait(300);
    await input.fill('Wilhelmina Fitzgerald');
    await wait(400);
  },
  '/tools/instagram-data-download-viewer/': async (page) => {
    await page.setInputFiles('input[type=file][accept*=zip]', `${HERE}/fixtures/export-small.zip`);
    await page.waitForFunction(
      () => /opened in/.test(document.querySelector('[data-status]')?.textContent ?? ''),
      { timeout: 600_000 },
    );
    await wait(500);
    // The list, the progress line collapsing into the final status, the thread
    // opening and the media line appearing are all layout changes under
    // content that is already on screen.
    const first = page.locator('[data-threads] li button').first();
    await first.scrollIntoViewIfNeeded();
    await wait(300);
    await first.click();
    await page.waitForSelector('[data-scroller]', { timeout: 120_000 });
    await wait(600);
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => {
        const el = document.querySelector('[data-scroller]');
        el.scrollTop += el.clientHeight;
      });
      await wait(150);
    }
    await page.fill('input[type=search]', 'lol');
    await page.click('button[type=submit]');
    await page.waitForSelector('[data-results]', { timeout: 120_000 }).catch(() => {});
    await wait(600);
    const hit = page.locator('[data-results] li button').first();
    if (await hit.count()) {
      await hit.click();
      await wait(800);
      // Stepping changes the counter in the header, above the conversation.
      await page.click('button[aria-label="Next match"]').catch(() => {});
      await wait(600);
    }
  },
};

const only = process.argv[2];
const paths = only ? [only] : Object.keys(PAGES);
let worst = 0;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
for (const path of paths) {
  const page = await (await browser.newContext({ ...MOBILE })).newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.__cls = 0;
    window.__shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__cls += entry.value;
        if (entry.value > 0.0001) {
          window.__shifts.push({
            value: Number(entry.value.toFixed(4)),
            at: Math.round(entry.startTime),
            sources: entry.sources
              .map(
                (s) =>
                  `${s.node?.tagName}[${String(s.node?.className ?? '').slice(0, 70)}]` +
                  ` [${Math.round(s.previousRect.y)},${Math.round(s.previousRect.height)} -> ${Math.round(s.currentRect.y)},${Math.round(s.currentRect.height)}]`,
              )
              .slice(0, 3),
          });
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await wait(400);

  await PAGES[path](page);
  await wait(600);

  const cls = await page.evaluate(() => window.__cls);
  const shifts = await page.evaluate(() => window.__shifts);
  worst = Math.max(worst, cls);
  console.log(`${path}  CLS ${cls.toFixed(4)}`);
  for (const s of shifts.slice(0, 8)) console.log(`    ${s.value} at ${s.at} ms  ${s.sources.join(' | ')}`);
  await page.context().close();
}
await browser.close();

console.log(`\nworst ${worst.toFixed(4)}`);
process.exit(worst > 0.0001 ? 1 : 0);
