/**
 * Phase 1 of the Instagram viewer, measured end to end against the built site.
 *
 * One fixture per run, or all of them. Everything here is measured through the
 * page as a person would drive it — pick the file, wait for the list, open the
 * biggest conversation, scroll it, search, jump — because the numbers that
 * matter are the ones a reader experiences, not the ones a unit test can reach.
 *
 * Every fixture is synthetic. See make-export.py.
 *
 *   node perf/viewer.mjs                 # all fixtures
 *   node perf/viewer.mjs export-1gb.zip  # one
 */
import { chromium, devices } from 'playwright';
import { existsSync, statSync } from 'node:fs';
import { CHROME, calibrate, pssMb } from './pss.mjs';

const HERE = import.meta.dirname;
const URL_BASE = process.env.MUBIFILES_URL ?? 'http://127.0.0.1:8791';
const PAGE = `${URL_BASE}/tools/instagram-data-download-viewer/`;

const ALL = [
  'export-small.zip',
  'export-500mb.zip',
  'export-media-700mb.zip',
  'export-1gb.zip',
  'export-2gb.zip',
];
const fixtures = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const RUN = fixtures.length ? fixtures : ALL;

/**
 * A phone, not a desktop. The memory ceiling that matters is the one on the
 * device most of these archives are opened on, and a 16 GB laptop will not
 * show it.
 */
const MOBILE = devices['Pixel 5'];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Peak PSS over a period, sampled from outside the browser. */
function watchPss() {
  let peak = pssMb();
  const timer = setInterval(() => {
    const v = pssMb();
    if (v > peak) peak = v;
  }, 200);
  return {
    stop() {
      clearInterval(timer);
      return peak;
    },
  };
}

/* ---------- calibrate ------------------------------------------------ */
{
  const r = await calibrate();
  console.log('calibration');
  console.log(
    `  idle ${r.idle} MB -> holding a known 300 MB ${r.held} MB (+${r.growth}) -> released ${r.freed} MB`,
  );
  console.log(`  ${r.sees ? 'PASS' : 'FAIL'}  the instrument sees a known 300 MB allocation\n`);
  if (!r.sees) process.exit(1);
}

const results = [];

