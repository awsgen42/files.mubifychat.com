import type {
  CompleteUploadRequest,
  CreateFileItemResponse,
  CreateSessionResponse,
  JoinSessionResponse,
  ParticipantRole,
  UploadTarget,
} from '../shared/types';
import { formatLimit } from '../shared/limits';
import { MAX_SDP_BYTES, MAX_SIGNAL_BODY_BYTES, parseSignal } from '../shared/signal';
import { UPLOAD_PART_BYTES, isValidPartManifest, partCount, usesMultipart } from '../shared/upload';
import { hasPresignCredentials, readConfig, type Config, type Env } from './env';
import { DOWNLOAD_CONTENT_TYPE, contentDisposition, normalizeContentType, sanitizeFilename } from './files';
import {
  ApiError,
  badRequest,
  bearerToken,
  clientIp,
  json,
  notFound,
  readJson,
  tooLarge,
  unauthorized,
} from './http';
import { isValidCode, randomId } from './ids';
import { LIMITS, enforceRateLimit, enforcePollLimit, enforceUploadLimit } from './ratelimit';
import { abortSessionUploads, abortUpload } from './multipart';
import { adjustQuota, reserveQuota } from './quota';
import { presignUpload } from './presign';
import {
  authenticate,
  createSession,
  deleteSession,
  isExpired,
  joinSession,
  loadSession,
  objectKey,
  putSignal,
  saveSession,
  stripInternal,
  toView,
  touch,
  userItemCount,
  type StoredItem,
  type StoredSession,
} from './session';

interface Ctx {
  env: Env;
  config: Config;
  now: number;
  request: Request;
  url: URL;
}

/** Resolved session plus the authenticated caller's role. */
interface Authed {
  session: StoredSession;
  role: ParticipantRole;
}

export async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const ctx: Ctx = { env, config: readConfig(env), now: Date.now(), request, url };
  const segments = url.pathname.split('/').filter(Boolean); // ['api', 'sessions', ...]
  const method = request.method.toUpperCase();

  if (segments[1] !== 'sessions') throw notFound('Unknown endpoint.');

  // POST /api/sessions
  if (segments.length === 2 && method === 'POST') return createSessionRoute(ctx);

  const code = segments[2];
  if (!isValidCode(code)) throw notFound();

  // POST /api/sessions/:code/join
  if (segments.length === 4 && segments[3] === 'join' && method === 'POST') return joinRoute(ctx, code);

  // GET /api/sessions/:code
  if (segments.length === 3 && method === 'GET') return stateRoute(ctx, code);

  // POST /api/sessions/:code/end
  if (segments.length === 4 && segments[3] === 'end' && method === 'POST') return endRoute(ctx, code);

  if (segments[3] === 'items') {
    // POST /api/sessions/:code/items/text|file|signal
    if (segments.length === 5 && method === 'POST') {
      if (segments[4] === 'text') return sendTextRoute(ctx, code);
      if (segments[4] === 'file') return createFileItemRoute(ctx, code);
      if (segments[4] === 'signal') return sendSignalRoute(ctx, code);
    }
    // DELETE /api/sessions/:code/items/:id
    if (segments.length === 5 && method === 'DELETE') return cancelItemRoute(ctx, code, segments[4]);

    // /api/sessions/:code/items/:id/<action>
    if (segments.length === 6) {
      const itemId = segments[4];
      if (segments[5] === 'blob' && method === 'PUT') return proxyUploadRoute(ctx, code, itemId);
      if (segments[5] === 'complete' && method === 'POST') return completeUploadRoute(ctx, code, itemId);
      if (segments[5] === 'download' && method === 'GET') return downloadRoute(ctx, code, itemId);
    }

    // PUT /api/sessions/:code/items/:id/parts/:n
    if (segments.length === 7 && segments[5] === 'parts' && method === 'PUT') {
      return uploadPartRoute(ctx, code, segments[4], segments[6]);
    }
  }

  throw notFound('Unknown endpoint.');
}

/* ------------------------------------------------------------------ */
/* Session lifecycle                                                    */
/* ------------------------------------------------------------------ */

