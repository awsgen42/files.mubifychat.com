/**
 * The controls, red first.
 *
 * Each one sabotages exactly one decision in the source, rebuilds the site, and
 * measures the same thing the real harness measures. A control that does not go
 * red means the decision it guards was not doing anything, and that is a result
 * worth having — it has happened twice on this project already.
 *
 * The source is restored in a finally, and the site is rebuilt afterwards, so a
 * crash mid-run does not leave a sabotaged tree behind.
 *
 *   node perf/controls.mjs [fixture]
 */
import { chromium, devices } from 'playwright';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { CHROME, calibrate, pssMb } from './pss.mjs';

const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const HERE = import.meta.dirname;
const PAGE = `${process.env.MUBIFILES_URL ?? 'http://127.0.0.1:8791'}/tools/instagram-data-download-viewer/`;
const FIXTURE = `${HERE}/fixtures/${process.argv[2] ?? 'export-1gb.zip'}`;
const MOBILE = devices['Pixel 5'];

const COMPONENT = `${REPO}/components/InstagramExportTool.tsx`;
const VIRTUAL = `${REPO}/lib/instagram/virtual.ts`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const build = () => execSync('npx next build', { cwd: REPO, stdio: 'pipe' });

/**
 * Control 1 — run the engine on the main thread.
 *
 * Same code, same archive, no worker. The claim being tested is that moving
 * this work off the main thread is what keeps the page responsive, and the
 * only way to know is to put it back.
 */
const BYPASS_WORKER = {
  name: 'engine on the main thread (no worker)',
  file: COMPONENT,
  patch(source) {
    const from = `    const w = new Worker(new URL('../lib/instagram/archive.worker.ts', import.meta.url), {
      type: 'module',
    });`;
    if (!source.includes(from)) throw new Error('worker construction not found');
    const to = `    const listeners = new Set<(e: { data: WorkerResponse }) => void>();
    const handle = createEngine((r) => listeners.forEach((l) => l({ data: r })));
    const w = {
      postMessage: (req: WorkerRequest) => void handle(req),
      addEventListener: (_t: string, l: (e: { data: WorkerResponse }) => void) => listeners.add(l),
      removeEventListener: (_t: string, l: (e: { data: WorkerResponse }) => void) => listeners.delete(l),
      terminate: () => listeners.clear(),
      set onmessage(l: (e: { data: WorkerResponse }) => void) { listeners.add(l); },
      set onerror(_l: unknown) {},
    } as unknown as Worker;`;
    return source
      .replace("import { Button, Card, cx } from './ui';", "import { createEngine } from '@/lib/instagram/engine';\nimport { Button, Card, cx } from './ui';")
      .replace(from, to);
  },
};

/**
 * Control 2 — render every row.
 *
 * The window becomes the whole thread. Fifty thousand messages, fifty thousand
 * elements.
 */
const NO_VIRTUALISATION = {
  name: 'every row in the DOM (no virtualisation)',
  file: VIRTUAL,
  patch(source) {
    const from = `  const first = offsets.indexAt(scrollTop);`;
    if (!source.includes(from)) throw new Error('windowFor body not found');
    return source.replace(
      from,
      `  return { start: 0, end: offsets.count }; // SABOTAGE
  const first = offsets.indexAt(scrollTop);`,
    );
  },
};

