# Measurement harness

Everything that produces a number in a commit message lives here, so the
numbers can be re-run rather than taken on trust. A previous round of this work
lost its entire harness when the container recycled, which meant several
published figures could not be reproduced by anyone, including me.

## Install

```
npm --prefix perf ci
```

**A separate npm project on purpose.** Playwright is not a devDependency of the
app: the deploy runs `npm ci` at the repo root, devDependencies are installed
there, and the `playwright` package downloads browser binaries on install
unless `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` happens to be set on that machine.
Nothing in here is imported by application code, so it does not belong in the
app's dependency graph. `perf/package-lock.json` pins the version, so this is
reproducible in a way `npm install --no-save` never was.

The browser itself is expected at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`;
override with `MUBIFILES_CHROME`.

## Fixtures

```
python3 perf/make-export.py perf/fixtures/export-2gb.zip 2
python3 perf/make-export.py perf/fixtures/export-small.zip 0.05
```

Synthetic Instagram "Download your information" archives. **Not real exports** —
every number measured against them is labelled synthetic. They reproduce the
directory shape, threads split across `message_1.json` / `message_2.json`
newest-first and unordered across files, Instagram's latin-1 mojibake, and
`is_unsent` records.

Byte-reproducible: the RNG is seeded and the zip timestamps are pinned, because
two runs otherwise differed in bytes while containing identical data. Recorded
in `fixtures/DIGESTS.txt`:

```
0673bd5ece4547f064ce65f85089f74ae4bee2c12f01752e9d5e7cadf4b6f3ac  export-2gb.zip
fca6c80edf7240eda3c1f8759bf8cc7ea1cc0bb281adc2af51833ad570c36d69  export-small.zip
```

The fixtures themselves are gitignored — 2 GB does not belong in a repository.
The script that makes them is the artefact.

## Running

Most harnesses need the built site served from disk:

```
npm run build
cd out && npx serve -p 8791 -L .
```

| command | what it answers |
| --- | --- |
| `npm --prefix perf run calibrate` | does the memory instrument see a known 300 MB? |
| `npm --prefix perf run worker-probe` | does the worker execute in a real worker scope? |
| `npm --prefix perf run bundle-cost` | shipped JS bytes per zip-library variant |
| `npm --prefix perf run zip-memory` | PSS while listing a 2 GB archive's entries |

`pss.mjs` is the shared instrument. Every harness that quotes memory calibrates
first and exits non-zero if the calibration fails.

## Reproducing the fflate arm

`perf/variants/fflate.ts` is kept as the record of the comparison, but fflate is
no longer a dependency — it lost. To re-run that arm:

```
npm install fflate      # then revert; it is not a dependency of the app
npm --prefix perf run bundle-cost
```

`perf/` is excluded from the app's tsconfig: the variants are inputs to a build
experiment, not application source, and one of them imports a package the app
deliberately does not have.