async function createSessionRoute(ctx: Ctx): Promise<Response> {
  await enforceRateLimit(ctx.env, clientIp(ctx.request), LIMITS.createSession);

  const body = await readJson<{ oneShot?: boolean }>(ctx.request).catch(() => ({}) as { oneShot?: boolean });
  const created = await createSession(ctx.env, ctx.config, ctx.now, body.oneShot === true);
  if (!created) throw new ApiError(503, 'no_code', 'Could not allocate a code right now. Please try again.');

  const response: CreateSessionResponse = {
    code: created.session.code,
    token: created.token,
    session: toView(created.session, ctx.config, 'host'),
  };
  return json(response, 201);
}

async function joinRoute(ctx: Ctx, code: string): Promise<Response> {
  await enforceRateLimit(ctx.env, clientIp(ctx.request), LIMITS.joinSession);

  const session = await requireLiveSession(ctx, code);
  const token = await joinSession(session, ctx.now);
  await saveSession(ctx.env, session, ctx.config, ctx.now);

  const response: JoinSessionResponse = {
    code: session.code,
    token,
    session: toView(session, ctx.config, 'guest'),
  };
  return json(response);
}

/**
 * Polled by both devices. Reading counts as activity, which is what keeps a
 * session that is being actively watched from timing out mid-transfer.
 */
async function stateRoute(ctx: Ctx, code: string): Promise<Response> {
  await enforcePollLimit(ctx.env, clientIp(ctx.request));
  const { session, role } = await requireAuth(ctx, code);
  const view = toView(session, ctx.config, role);

  // Slide the window, but avoid a KV write on every single poll.
  if (ctx.now - session.lastActivity > (ctx.config.idleTtlSeconds * 1000) / 3) {
    session.lastActivity = ctx.now;
    await saveSession(ctx.env, session, ctx.config, ctx.now);
  }
  return json(view);
}

async function endRoute(ctx: Ctx, code: string): Promise<Response> {
  const { session } = await requireAuth(ctx, code);
  // Before purgeObjects, which only knows about completed objects.
  await abortSessionUploads(ctx.env, session);
  await purgeObjects(ctx.env, session);
  await deleteSession(ctx.env, session);
  return json({ ok: true });
}

/* ------------------------------------------------------------------ */
/* Items                                                                */
/* ------------------------------------------------------------------ */

async function sendTextRoute(ctx: Ctx, code: string): Promise<Response> {
  await enforceRateLimit(ctx.env, clientIp(ctx.request), LIMITS.sendItem);
  const { session, role } = await requireAuth(ctx, code);

  const { text } = await readJson<{ text?: unknown }>(ctx.request);
  if (typeof text !== 'string' || text.length === 0) throw badRequest('Text cannot be empty.');
  if (text.length > ctx.config.maxTextChars) {
    throw tooLarge(`Text is limited to ${ctx.config.maxTextChars.toLocaleString()} characters.`);
  }
  assertItemBudget(session, ctx.config);

  const item: StoredItem = {
    id: randomId(8),
    kind: 'text',
    state: 'ready',
    from: role,
    createdAt: ctx.now,
    text,
    downloads: 0,
  };
  session.items.push(item);
  touch(session, ctx.now);
  await saveSession(ctx.env, session, ctx.config, ctx.now);

  return json(toView(session, ctx.config, role), 201);
}

/**
 * One half of a WebRTC handshake, posted so the peer can read it on its next
 * poll. This is the entire server-side surface of a direct transfer.
 *
 * Nothing here touches R2, the session byte budget or the per-IP daily quota,
 * and that is the point: on this path the file never reaches us. The only cost
 * is the item itself, which is why it is capped, deduplicated per participant,
 * and counted against neither the item budget nor the byte budgets.
 *
 * The `sendItem` bucket is reused rather than given a limiter of its own. A
 * handshake is two requests per attempt against a budget of 120 a minute, so
 * it cannot crowd out real sends, and a new binding would cost a deploy-time
 * dependency for something this rare.
 */
