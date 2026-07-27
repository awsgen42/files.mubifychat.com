import type { Env } from './env';

/**
 * When the UI is hosted separately (e.g. on Vercel) the browser treats every
 * API call as cross-origin. Origins are allowlisted rather than mirrored back,
 * so a hostile page can't read a session it happens to know the code for.
 */
export function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function resolveOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null; // Same-origin fetches and plain navigations.
  return allowedOrigins(env).includes(origin) ? origin : null;
}

/**
 * Tokens travel in the Authorization header rather than cookies, so
 * Allow-Credentials stays off — there is no ambient authority to protect.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-expose-headers': 'content-disposition',
    'access-control-max-age': '86400',
  };
}

export function withCors(response: Response, origin: string | null): Response {
  const result = new Response(response.body, response);
  for (const [name, value] of Object.entries(corsHeaders(origin))) result.headers.set(name, value);
  // Responses differ by Origin, so caches must not share them across sites.
  result.headers.append('vary', 'Origin');
  return result;
}

export function preflight(request: Request, env: Env): Response | null {
  if (request.method.toUpperCase() !== 'OPTIONS') return null;
  const origin = resolveOrigin(request, env);
  return new Response(null, {
    status: origin ? 204 : 403,
    headers: { ...corsHeaders(origin), vary: 'Origin' },
  });
}
