# Known defects

Things that are wrong, are not being fixed this minute, and should not be
rediscovered from scratch later. Each entry names the commit it appeared in and
what would close it.

---

## Worker source shipped as a public asset

**Appeared in:** `f24b684` — "Phase 1 groundwork: settle the worker, and pick
the zip library on numbers"

**What happens:** building with a module worker constructed as

```js
new Worker(new URL('../lib/instagram/probe.worker.ts', import.meta.url), { type: 'module' })
```

makes Turbopack copy the worker's **TypeScript source verbatim** into
`out/_next/static/media/probe.worker.<hash>.ts`, alongside the compiled chunks
the worker actually loads through Turbopack's worker shim.

**Why it is not urgent:** nothing fetches it. The worker runs from the compiled
chunks; the `.ts` is dead weight. It is also served with
`Content-Type: video/mp2t`, so a browser would refuse to execute it anyway.

**Why it is not nothing:** it is application source on a public origin, and it
is bytes in every deploy for no reason. Source disclosure is minor for a client
side tool whose bundle is readable regardless — but "minor" is not "fine", and
it is not something to discover from a stranger.

**What would close it:** either a build step that removes `static/media/*.ts`
from the export after `next build`, verified by `scripts/verify-output.mjs`
refusing to finish when one is present; or a worker entry that Turbopack does
not treat as an asset. Decide before the Instagram viewer ships — not while the
page is still excluded from the sitemap.

**Check it is still true:**

```
find out/_next -name '*.ts'
```
