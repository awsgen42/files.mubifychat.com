/**
 * One URL per page, checked against a real server.
 *
 * Two URLs serving the same page splits its ranking signal, which is what
 * happened to the blog posts: Search Console carried both
 * /blog/send-a-file-too-big-for-email and .../email/ as separate rows with the
 * impressions divided between them.
 *
 * The canonical form here is the trailing slash. That is not a preference — it
 * is what the export actually contains. `next build` with `trailingSlash: true`
 * writes out/blog/<slug>/index.html and nothing else, and the sitemap,
 * canonical tags, og:url, JSON-LD and every internal link all use that form.
 * So the non-slash form must redirect to it, permanently.
 *
 * This drives `wrangler dev`, which runs the same asset server (workerd) that
 * serves the Cloudflare deployment — not a stand-in for it. Vercel's routing
 * cannot be exercised from here at all; `test/trailing-slash.test.ts` asserts
 * what vercel.json declares instead, which is the part that can be checked
 * without the network.
 *
 *   node perf/trailing-slash.mjs
 */
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT ?? 8794);
const BASE = `http://127.0.0.1:${PORT}`;

/** Every page in the sitemap gets checked, plus the two forms of each. */
const PATHS = [
  '/',
  '/blog/',
  '/blog/send-a-file-too-big-for-email/',
  '/blog/extract-frames-from-video-without-uploading/',
  '/blog/how-to-open-a-001-file/',
  '/blog/verify-a-download-with-sha256/',
  '/blog/the-risk-of-uploading-files-to-online-tools/',
  '/tools/',
  '/tools/split-file/',
  '/tools/instagram-data-download-viewer/',
  '/privacy/',
  '/snapdrop-alternative/',
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Kill the process group, not just the wrapper npx leaves behind. */
function stop(child) {
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

async function startServer() {
  // Refuse to measure against a server this script did not start. An earlier
  // run left one behind on this port, and the next run happily reported its
  // output as the result of a config change it had never loaded — a measurement
  // of the wrong process, which is the failure this project keeps having.
  try {
    await fetch(`${BASE}/`, { redirect: 'manual' });
    throw new Error(`something is already listening on ${BASE}; stop it or set PORT`);
  } catch (error) {
    if (!String(error.message).includes('already listening')) {
      // Nothing there, which is what we want.
    } else {
      throw error;
    }
  }
  // detached, so the whole group can be killed. Killing the npx wrapper alone
  // left workerd and two esbuild services running after every run; three runs
  // in, the box was at load 31 and a typecheck took a quarter of an hour.
  const child = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--local'], {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/`, { redirect: 'manual' });
      if (r.status) return child;
    } catch {
      // not up yet
    }
    await wait(1000);
  }
  stop(child);
  throw new Error('wrangler dev did not come up');
}

const server = await startServer();
let failures = 0;

try {
  console.log(`asset server: wrangler dev (workerd), the same one Cloudflare runs\n`);
  console.log('page'.padEnd(52), 'slashed'.padEnd(10), 'bare');
  console.log('-'.repeat(92));

  for (const path of PATHS) {
    const bare = path === '/' ? null : path.replace(/\/$/, '');

    const slashed = await fetch(`${BASE}${path}`, { redirect: 'manual' });
    let bareLine = '—';
    let ok = slashed.status === 200;

    if (bare) {
      const r = await fetch(`${BASE}${bare}`, { redirect: 'manual' });
      const location = r.headers.get('location');
      const target = location ? new URL(location, BASE).pathname : '';
      // A redirect is not enough: it has to be permanent, and it has to land on
      // the slashed form rather than bouncing somewhere else.
      const permanent = r.status === 308 || r.status === 301;
      const rightTarget = target === path;
      bareLine = `${r.status}${target ? ` -> ${target}` : ''}`;
      if (!permanent || !rightTarget) {
        ok = false;
        bareLine += r.status === 200 ? '  BOTH FORMS SERVE THE PAGE' : !permanent ? '  NOT PERMANENT' : '  WRONG TARGET';
      }
    }

    if (!ok) failures += 1;
    console.log(path.padEnd(52), String(slashed.status).padEnd(10), bareLine);
  }
  /* ---------- what routing everything through the Worker must not break --- */
  console.log('\nnot a page — must be served, not redirected');
  const ASSETS = [
    ['/sw.js', 'application/javascript'],
    ['/robots.txt', 'text/plain'],
    ['/sitemap.xml', 'application/xml'],
    ['/manifest.webmanifest', null],
    ['/og.png', 'image/png'],
    ['/favicon.ico', null],
    ['/blog/send-a-file-too-big-for-email/index.txt', null],
  ];
  for (const [path, type] of ASSETS) {
    const r = await fetch(`${BASE}${path}`, { redirect: 'manual' });
    const ok = r.status === 200 && (!type || (r.headers.get('content-type') ?? '').includes(type.split('/')[1]));
    if (!ok) failures += 1;
    console.log(`  ${path.padEnd(50)} ${r.status} ${r.headers.get('content-type') ?? ''}${ok ? '' : '  WRONG'}`);
  }

  console.log('\nthe query string, which a shared session depends on');
  {
    const r = await fetch(`${BASE}/tools?code=123456`, { redirect: 'manual' });
    const target = r.headers.get('location') ?? '';
    const kept = target.includes('code=123456') && target.includes('/tools/');
    if (!kept) failures += 1;
    console.log(`  /tools?code=123456 -> ${r.status} ${target}${kept ? '' : '  QUERY LOST'}`);
  }

  console.log('\nthe API, which must not be redirected or intercepted');
  for (const path of ['/api/session', '/api/nope']) {
    const r = await fetch(`${BASE}${path}`, { redirect: 'manual' });
    const ok = r.status !== 308 && r.status !== 307;
    if (!ok) failures += 1;
    console.log(`  ${path.padEnd(50)} ${r.status}${ok ? '' : '  REDIRECTED'}`);
  }
} finally {
  stop(server);
}

console.log(
  `\n${failures === 0 ? 'PASS — one URL per page' : `FAIL — ${failures} page(s) reachable at more than one URL, or redirecting temporarily`}`,
);
process.exit(failures === 0 ? 0 : 1);