async function sendSignalRoute(ctx: Ctx, code: string): Promise<Response> {
  await enforceRateLimit(ctx.env, clientIp(ctx.request), LIMITS.sendItem);
  const { session, role } = await requireAuth(ctx, code);

  // Before readJson, so an oversized body is refused rather than parsed. The
  // SDP cap below only applies to a string that already exists in memory.
  const declaredLength = Number(ctx.request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_SIGNAL_BODY_BYTES) throw tooLarge('That handshake is too large.');

  const parsed = parseSignal(await readJson<{ role?: unknown; sdp?: unknown }>(ctx.request));
  if (!parsed.ok) {
    if (parsed.reason === 'too_large') {
      throw tooLarge(`A session description is limited to ${MAX_SDP_BYTES / 1024} KB.`);
    }
    throw badRequest('That is not a valid handshake.');
  }

  putSignal(session, {
    id: randomId(8),
    kind: 'signal',
    state: 'ready',
    from: role,
    createdAt: ctx.now,
    role: parsed.payload.role,
    sdp: parsed.payload.sdp,
    downloads: 0,
  });
  touch(session, ctx.now);
  await saveSession(ctx.env, session, ctx.config, ctx.now);

  return json(toView(session, ctx.config, role), 201);
}

async function createFileItemRoute(ctx: Ctx, code: string): Promise<Response> {
  await enforceRateLimit(ctx.env, clientIp(ctx.request), LIMITS.sendItem);
  const { session, role } = await requireAuth(ctx, code);

  const body = await readJson<{ name?: unknown; size?: unknown; contentType?: unknown }>(ctx.request);
  // typeof before Number(): JSON null and true coerce to 0 and 1, which are
  // perfectly good integers and would quietly create an item. Integer rather
  // than merely finite, because a fractional size would give partCount a
  // non-integral number of parts to reason about.
  const size = typeof body.size === 'number' ? body.size : NaN;
  if (!Number.isInteger(size) || size < 0) throw badRequest('A whole-number file size is required.');
  if (size > ctx.config.maxFileBytes) {
    throw tooLarge(`Files are limited to ${formatLimit(ctx.config.maxFileBytes)}.`);
  }
  if (session.bytesUsed + size > ctx.config.maxSessionBytes) {
    throw tooLarge(`This session has reached its ${formatLimit(ctx.config.maxSessionBytes)} total.`);
  }
  assertItemBudget(session, ctx.config);

  // Charged before any bytes move, so an upload that would blow the day's
  // budget is refused up front rather than after it has been transferred.
  // Reconciled to the measured size at completion, and released on cancel.
  await reserveQuota(ctx.env, clientIp(ctx.request), size, ctx.now);

  const item: StoredItem = {
    id: randomId(8),
    kind: 'file',
    state: 'pending',
    from: role,
    createdAt: ctx.now,
    name: sanitizeFilename(body.name),
    size,
    contentType: normalizeContentType(body.contentType),
    downloads: 0,
    key: '',
  };
  item.key = objectKey(session, item.id);

  // Opened before the item is saved, so the uploadId is persisted in the same
  // write. An upload we opened but failed to record would be unabortable.
  const multipart = usesMultipart(size) ? await ctx.env.FILES.createMultipartUpload(item.key, {
    httpMetadata: { contentType: DOWNLOAD_CONTENT_TYPE },
    customMetadata: { sessionCode: session.code, sessionId: session.id },
  }) : null;
  if (multipart) {
    item.uploadId = multipart.uploadId;
    item.partSize = UPLOAD_PART_BYTES;
  }

  // Reserved now against the declared size; reconciled to the real size once
  // the upload is confirmed, so a lie about size can't be used to overshoot.
  session.bytesUsed += size;
  session.items.push(item);
  touch(session, ctx.now);
  await saveSession(ctx.env, session, ctx.config, ctx.now);

  // Absolute, because the client may be served from a different origin than
  // the API and would otherwise PUT to its own host.
  const base = `${ctx.url.origin}/api/sessions/${session.code}/items/${item.id}`;
  const upload: UploadTarget = multipart
    ? {
        mode: 'multipart',
        // Still a working single-PUT endpoint. A client from before multipart
        // ignores the mode and uses this, and completeUploadRoute copes.
        url: `${base}/blob`,
        headers: {},
        partsUrl: `${base}/parts`,
        partSize: UPLOAD_PART_BYTES,
      }
    : hasPresignCredentials(ctx.env)
      ? { mode: 'presign', url: await presignUpload(ctx.env, item.key), headers: {} }
      : { mode: 'proxy', url: `${base}/blob`, headers: {} };

  const response: CreateFileItemResponse = {
    item: stripInternal(item),
    upload,
    session: toView(session, ctx.config, role),
  };
  return json(response, 201);
}

