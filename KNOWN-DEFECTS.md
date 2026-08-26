# Known defects

Things that are wrong, are not being fixed this minute, and should not be
rediscovered from scratch later. Each entry names the commit it appeared in and
what would close it.

---

## Worker source shipped as a public asset — CLOSED

**Appeared in:** `f24b684` — "Phase 1 groundwork: settle the worker, and pick
the zip library on numbers"

**What happened:** building with a module worker constructed as

```js
new Worker(new URL('../lib/instagram/archive.worker.ts', import.meta.url), { type: 'module' })
```

made Turbopack copy the worker's **TypeScript source verbatim** into
`out/_next/static/media/archive.worker.<hash>.ts`, alongside the compiled chunks
the worker actually loads through Turbopack's worker shim. It was application
source on a public origin, served as `Content-Type: video/mp2t`, fetched by
nothing.

**How it was closed:** `scripts/strip-worker-source.mjs` deletes any `.ts`/`.tsx`
under `out/_next` after `next build`, and `scripts/verify-output.mjs` refuses to
finish if one survives. The strip is the fix; the check is what stops the strip
becoming a no-op when a directory or extension changes.

Deleting the asset was not assumed to be safe — the viewer harness was re-run
against a real archive afterwards, and the worker still starts and reads it. If
a future build genuinely loads that URL, the worker fails to start and
`perf/viewer.mjs` reports it.

---

## The worker is not currently earning its place

**Found in:** the Phase 1 controls, `perf/controls.mjs`, against
`export-1gb.zip` (synthetic).

**What was measured:** the same engine, run on the main thread instead of in a
worker, opening the same archive in a Pixel 5 profile.

| | open | thread paint | long tasks | frames over 32 ms | p99 frame |
| --- | --- | --- | --- | --- | --- |
| worker (as shipped) | 1752 ms | 297 ms | 0 | 4 of 289 | 33 ms |
| main thread | 1778 ms | 181 ms | 0 | 2 of 285 | 17 ms |

The main-thread arm is, if anything, slightly smoother. The first run of this
control used only the long-task observer and came back green; the frame-gap
instrument was added on the assumption that 50 ms was too coarse a threshold,
and it agreed with the first result.

**Why, most likely:** the engine awaits per message file, so it never
accumulates a long task, and zip.js runs inflate in its own workers regardless
of where it is called from. What our worker adds on top is a structured clone of
the parsed thread on every open — which is the plausible source of the 116 ms
the worker arm is *slower* to paint a thread.

**Why it has not been removed:** the difference is inside the noise either way,
and the fixtures are synthetic — 11 MB of message JSON across 203 files. A real
export with far more message text is the case that could separate them, and one
is expected. `engine.ts` knows nothing about workers, so deleting
`archive.worker.ts` and calling `createEngine` directly is a small change in
either direction.

**What would close it:** re-run `node perf/controls.mjs --only="main thread"`
against a real export. If the main-thread arm is still no worse, delete the
worker — and the shipped-source defect above stops being possible at all.
