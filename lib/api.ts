import type {
  ApiErrorBody,
  CreateFileItemResponse,
  CreateSessionResponse,
  JoinSessionResponse,
  SessionView,
  UploadedPart,
} from '@/shared/types';

/**
 * Empty when the Worker serves the UI too (single origin). Set to the Worker's
 * URL when the frontend is hosted elsewhere, e.g. on Vercel. Inlined at build
 * time, so each deployment target needs its own build.
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
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

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body) headers.set('content-type', 'application/json');

  const response = await fetch(apiUrl(path), { ...init, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, body?.error ?? 'error', body?.message ?? 'Request failed.');
  }
  return (await response.json()) as T;
}

export const api = {
  createSession: (oneShot: boolean) =>
    request<CreateSessionResponse>('/api/sessions', { method: 'POST', body: JSON.stringify({ oneShot }) }),

  joinSession: (code: string) =>
    request<JoinSessionResponse>(`/api/sessions/${code}/join`, { method: 'POST' }),

  getSession: (code: string, token: string, signal?: AbortSignal) =>
    request<SessionView>(`/api/sessions/${code}`, { signal }, token),

  sendText: (code: string, token: string, text: string) =>
    request<SessionView>(`/api/sessions/${code}/items/text`, { method: 'POST', body: JSON.stringify({ text }) }, token),

  createFileItem: (code: string, token: string, file: File) =>
    request<CreateFileItemResponse>(
      `/api/sessions/${code}/items/file`,
      { method: 'POST', body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) },
      token,
    ),

  completeUpload: (code: string, token: string, itemId: string, parts?: UploadedPart[]) =>
    request<SessionView>(
      `/api/sessions/${code}/items/${itemId}/complete`,
      { method: 'POST', ...(parts ? { body: JSON.stringify({ parts }) } : {}) },
      token,
    ),

  // Rebuilt rather than remembered: a resumed upload no longer has the create
  // response that carried it, and this shape is fixed by the API.
  partsUrl: (code: string, itemId: string) => apiUrl(`/api/sessions/${code}/items/${itemId}/parts`),

  cancelItem: (code: string, token: string, itemId: string) =>
    request<SessionView>(`/api/sessions/${code}/items/${itemId}`, { method: 'DELETE' }, token),

  endSession: (code: string, token: string) =>
    request<{ ok: true }>(`/api/sessions/${code}/end`, { method: 'POST' }, token),

  // A plain browser navigation, so the token rides in the query string rather
  // than a header — which also means no CORS preflight on downloads.
  downloadUrl: (code: string, token: string, itemId: string) =>
    apiUrl(`/api/sessions/${code}/items/${itemId}/download?t=${encodeURIComponent(token)}`),
};

export interface UploadProgress {
  loaded: number;
  total: number;
}

/**
 * `fetch` gives no upload progress, so uploads go through XHR. One PUT of a
 * body, used for whole files on the single-request path and for individual
 * parts on the multipart one.
 *
 * `authorize` is false for a presigned URL: it signs only the host, so any
 * extra header invalidates the signature.
 */
function putWithProgress(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  authorize: string | null,
  onProgress: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);

    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    if (authorize) xhr.setRequestHeader('authorization', `Bearer ${authorize}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress({ loaded: event.loaded, total: event.total });
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr)
        : reject(new ApiError(xhr.status, 'upload_failed', 'Upload failed. Please try again.'));
    xhr.onerror = () => reject(new ApiError(0, 'network', 'Network error during upload.'));
    xhr.onabort = () => reject(new ApiError(0, 'aborted', 'Upload cancelled.'));

    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

/** Single-request upload: the whole file in one PUT. */
export function uploadFile(
  target: { mode: 'presign' | 'proxy' | 'multipart'; url: string; headers: Record<string, string> },
  file: File,
  token: string,
  onProgress: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  return putWithProgress(
    target.url,
    file,
    target.headers,
    target.mode === 'presign' ? null : token,
    onProgress,
    signal,
  ).then(() => undefined);
}

/**
 * Uploads one part and returns what R2 recorded for it.
 *
 * The etag is passed through untouched. R2 compares it exactly at completion,
 * so normalising it here — stripping quotes, changing case — would break the
 * upload at the last step with an error that blames the wrong thing.
 */
export async function uploadPart(
  partsUrl: string,
  partNumber: number,
  body: Blob,
  token: string,
  onProgress: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<UploadedPart> {
  const xhr = await putWithProgress(`${partsUrl}/${partNumber}`, body, {}, token, onProgress, signal);
  const parsed = JSON.parse(xhr.responseText) as Partial<UploadedPart>;
  if (typeof parsed.etag !== 'string' || !parsed.etag) {
    throw new ApiError(0, 'upload_failed', 'The server did not confirm that part.');
  }
  return { partNumber, etag: parsed.etag };
}

/** Aborts are the user's decision and 4xx will not fix itself; the rest might. */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code === 'aborted') return false;
  return error.status === 0 || error.status === 429 || error.status >= 500;
}
