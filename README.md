# Mubifiles

Instant text & file sharing between devices. Open Mubifiles on your phone, paste
text or drop a file, and read the 6-digit code (or scan the QR) on your PC — no
app, no account.

The code opens a **session**, not a one-shot link: once both devices are paired
they keep sending things back and forth under the same code until the session
goes quiet.

This repository implements **Phase 1 (MVP)** of the project plan.

## What's here

| | |
|---|---|
| UI | Next.js (App Router), statically exported, Tailwind CSS v4 |
| API | A single Cloudflare Worker (`worker/`) |
| Session metadata | Cloudflare KV, with a sliding TTL |
| File bodies | Cloudflare R2 (zero egress fees) |
| Cleanup | Cron-triggered Worker, plus two R2 lifecycle rules as backstops |

The Worker serves the exported UI through its assets binding and handles
`/api/*` itself, so the whole app deploys as one `wrangler deploy`.

### Implemented

- Text and file sharing under a shared 6-digit code + QR
- Session pairing, with both devices able to send
- Sliding 15-minute inactivity expiry, capped at 24 hours
- Optional one-time-download mode
- Live status via polling (device joined, new item shared)
- Upload progress with speed and ETA
- Direct browser → R2 uploads via presigned URLs, with a Worker-proxied fallback
- Responsive mobile-first UI, dark / light theme
- Per-IP rate limiting on session creation and code entry

Phases 2–5 from the plan (zip, password protection, previews, PWA, accounts,
WebSocket pairing, Turnstile) are not implemented.

## Architecture

```
Device A ──POST /api/sessions──────────▶ Worker ──▶ KV   session:<code>
         ◀─ code + token                                 sid:<id> ─┐
                                                                   │ GC index
Device A ──POST .../items/file────────▶ Worker ──▶ presigned PUT   │
Device A ──PUT (bytes)────────────────────────────────────▶ R2 ◀──┘
Device A ──POST .../items/:id/complete▶ Worker (measures the real object size)

Device B ──POST /api/sessions/<code>/join▶ Worker  → status: active
Device B ──GET  /api/sessions/<code>   ▶ Worker  (polled every 2s)
Device B ──GET  .../items/:id/download ▶ Worker ──▶ R2 (streamed back)
```

Every send or fetch rewrites the KV entry with a fresh TTL, which is what keeps
an active session alive. When the TTL lapses the metadata disappears on its own;
the cron job then sweeps R2 for objects whose session is gone.

### Session lifetime

- Idle timeout: `SESSION_IDLE_TTL_SECONDS` (default 900) — slides on activity
- Hard cap: `SESSION_MAX_TTL_SECONDS` (default 86400) — never slides
- "End session" deletes the metadata and the objects immediately

### Security

- Codes are uniformly random (rejection-sampled, so no modulo bias) and are only
  valid while the session lives
- Every request needs a bearer token issued at create/join; tokens are stored
  as SHA-256 hashes and compared in constant time
- Downloads are always served as `application/octet-stream` with
  `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`, so an
  uploaded `.html` or `.svg` can never execute on the origin
- Filenames are stripped of path separators and control characters
- Uploaded object sizes are measured server-side, not trusted from the client
- Per-IP fixed-window rate limits on session creation, joining, and sending

## Local development

```bash
npm install
npm run dev          # Next dev server, UI only (no API)
npm run dev:worker   # full stack: builds the UI, runs the Worker with local KV + R2
npm test             # unit tests
npm run typecheck    # app and Worker type checks
```

`npm run dev:worker` serves everything on http://127.0.0.1:8787 using
Miniflare's local KV and R2 emulation — no Cloudflare account needed. In local
mode there are no R2 S3 credentials, so uploads take the Worker-proxied path.

## Deploying