/**
 * Single-request upload path: bytes stream through the Worker into R2.
 *
 * Still reachable for a multipart item, because a client loaded before
 * multipart shipped will use it regardless of what the create response said.
 * In that case the multipart upload we opened is dead weight and is aborted
 * here rather than left to the lifecycle rule.
 */
async function proxyUploadRoute(ctx: Ctx, code: string, itemId: string): Promise<Response> {
  const { session } = await requireAuth(ctx, code);
  const item = requirePendingItem(session, itemId);

  if (!ctx.request.body) throw badRequest('Missing request body.');
  if (item.uploadId) {
    await abortUpload(ctx.env, item);
    item.partSize = undefined;
    await saveSession(ctx.env, session, ctx.config, ctx.now);
  }
  await ctx.env.FILES.put(item.key!, ctx.request.body, {
    httpMetadata: { contentType: DOWNLOAD_CONTENT_TYPE },
    customMetadata: { sessionCode: session.code, sessionId: session.id },
  });
  return json({ ok: true });
}

/**
 * Receives one part. Each part is an independent request against an uploadId
 * that lives in R2, not in this Worker, so a part can be retried on its own
 * and a deploy in the middle of an upload is harmless.
 *
 * The returned etag is what the client stores and hands back at completion.
 */
async function uploadPartRoute(ctx: Ctx, code: string, itemId: string, rawPart: string): Promise<Response> {
  await enforceUploadLimit(ctx.env, clientIp(ctx.request));
  const { session } = await requireAuth(ctx, code);
  const item = requirePendingItem(session, itemId);

  if (!item.uploadId) throw badRequest('That upload is not resumable. Please start it again.');
  if (!ctx.request.body) throw badRequest('Missing request body.');

  const partSize = item.partSize ?? UPLOAD_PART_BYTES;
  const partNumber = Number(rawPart);
  const total = partCount(item.size ?? 0, partSize);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > total) {
    throw badRequest('That part number is not part of this upload.');
  }

  // Without this the part number is the only bound on how much can be sent:
  // the declared size buys N part slots, and each slot would otherwise accept
  // a body up to the Workers request limit. At a 1 GB declared size that is
  // 41 slots of 100 MB — four times the file, transferred and charged against
  // nothing, which would make the daily byte quota meaningless.
  const declaredLength = Number(ctx.request.headers.get('content-length'));
  if (!Number.isInteger(declaredLength) || declaredLength < 0) {
    throw badRequest('A part must declare its length.');
  }
  if (declaredLength > partSize) {
    throw tooLarge(`A part may not exceed ${formatLimit(partSize)}.`);
  }

  const uploaded = await ctx.env.FILES
    .resumeMultipartUpload(item.key!, item.uploadId)
    .uploadPart(partNumber, ctx.request.body);

  // A large upload can outlast the idle window on its own, and the client's
  // poller — which is what normally slides it — stops while the tab is
  // backgrounded. Slide it here too, throttled exactly as stateRoute is, so a
  // long upload costs at most one extra write per third of the window.
  if (ctx.now - session.lastActivity > (ctx.config.idleTtlSeconds * 1000) / 3) {
    session.lastActivity = ctx.now;
    await saveSession(ctx.env, session, ctx.config, ctx.now);
  }

  return json({ partNumber: uploaded.partNumber, etag: uploaded.etag });
}

/**
 * Cancels a pending upload and releases everything it reserved. Without this
 * the parts would survive until the lifecycle rule swept them and the session
 * would stay charged for bytes that never arrived.
 */
