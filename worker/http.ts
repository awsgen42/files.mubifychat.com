import type { ApiErrorBody } from '../shared/types';

const NO_STORE = 'no-store';

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': NO_STORE, ...headers },
  });
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function apiError(error: ApiError): Response {
  const body: ApiErrorBody = { error: error.code, message: error.message };
  return json(body, error.status);
}

export const badRequest = (message: string) => new ApiError(400, 'bad_request', message);
export const unauthorized = (message = 'Invalid or expired session token.') =>
  new ApiError(401, 'unauthorized', message);
export const notFound = (message = 'That code is not valid, or the session has expired.') =>
  new ApiError(404, 'not_found', message);
export const tooLarge = (message: string) => new ApiError(413, 'too_large', message);
export const rateLimited = (message = 'Too many requests. Please slow down.') =>
  new ApiError(429, 'rate_limited', message);

export async function readJson<T>(request: Request): Promise<T> {
  try {
    const value = await request.json();
    if (typeof value !== 'object' || value === null) throw badRequest('Expected a JSON object body.');
    return value as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw badRequest('Request body must be valid JSON.');
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

export function bearerToken(request: Request, url: URL): string | null {
  const header = request.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  // Downloads are plain browser navigations, so they carry the token in the URL.
  return url.searchParams.get('t');
}