async function measure(label) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const context = await browser.newContext({ ...MOBILE });
  const page = await context.newPage();
  let crashed = false;
  page.on('crash', () => {
    crashed = true;
  });

  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__long.push(Math.round(e.duration));
    }).observe({ entryTypes: ['longtask'] });
    // Frame gaps, because the long-task threshold is 50 ms and a main thread
    // can be ruined by a thousand 20 ms tasks without ever crossing it. This is
    // the instrument the first run of the worker control lacked, which is why
    // that control came back green.
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

  const idle = pssMb();
  let peak = idle;
  const timer = setInterval(() => {
    const v = pssMb();
    if (v > peak) peak = v;
  }, 200);

  const t0 = Date.now();
  await page.setInputFiles('input[type=file][accept*=zip]', FIXTURE);
  let openMs = null;
  try {
    await page.waitForFunction(
      () => /opened in|No message files|HTML version/.test(document.querySelector('[data-status]')?.textContent ?? ''),
      { timeout: 600_000 },
    );
    openMs = Date.now() - t0;
  } catch {
    openMs = null;
  }

  let nodes = null;
  let threadMs = null;
  let scrollLong = null;
  if (!crashed && openMs !== null) {
    const counts = await page.$$eval('[data-threads] li button', (els) =>
      els.map((el, i) => [i, Number(el.dataset.count ?? 0)]),
    );
    const biggest = [...counts].sort((a, b) => b[1] - a[1])[0];
    const buttons = await page.$$('[data-threads] li button');
    const t1 = Date.now();
    try {
      await buttons[biggest[0]].click();
      await page.waitForFunction(
        () => Number(document.querySelector('[data-scroller]')?.dataset.rows) > 0,
        { timeout: 180_000 },
      );
      threadMs = Date.now() - t1;
      nodes = await page.evaluate(() => document.querySelectorAll('[data-i]').length);
      await page.evaluate(() => (window.__long.length = 0));
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => {
          const el = document.querySelector('[data-scroller]');
          el.scrollTop += el.clientHeight * 3;
        });
        await wait(80);
      }
      await wait(400);
      scrollLong = await page.evaluate(() => window.__long.slice());
    } catch {
      threadMs = null;
    }
  }

  clearInterval(timer);
  const long = await page.evaluate(() => window.__long.slice()).catch(() => []);
  const frames = await page.evaluate(() => window.__frames.slice()).catch(() => []);
  await browser.close();

  const worst = (a) => (a && a.length ? Math.max(...a) : 0);
  console.log(`  ${label}`);
  console.log(
    `    open ${openMs === null ? (crashed ? 'CRASHED' : 'TIMED OUT') : `${openMs} ms`} · thread ${threadMs === null ? 'FAILED' : `${threadMs} ms`} · ${nodes ?? '-'} rows in the DOM`,
  );
  // Frames slower than 32 ms are two dropped frames at 60 Hz — the point at
  // which a scroll stops feeling smooth.
  const janky = frames.filter((f) => f > 32).length;
  const p99 = frames.length ? [...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.99)] : 0;
  console.log(
    `    peak PSS ${peak} MB (idle ${idle}) · long tasks while scrolling: ${scrollLong?.length ?? '-'}${scrollLong?.length ? `, worst ${worst(scrollLong)} ms` : ''} · overall worst ${worst(long)} ms`,
  );
  console.log(
    `    frames ${frames.length} · ${janky} over 32 ms · p99 ${Math.round(p99)} ms · worst ${Math.round(Math.max(0, ...frames))} ms`,
  );
  return { openMs, threadMs, nodes, peak, idle, scrollLong, crashed, janky, p99, frames };
}

/* ---------- calibrate ------------------------------------------------ */
{
  const r = await calibrate();
  console.log(`calibration: ${r.sees ? 'PASS' : 'FAIL'} (idle ${r.idle} -> ${r.held} MB)\n`);
  if (!r.sees) process.exit(1);
}

console.log(`fixture: ${FIXTURE.split('/').pop()} (synthetic)\n`);
console.log('baseline — the code as it ships');
const baseline = await measure('as shipped');
console.log();

const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const CONTROLS = [BYPASS_WORKER, NO_VIRTUALISATION].filter(
  (c) => !ONLY || c.name.includes(ONLY),
);

for (const control of CONTROLS) {
  const original = readFileSync(control.file, 'utf8');
  console.log(`control — ${control.name}`);
  try {
    writeFileSync(control.file, control.patch(original));
    build();
    const result = await measure('sabotaged');
    const verdict =
      control === NO_VIRTUALISATION
        ? result.crashed || (result.nodes ?? 0) > 1000 || result.threadMs === null
        : (result.scrollLong?.length ?? 0) > (baseline.scrollLong?.length ?? 0) ||
          result.janky > baseline.janky * 1.5 ||
          result.p99 > baseline.p99 * 1.5;
    console.log(`    ${verdict ? 'RED — the control fails as it must' : 'GREEN — THE CONTROL DID NOT FAIL'}`);
  } catch (error) {
    console.log(`    control could not run: ${error.message}`);
  } finally {
    writeFileSync(control.file, original);
  }
  console.log();
}

console.log('restoring and rebuilding');
build();
console.log('done');