async function cancelItemRoute(ctx: Ctx, code: string, itemId: string): Promise<Response> {
  const { session, role } = await requireAuth(ctx, code);
  const item = session.items.find((i) => i.id === itemId);
  if (!item || item.kind !== 'file') throw notFound('Unknown upload.');
  if (item.state !== 'pending') throw badRequest('That upload has already been completed.');

  await abortUpload(ctx.env, item);
  // Best-effort: a single-PUT upload may already have written the object.
  if (item.key) await ctx.env.FILES.delete(item.key).catch(() => undefined);

  session.bytesUsed = Math.max(0, session.bytesUsed - (item.size ?? 0));
  // Releases the reservation. A cancelled upload did move some bytes, but the
  // reservation was for the whole declared size, so returning it is closer to
  // the truth than keeping it — and it stops a flaky connection burning the
  // day's budget on uploads that never landed.
  await adjustQuota(ctx.env, clientIp(ctx.request), -(item.size ?? 0), ctx.now);
  session.items = session.items.filter((i) => i.id !== itemId);
  touch(session, ctx.now);
  await saveSession(ctx.env, session, ctx.config, ctx.now);

  return json(toView(session, ctx.config, role));
}

/**
 * Marks the file downloadable. The stored object is measured here rather than
 * trusted from the client, since neither a presigned PUT nor a client-supplied
 * part list is evidence of what actually landed.
 */
async function completeUploadRoute(ctx: Ctx, code: string, itemId: string): Promise<Response> {
  const { session, role } = await requireAuth(ctx, code);
  const item = requirePendingItem(session, itemId);

  if (item.uploadId) await assembleParts(ctx, session, item);

  const object = await ctx.env.FILES.head(item.key!);
  if (!object) throw badRequest('Upload was not received. Please try again.');

  const declared = item.size ?? 0;
  const actual = object.size;
  const projected = session.bytesUsed - declared + actual;

  if (actual > ctx.config.maxFileBytes || projected > ctx.config.maxSessionBytes) {
    await abortUpload(ctx.env, item);
    await ctx.env.FILES.delete(item.key!);
    session.bytesUsed -= declared;
    session.items = session.items.filter((i) => i.id !== item.id);
    touch(session, ctx.now);
    await saveSession(ctx.env, session, ctx.config, ctx.now);
    // The bytes did move, so the day's budget keeps whatever was actually
    // sent; only the difference from the reservation is corrected.
    await adjustQuota(ctx.env, clientIp(ctx.request), actual - declared, ctx.now);
    throw tooLarge('That upload exceeded the size limit and was discarded.');
  }

  await adjustQuota(ctx.env, clientIp(ctx.request), actual - declared, ctx.now);
  session.bytesUsed = projected;
  item.size = actual;
  item.state = 'ready';
  // The upload is now an object; there is nothing left to abort.
  item.uploadId = undefined;
  item.partSize = undefined;
  touch(session, ctx.now);
  await saveSession(ctx.env, session, ctx.config, ctx.now);

  return json(toView(session, ctx.config, role));
}

