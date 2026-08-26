/**
 * Remove TypeScript source that the export should never contain.
 *
 * Turbopack emits a module worker's entry file as a static asset as well as
 * compiling it, so `new Worker(new URL('./x.worker.ts', import.meta.url))`
 * leaves `out/_next/static/media/x.worker.<hash>.ts` — the actual source, on a
 * public origin, served as `video/mp2t`, fetched by nothing.
 *
 * Deleting it is safe because the worker runs from the compiled chunks; that
 * was checked by deleting these files and re-running the viewer harness, which
 * opens a real archive in a real worker. It is not assumed here: if a future
 * build starts genuinely loading the asset, the worker fails to start and the
 * harness says so.
 *
 * verify-output.mjs refuses to finish if any of these survive, so this script
 * silently doing nothing — a renamed directory, a changed extension — is a
 * build failure rather than a quiet regression.
 *
 * Usage: node scripts/strip-worker-source.mjs
 */
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'out/_next';

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const sources = walk(ROOT).filter((path) => /\.(ts|tsx)$/.test(path));
for (const path of sources) unlinkSync(path);

console.log(
  sources.length
    ? `strip-worker-source: removed ${sources.length} TypeScript file(s) from the export — ${sources.map((p) => p.split('/').pop()).join(', ')}`
    : 'strip-worker-source: no TypeScript in the export',
);
