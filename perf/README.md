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
python3 perf/make-export.py perf/fixtures/export-small.zip 0.05
python3 perf/make-export.py perf/fixtures/export-500mb.zip 0.5
python3 perf/make-export.py perf/fixtures/export-1gb.zip 1
python3 perf/make-export.py perf/fixtures/export-2gb.zip 2
python3 perf/make-export.py perf/fixtures/export-media-700mb.zip 0.7 --media-heavy
python3 perf/make-export.py perf/fixtures/export-big-media.zip 0.6 --media-heavy --big-media
```

The four plain fixtures hold the *same* conversations — 199 threads, 99,859
messages, 11 MB of message JSON — and differ only in how much inert media is
padded in to reach the target size. That is deliberate and it is also the
limitation to keep in mind when reading the numbers: they isolate archive size
from message volume, and they therefore cannot show archive size mattering.

`--media-heavy` puts the bytes in many small attachments *inside conversations*
(4,200 photos of 180 KB). `--big-media` puts a similar total in few large ones
(48 videos averaging 14 MB). Those two test different halves of the media
default and cannot be told apart in one archive.

Synthetic Instagram "Download your information" archives. **Not real exports** —
every number measured against them is labelled synthetic. They reproduce the
directory shape, threads split across `message_1.json` / `message_2.json`
newest-first and unordered across files, Instagram's latin-1 mojibake, and
`is_unsent` records.

Byte-reproducible: the RNG is seeded and the zip timestamps are pinned, because
two runs otherwise differed in bytes while containing identical data.

The digests are in `fixtures/DIGESTS.txt` and are regenerated whenever
make-export.py changes — they pin the script's current output, not a historical
one.

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
| `npm --prefix perf run viewer` | the whole viewer, per fixture: open, thread paint, DOM rows, search, jump, media |
| `npm --prefix perf run controls` | the sabotage controls — worker bypass, virtualisation off |
| `node perf/media-control.mjs <fixture>` | text-only vs media-on, same archive, same scroll |

`viewer.mjs` and `controls.mjs` take a fixture name as their first argument;
`controls.mjs` also takes `--only=<substring>` to run one control.

### What the controls are for

`controls.mjs` edits the source, rebuilds, measures, and restores in a
`finally`. A control that comes back GREEN is a finding, not a pass: it means
the decision it guards is not doing anything. That has happened once here — see
"The worker is not currently earning its place" in KNOWN-DEFECTS.md — and the
first response was to sharpen the instrument rather than accept the result.

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
