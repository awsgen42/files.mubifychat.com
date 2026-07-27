import type {
  CreateFileItemResponse,
  CreateSessionResponse,
  JoinSessionResponse,
  ParticipantRole,
  UploadTarget,
} from '../shared/types';
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
import { LIMITS, enforceRateLimit } from './ratelimit';
import { presignUpload } from './presign';
import {
  authenticate,
  createSession,
  deleteSession,
  isExpired,
  joinSession,
  loadSession,
  objectKey,
  saveSession,
  toView,
  touch,
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
    // POST /api/sessions/:code/items/text|file
    if (segments.length === 5 && method === 'POST') {
      if (segments[4] === 'text') return sendTextRoute(ctx, code);
      if (segments[4] === 'file') return createFileItemRoute(ctx, code);
    }
    // /api/sessions/:code/items/:id/<action>
    if (segments.length === 6) {
      const itemId = segments[4];
      if (segments[5] === 'blob' && method === 'PUT') return proxyUploadRoute(ctx, code, itemId);
      if (segments[5] === 'complete' && method === 'POST') return completeUploadRoute(ctx, code, itemId);
      if (segments[5] === 'download' && method === 'GET') return downloadRoute(ctx, code, itemId);
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

async function createFileItemRoute(ctx: Ctx, code: string): Promise<Response> {
  await enforceRateLimit(ctx.env, clientIp(ctx.request), LIMITS.sendItem);
  const { session, role } = await requireAuth(ctx, code);

  const body = await readJson<{ name?: unknown; size?: unknown; contentType?: unknown }>(ctx.request);
  const size = Number(body.size);
  if (!Number.isFinite(size) || size < 0) throw badRequest('A numeric file size is required.');
  if (size > ctx.config.maxFileBytes) {
    throw tooLarge(`Files are limited to ${Math.round(ctx.config.maxFileBytes / 1024 / 1024)} MB.`);
  }
  if (session.bytesUsed + size > ctx.config.maxSessionBytes) {
    throw tooLarge('This session has reached its total storage limit.');
  }
  assertItemBudget(session, ctx.config);

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

  // Reserved now against the declared size; reconciled to the real size once
  // the upload is confirmed, so a lie about size can't be used to overshoot.
  session.bytesUsed += size;
  session.items.push(item);
  touch(session, ctx.now);
  await saveSession(ctx.env, session, ctx.config, ctx.now);

  const upload: UploadTarget = hasPresignCredentials(ctx.env)
    ? { mode: 'presign', url: await presignUpload(ctx.env, item.key), headers: {} }
    : { mode: 'proxy', url: `/api/sessions/${session.code}/items/${item.id}/blob`, headers: {} };

  const response: CreateFileItemResponse = {
    item: stripKey(item),
    upload,
    session: toView(session, ctx.config, role),
  };
  return json(response, 201);
}

/** Fallback upload path: bytes stream through the Worker into R2. */
async function proxyUploadRoute(ctx: Ctx, code: string, itemId: string): Promise<Response> {
  const { session } = await requireAuth(ctx, code);
  const item = requirePendingItem(session, itemId);

  if (!ctx.request.body) throw badRequest('Missing request body.');
  await ctx.env.FILES.put(item.key!, ctx.request.body, {
    httpMetadata: { contentType: DOWNLOAD_CONTENT_TYPE },
    customMetadata: { sessionCode: session.code, sessionId: session.id },
  });
  return json({ ok: true });
}

/**
 * Marks the file downloadable. The stored object is measured here rather than
 * trusted from the client, since a presigned PUT bypasses the Worker entirely.
 */
async function completeUploadRoute(ctx: Ctx, code: string, itemId: string): Promise<Response> {
  const { session, role } = await requireAuth(ctx, code);
  const item = requirePendingItem(session, itemId);

  const object = await ctx.env.FILES.head(item.key!);
  if (!object) throw badRequest('Upload was not received. Please try again.');

  const declared = item.size ?? 0;
  const actual = object.size;
  const projected = session.bytesUsed - declared + actual;

  if (actual > ctx.config.maxFileBytes || projected > ctx.config.maxSessionBytes) {
    await ctx.env.FILES.delete(item.key!);
    session.bytesUsed -= declared;
    session.items = session.items.filter((i) => i.id !== item.id);
    touch(session, ctx.now);
    await saveSession(ctx.env, session, ctx.config, ctx.now);
    throw tooLarge('That upload exceeded the size limit and was discarded.');
  }

  session.bytesUsed = projected;
  item.size = actual;
  item.state = 'ready';
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
    'cache-control': 'no-store',
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

function stripKey(item: StoredItem) {
  const { key: _key, ...rest } = item;
  return rest;
}

function assertItemBudget(session: StoredSession, config: Config): void {
  if (session.items.length >= config.maxItems) {
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