for (const name of RUN) {
  const path = `${HERE}/fixtures/${name}`;
  if (!existsSync(path)) {
    console.log(`${name}: MISSING — run make-export.py\n`);
    continue;
  }
  const bytes = statSync(path).size;
  console.log(`${name}  ${(bytes / 1024 ** 2).toFixed(0)} MB (synthetic)`);

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const context = await browser.newContext({ ...MOBILE });
  const page = await context.newPage();
  let crashed = false;
  page.on('crash', () => {
    crashed = true;
  });
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  await page.goto(PAGE, { waitUntil: 'networkidle' });

  // Long tasks on the main thread. If the parse is really in the worker, the
  // main thread should stay responsive while a 2 GB archive is being read.
  await page.evaluate(() => {
    window.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__long.push(Math.round(e.duration));
    }).observe({ entryTypes: ['longtask'] });
  });

  await wait(1500);
  const idle = pssMb();

  /* ---------- open ---------------------------------------------------- */
  const watcher = watchPss();
  const t0 = Date.now();
  await page.setInputFiles('input[type=file][accept*=zip]', path);
  let openMs = null;
  try {
    // "opened in" only appears on the final status; the progress line also says
    // "conversations" and matching that measured the wrong moment.
    await page.waitForFunction(
      () => /opened in|No message files|HTML version/.test(document.querySelector('[data-status]')?.textContent ?? ''),
      { timeout: 600_000 },
    );
    openMs = Date.now() - t0;
  } catch {
    openMs = null;
  }
  const openPeak = watcher.stop();
  const status = await page.textContent('[data-status]').catch(() => '');
  const longDuringOpen = await page.evaluate(() => window.__long.slice());

  if (crashed || openMs === null) {
    console.log(`  OPEN FAILED${crashed ? ' — page crashed' : ' — timed out'}`);
    console.log(`  peak PSS ${openPeak} MB (idle ${idle})\n`);
    results.push({ name, bytes, failed: true, openPeak, idle });
    await browser.close();
    continue;
  }

  console.log(`  open        ${openMs} ms   ${status.trim()}`);
  console.log(
    `  memory      idle ${idle} MB -> peak ${openPeak} MB (+${openPeak - idle}), archive is ${(bytes / 1024 ** 2).toFixed(0)} MB`,
  );
  console.log(
    `  main thread ${longDuringOpen.length} long tasks${longDuringOpen.length ? `, worst ${Math.max(...longDuringOpen)} ms` : ''}`,
  );

  const mediaLine = await page.textContent('[data-status]');
  void mediaLine;

  /* ---------- open the biggest conversation --------------------------- */
  const threadButtons = await page.$$('[data-threads] li button');
  let threadMs = null;
  let rows = null;
  let messages = null;
  let mediaDefault = null;
  if (threadButtons.length) {
    // The list is newest-first; the long thread is the one worth measuring, so
    // pick the entry with the largest message count.
    const counts = await page.$$eval('[data-threads] li button', (els) =>
      els.map((el, i) => [i, Number(el.dataset.count ?? 0), Number(el.dataset.media ?? 0)]),
    );
    const biggest = [...counts].sort((a, b) => b[1] - a[1])[0];
    const mostMedia = [...counts].sort((a, b) => b[2] - a[2])[0];
    const t1 = Date.now();
    await threadButtons[biggest[0]].click();
    await page.waitForSelector('[data-scroller]', { timeout: 120_000 });
    await page.waitForFunction(() => Number(document.querySelector('[data-scroller]')?.dataset.rows) > 0, {
      timeout: 120_000,
    });
    threadMs = Date.now() - t1;
    rows = await page.getAttribute('[data-scroller]', 'data-rows');
    messages = await page.getAttribute('[data-scroller]', 'data-messages');
    mediaDefault = await page.evaluate(() => {
      const on = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Show media');
      return on?.className.includes('accent') ? 'media' : 'text';
    });
    console.log(
      `  thread      ${threadMs} ms to first paint · ${Number(messages).toLocaleString()} messages · ${rows} rows in the DOM · opens in ${mediaDefault === 'media' ? 'show media' : 'text only'}`,
    );

    /* ---------- scroll -------------------------------------------- */
    const scrollWatcher = watchPss();
    const nodesBefore = await page.evaluate(() => document.querySelectorAll('[data-i]').length);
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() => {
        const el = document.querySelector('[data-scroller]');
        el.scrollTop += el.clientHeight * 3;
      });
      await wait(60);
    }
    await wait(400);
    const nodesAfter = await page.evaluate(() => document.querySelectorAll('[data-i]').length);
    const scrollPeak = scrollWatcher.stop();
    console.log(
      `  scroll      ${nodesBefore} -> ${nodesAfter} rows in the DOM after 30 pages · peak PSS ${scrollPeak} MB`,
    );

    /* ---------- search and jump ----------------------------------- */
    await page.fill('input[type=search]', 'hilarious');
    const t2 = Date.now();
    await page.click('button[type=submit]');
    await page.waitForSelector('[data-results], p:has-text("No messages contain")', { timeout: 300_000 }).catch(() => {});
    const searchMs = Date.now() - t2;
    const note = await page.textContent('[data-note]').catch(() => '');
    console.log(`  search      ${searchMs} ms · ${note ?? ''}`);

    // The jump. Not "something is highlighted" — the row that was searched for.
    const hit = await page.$('[data-results] li button');
    let jumpOk = null;
    let jumpMs = null;
    if (hit) {
      // What the result claims. The jump is only correct if the highlighted row
      // is this one — "a row is highlighted" is a different, weaker claim.
      const expected = Number(await hit.getAttribute('data-hit-i'));
      const t3 = Date.now();
      await hit.click();
      await page.waitForSelector('[data-highlighted=true]', { timeout: 60_000 }).catch(() => {});
      jumpMs = Date.now() - t3;
      jumpOk = await page.evaluate(() => {
        const row = document.querySelector('[data-highlighted=true]');
        if (!row) return { found: false };
        const scroller = document.querySelector('[data-scroller]');
        const r = row.getBoundingClientRect();
        const s = scroller.getBoundingClientRect();
        return {
          found: true,
          i: Number(row.dataset.i),
          inView: r.top >= s.top && r.bottom <= s.bottom,
          contextAbove: Math.round(r.top - s.top),
        };
      });
      const right = jumpOk.found && jumpOk.i === expected;
      console.log(
        `  jump        ${jumpMs} ms · asked for row ${expected}, landed on ${jumpOk.found ? jumpOk.i : 'nothing'} ${right ? 'MATCH' : 'MISMATCH'} · ${jumpOk.inView ? 'in view' : 'NOT IN VIEW'} · ${jumpOk.contextAbove}px of conversation above it`,
      );
      jumpOk.expected = expected;
      jumpOk.right = right;
    }

    /* ---------- next / previous, and back to results --------------- */
    if (hit) {
      const step = async (label, dir) => {
        const before = await page.getAttribute('[data-highlighted=true]', 'data-i').catch(() => null);
        await page.click(`button[aria-label="${dir} match"]`).catch(() => {});
        await page.waitForFunction(
          (prev) => document.querySelector('[data-highlighted=true]')?.dataset.i !== prev,
          before,
          { timeout: 30_000 },
        ).catch(() => {});
        const after = await page.getAttribute('[data-highlighted=true]', 'data-i').catch(() => null);
        const pos = await page.textContent('span.inline-block.min-w-\\[5\\.5rem\\]').catch(() => '');
        return `${label} ${before} -> ${after} (${(pos ?? '').trim()})`;
      };
      const fwd = await step('next', 'Next');
      const back = await step('prev', 'Previous');
      await page.click('text=Back to results').catch(() => {});
      const restored = await page.$$eval('[data-results] li button', (els) => els.length).catch(() => 0);
      const queryKept = await page.inputValue('input[type=search]').catch(() => '');
      console.log(`  stepping    ${fwd} · ${back} · back to results: ${restored} hits, query "${queryKept}"`);
      // Back into the thread for the media measurement below.
      const again = await page.$('[data-results] li button');
      if (again) await again.click();
      await page.waitForSelector('[data-scroller]', { timeout: 60_000 }).catch(() => {});
    }

    /* ---------- media forced on ----------------------------------- */
    // On the thread with the most attachments — measuring media cost on a
    // text-only thread measures nothing, which is what the first run did.
    await page.evaluate(() => document.querySelector('[data-back-all]')?.click());
    await page.waitForSelector('[data-threads] li button', { timeout: 60_000 }).catch(() => {});
    const mediaButtons = await page.$$('[data-threads] li button');
    if (mediaButtons[mostMedia[0]]) await mediaButtons[mostMedia[0]].click();
    await page.waitForFunction(() => Number(document.querySelector('[data-scroller]')?.dataset.rows) > 0, {
      timeout: 120_000,
    }).catch(() => {});
    const mediaWatcher = watchPss();
    await page.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => b.textContent === 'Show media')?.click();
    });
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() => {
        const el = document.querySelector('[data-scroller]');
        el.scrollTop += el.clientHeight * 2;
      });
      await wait(220);
    }
    await wait(800);
    const mediaPeak = mediaWatcher.stop();
    const imgs = await page.evaluate(() => document.querySelectorAll('img[src^="blob:"]').length);
    console.log(
      `  media on    ${mostMedia[2]} attachments in that thread · peak PSS ${mediaPeak} MB (+${mediaPeak - openPeak} over the open peak) · ${imgs} blob URLs live`,
    );

    results.push({
      name,
      bytes,
      openMs,
      idle,
      openPeak,
      longDuringOpen,
      threadMs,
      rows: Number(rows),
      messages: Number(messages),
      mediaDefault,
      nodesAfter,
      scrollPeak,
      searchMs,
      jumpOk,
      mediaPeak,
      imgs,
    });
  }

  if (consoleErrors.length) console.log(`  console     ${consoleErrors.length} errors: ${consoleErrors[0]}`);
  console.log();
  await browser.close();
}

console.log('summary (all fixtures synthetic)');
console.log('fixture'.padEnd(24), 'open'.padStart(8), 'peak'.padStart(8), 'rows'.padStart(6), 'default'.padStart(8));
for (const r of results) {
  console.log(
    r.name.padEnd(24),
    r.failed ? 'FAILED'.padStart(8) : `${r.openMs} ms`.padStart(8),
    `${r.openPeak} MB`.padStart(8),
    String(r.rows ?? '-').padStart(6),
    String(r.mediaDefault ?? '-').padStart(8),
  );
}