async function downloadRoute(ctx: Ctx, code: string, itemId: string): Promise<Response> {
  const { session } = await requireAuth(ctx, code);
  const item = session.items.find((i) => i.id === itemId);
  if (!item || item.kind !== 'file' || !item.key) throw notFound('That file is not part of this session.');
  if (item.state === 'consumed') throw notFound('That file was a one-time download and has already been claimed.');
  if (item.state !== 'ready') throw notFound('That file is still uploading.');

  // Range requests would let a one-shot item be fetched piecemeal, so they are
  // only offered on normal sessions.
  const wantsRange = !session.oneShot && ctx.request.headers.has('range');
  const object = await ctx.env.FILES.get(item.key, wantsRange ? { range: ctx.request.headers } : undefined);
  if (!object) throw notFound('That file is no longer available.');

  const filename = item.name ?? 'file';
  const headers = new Headers({
    'content-type': DOWNLOAD_CONTENT_TYPE,
    'content-disposition': contentDisposition(filename),
    'x-content-type-options': 'nosniff',
    // Shared files are private and short-lived: never cached by an
    // intermediary, never indexed if a URL with its token ever leaks.
    'cache-control': 'private, no-store',
    'x-robots-tag': 'noindex, nofollow',
    'accept-ranges': session.oneShot ? 'none' : 'bytes',
    'content-length': String(object.size),
  });

  let status = 200;
  const range = object.range as { offset?: number; length?: number } | undefined;
  if (wantsRange && range) {
    const start = range.offset ?? 0;
    const length = range.length ?? object.size - start;
    // R2 reports a full-span range even when the request covered everything;
    // that still deserves a plain 200.
    if (start > 0 || length < object.size) {
      headers.set('content-range', `bytes ${start}-${start + length - 1}/${object.size}`);
      headers.set('content-length', String(length));
      status = 206;
    }
  }

  item.downloads += 1;
  // The object itself is left for the cleanup job; deleting it mid-stream would
  // truncate the response the recipient is still reading.
  if (session.oneShot) item.state = 'consumed';
  touch(session, ctx.now);
  await saveSession(ctx.env, session, ctx.config, ctx.now);

  return new Response(object.body, { status, headers });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/**
 * Turns the uploaded parts into an object.
 *
 * The manifest comes from the client because the binding offers no way to list
 * what was uploaded — but it is not trusted: R2 rejects any etag that does not
 * match a part it actually holds, and the caller re-measures the finished
 * object against the limits regardless.
 *
 * A client that used the single-PUT fallback sends no manifest; in that case
 * the multipart upload is abandoned and the object it already wrote stands.
 */
async function assembleParts(ctx: Ctx, session: StoredSession, item: StoredItem): Promise<void> {
  const body = await readJson<CompleteUploadRequest>(ctx.request).catch(() => ({}) as CompleteUploadRequest);

  if (body.parts === undefined) {
    await abortUpload(ctx.env, item);
    item.partSize = undefined;
    await saveSession(ctx.env, session, ctx.config, ctx.now);
    return;
  }

  const expected = partCount(item.size ?? 0, item.partSize ?? UPLOAD_PART_BYTES);
  if (!isValidPartManifest(body.parts, expected)) {
    throw badRequest('That upload is incomplete. Please send it again.');
  }

  const ordered = [...body.parts].sort((a, b) => a.partNumber - b.partNumber);
  try {
    await ctx.env.FILES.resumeMultipartUpload(item.key!, item.uploadId!).complete(ordered);
  } catch (err) {
    // R2 validates part sizes and etags here, so this is where a corrupted or
    // partial manifest surfaces. Nothing is recoverable at that point.
    console.error('multipart complete failed', item.key, err);
    await abortUpload(ctx.env, item);
    throw badRequest('That upload could not be assembled. Please send it again.');
  }
}

/**
 * Signal items are excluded: they are handshake plumbing, bounded at four by
 * putSignal, and charging them against the user's budget would let two direct
 * transfers eat into what can actually be shared.
 */
function assertItemBudget(session: StoredSession, config: Config): void {
  if (userItemCount(session) >= config.maxItems) {
    throw tooLarge(`A session can hold at most ${config.maxItems} items.`);
  }
}

function requirePendingItem(session: StoredSession, itemId: string): StoredItem {
  const item = session.items.find((i) => i.id === itemId);
  if (!item || item.kind !== 'file' || !item.key) throw notFound('Unknown upload.');
  if (item.state !== 'pending') throw badRequest('That upload has already been completed.');
  return item;
}

async function requireLiveSession(ctx: Ctx, code: string): Promise<StoredSession> {
  const session = await loadSession(ctx.env, code);
  if (!session) throw notFound();
  if (isExpired(session, ctx.config, ctx.now)) {
    // Opportunistic: this only runs if someone happens to touch the code after
    // it expires. A session nobody returns to is the lifecycle rule's job.
    await abortSessionUploads(ctx.env, session);
    await purgeObjects(ctx.env, session);
    await deleteSession(ctx.env, session);
    throw notFound('That session has expired.');
  }
  return session;
}

async function requireAuth(ctx: Ctx, code: string): Promise<Authed> {
  const session = await requireLiveSession(ctx, code);
  const role = await authenticate(session, bearerToken(ctx.request, ctx.url));
  if (!role) throw unauthorized();
  return { session, role };
}

async function purgeObjects(env: Env, session: StoredSession): Promise<void> {
  const keys = session.items.map((i) => i.key).filter((k): k is string => Boolean(k));
  if (keys.length > 0) await env.FILES.delete(keys);
}