1. **Create the resources**

   ```bash
   npx wrangler kv namespace create SESSIONS
   npx wrangler kv namespace create SESSIONS --preview
   npx wrangler r2 bucket create mubifiles
   ```

   Put the returned namespace ids into `wrangler.jsonc` in place of the
   `REPLACE_WITH_...` placeholders.

2. **Optional: enable direct browser → R2 uploads.** Without these secrets the
   Worker proxies upload bodies, which works but is capped by the Workers
   request-body limit. Create an R2 API token (Object Read & Write) and set:

   ```bash
   npx wrangler secret put R2_ACCOUNT_ID
   npx wrangler secret put R2_ACCESS_KEY_ID
   npx wrangler secret put R2_SECRET_ACCESS_KEY
   npx wrangler secret put R2_BUCKET_NAME
   ```

   Uploads currently run through the Worker, so these are unset in production.
If that changes, note that only the part PUTs need presigning: a multipart
upload can be driven from either the Workers API or the S3 API, so it can still
be created, completed and aborted on the binding as it is now. The client-side
part loop, the resume manifest and the abort paths are transport-independent
and carry over unchanged.

Presigned uploads are cross-origin, so the bucket also needs CORS
   (`wrangler r2 bucket cors put mubifiles --file cors.json`):

   ```json
   [
     {
       "AllowedOrigins": ["https://files.mubify.com"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": [],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

3. **Lifecycle rules.** R2 dashboard → the bucket → Settings → Object lifecycle
   rules. These are different actions, not alternatives — both are needed.

   | Rule | Prefix | Action | After |
   |---|---|---|---|
   | `expire-session-objects` | `sessions/` | Delete objects | 2 days |
   | `abort-incomplete-multipart` | `sessions/` | Abort incomplete multipart uploads | 2 days |

   The first is a backstop in case the cron job stops running. It is not the
   primary deletion path — that is `purgeObjects` when a session ends and
   `collectGarbage` every fifteen minutes — so its window only bounds how long
   an orphan survives a broken cron.

   The second is **not optional**, and it is the only thing covering one case.
   The parts of an incomplete multipart upload are not objects: they never
   appear in `FILES.list()`, so the cron sweep cannot see them, and deleting the
   key they are destined for does not remove them either. The Worker aborts
   explicitly on cancel, on session end, on a failed completion and — if anyone
   touches the code again — on expiry. But an upload that is simply abandoned
   leaves no signal at all, and once the session document expires out of KV the
   uploadId is gone for good. Only this rule reclaims those.

   2 days rather than 1 for both, because a live session can be up to 24h old.
   A 1-day rule sits exactly on that boundary: it could abort an upload, or
   delete a file, belonging to a session that is still legitimately alive. Both
   would fail silently and be miserable to debug. If the hard session cap ever
   rises above 24h, raise both of these with it.

   R2 also applies its own Default Multipart Abort Rule at 7 days. That is a
   floor, not a substitute — 7 days of abandoned parts is far longer than a
   session can live, so the 2-day rule above is what actually bounds it.

4. **Deploy**

   ```bash
   npm run deploy
   ```

### Deploying from CI

`.github/workflows/deploy.yml` type-checks, tests and builds on every push and
pull request, then deploys pushes to `main`. It needs two repository secrets
(Settings → Secrets and variables → Actions):

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | My Profile → API Tokens. Needs Workers Scripts:Edit, Workers KV Storage:Edit, Workers R2 Storage:Edit, Account Settings:Read |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard sidebar, or `wrangler whoami` |

Step 1 (creating the KV namespace and R2 bucket) is still a one-time manual
step — CI deploys against resources that already exist. The deploy job targets
the `production` GitHub environment, so you can add a required reviewer there if
you want deploys gated.

### Split hosting: UI on Vercel, API on Cloudflare

The Worker always serves the bundled UI, so single-origin Cloudflare hosting
keeps working. To additionally front it with Vercel:

1. **Deploy the UI to Vercel.** `vercel.json` pins `outputDirectory` to
   `.next`, which is where the Next.js builder expects `routes-manifest.json`.
   Do not point it at `out/` — the builder finds the exported files itself by
   reading `output: 'export'` from `next.config.ts`, and an `out/` override
   fails the build at the packaging step even though the compile succeeds.

   Set one environment variable in the Vercel project:

   ```
   NEXT_PUBLIC_API_BASE_URL = https://mubifiles.<subdomain>.workers.dev
   ```

   It is inlined at build time, so changing it needs a redeploy. Leave it unset
   for the Cloudflare build, where relative `/api/*` paths are correct.

2. **Allow the Vercel origin on the Worker.** Set `ALLOWED_ORIGINS` in
   `wrangler.jsonc` to a comma-separated list and redeploy:

   ```jsonc
   "ALLOWED_ORIGINS": "https://www.mubifiles.com,https://mubifiles.com"
   ```

   Origins are matched exactly and echoed back individually — never `*`. An
   unlisted origin gets no CORS headers, so the browser blocks it. Preview
   deployments get a new URL each time, so add the specific ones you want to
   work, or a stable alias.

Worth knowing about this topology:

- **Downloads still stream through the Worker**, so Cloudflare's zero egress
  still applies to the bulk of the traffic. Vercel only serves the UI and small
  JSON calls.
- **`download` on an anchor is ignored cross-origin.** Downloads work because
  the Worker sends `Content-Disposition: attachment`, which is also where the
  filename comes from.
- **Tokens travel in the `Authorization` header, not cookies**, so
  `Allow-Credentials` stays off and there is no ambient authority to steal.
  Downloads use `?t=` instead, which conveniently avoids a preflight on a plain
  navigation.
- Two hosts means two deploys and two places to look when something breaks.
  Single-origin Cloudflare remains the simpler option if you do not need Vercel.

### Tunable limits

Set in `wrangler.jsonc` under `vars`:

| Var | Default | Meaning |
|---|---|---|
| `SESSION_IDLE_TTL_SECONDS` | 900 | Sliding inactivity window |
| `SESSION_MAX_TTL_SECONDS` | 86400 | Hard cap on session lifetime |
| `MAX_FILE_BYTES` | 104857600 | Per-file limit (100 MB) |
| `MAX_SESSION_BYTES` | 524288000 | Total per session (500 MB) |
| `MAX_ITEMS` | 50 | Items per session |
| `MAX_TEXT_CHARS` | 100000 | Characters per text item |
| `ALLOWED_ORIGINS` | `""` | Comma-separated origins allowed to call the API cross-origin. Empty means same-origin only. |

## API

All routes take `Authorization: Bearer <token>` except create and join.
Downloads accept `?t=<token>` instead, since they are plain browser navigations.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/sessions` | Create a session; returns code + host token |
| `POST` | `/api/sessions/:code/join` | Pair the second device; returns guest token |
| `GET` | `/api/sessions/:code` | Poll session state (participants, items) |
| `POST` | `/api/sessions/:code/items/text` | Share a text item |
| `POST` | `/api/sessions/:code/items/file` | Reserve a file item; returns an upload target |
| `PUT` | `/api/sessions/:code/items/:id/blob` | Proxied upload (fallback path only) |
| `POST` | `/api/sessions/:code/items/:id/complete` | Confirm the upload landed |
| `GET` | `/api/sessions/:code/items/:id/download` | Download a file |
| `POST` | `/api/sessions/:code/end` | Close the session and delete everything |

## Known limitations

- A session document is a single KV value, so two devices writing in the same
  instant can lose one write. With two paired devices this is rare; moving to D1
  (planned for Phase 2) removes it.
- KV is eventually consistent, so a session can occasionally take a few seconds
  to become visible in a distant region.
- Rate limiting is a KV counter and is therefore approximate across colos.
- Uploads that are abandoned mid-transfer leave a pending item until the session
  expires.
