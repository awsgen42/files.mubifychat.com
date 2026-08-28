import { handleApi } from './api';
import { preflight, resolveOrigin, withCors } from './cors';
import type { Env } from './env';
import { ApiError, apiError } from './http';
import { CANONICAL_REDIRECT_STATUS, canonicalRedirect } from '../shared/trailing-slash';
import { sessionIdFromObjectKey, sessionIdKey } from './session';

/** Objects younger than this are never collected, to allow for KV read latency. */
const GC_GRACE_MS = 10 * 60 * 1000;

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // One URL per page, before anything else can answer.
    //
    // The asset server already redirects a bare path to the slashed one, but
    // with a 307 — measured against `wrangler dev`, under both
    // "auto-trailing-slash" and "force-trailing-slash". A temporary redirect
    // leaves the bare URL as a candidate, and two URLs for one page split its
    // ranking signal. Issuing the 308 here means the assets binding never sees
    // the bare form.
    const canonical = canonicalRedirect(url);
    if (canonical) {
      return withSecurityHeaders(
        new Response(null, {
          status: CANONICAL_REDIRECT_STATUS,
          headers: { location: canonical },
        }),
      );
    }

    // The Worker keeps serving the bundled UI, so Cloudflare remains a
    // complete deployment even when a separate frontend host is in play.
    if (!url.pathname.startsWith('/api/')) {
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    const early = preflight(request, env);
    if (early) return early;

    const origin = resolveOrigin(request, env);
    try {
      return withCors(withSecurityHeaders(await handleApi(request, env, url)), origin);
    } catch (err) {
      if (err instanceof ApiError) return withCors(withSecurityHeaders(apiError(err)), origin);
      console.error('Unhandled API error', err);
      return withCors(
        withSecurityHeaders(
          apiError(new ApiError(500, 'internal_error', 'Something went wrong. Please try again.')),
        ),
        origin,
      );
    }
  },

  /**
   * Session metadata expires out of KV on its own, which would otherwise leave
   * the file bodies behind in R2. This sweeps for objects whose session is
   * gone. The R2 lifecycle rule in the README is the backstop if this job ever
   * stops running.
   */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(collectGarbage(env));
  },
} satisfies ExportedHandler<Env>;

function withSecurityHeaders(response: Response): Response {
  const result = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) result.headers.set(name, value);
  return result;
}

async function collectGarbage(env: Env): Promise<void> {
  const now = Date.now();
  const liveSessionIds = new Map<string, boolean>();
  let cursor: string | undefined;
  let deleted = 0;

  do {
    const listing = await env.FILES.list({ prefix: 'sessions/', cursor, limit: 500 });
    cursor = listing.truncated ? listing.cursor : undefined;

    const orphans: string[] = [];
    for (const object of listing.objects) {
      // Skip anything recent so an in-flight upload is never pulled out from
      // under the client.
      if (now - object.uploaded.getTime() < GC_GRACE_MS) continue;

      const sessionId = sessionIdFromObjectKey(object.key);
      if (!sessionId) continue;

      if (!liveSessionIds.has(sessionId)) {
        liveSessionIds.set(sessionId, Boolean(await env.SESSIONS.get(sessionIdKey(sessionId), 'text')));
      }
      if (!liveSessionIds.get(sessionId)) orphans.push(object.key);
    }

    if (orphans.length > 0) {
      await env.FILES.delete(orphans);
      deleted += orphans.length;
    }
  } while (cursor);

  if (deleted > 0) console.log(`mubifiles gc: deleted ${deleted} expired object(s)`);
}
