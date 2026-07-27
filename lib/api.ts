import type {
  ApiErrorBody,
  CreateFileItemResponse,
  CreateSessionResponse,
  JoinSessionResponse,
  SessionView,
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

  completeUpload: (code: string, token: string, itemId: string) =>
    request<SessionView>(`/api/sessions/${code}/items/${itemId}/complete`, { method: 'POST' }, token),

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
 * `fetch` gives no upload progress, so uploads go through XHR. The same call
 * covers both a presigned R2 URL and the Worker proxy fallback.
 */
export function uploadFile(
  target: { mode: 'presign' | 'proxy'; url: string; headers: Record<string, string> },
  file: File,
  token: string,
  onProgress: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', target.url, true);

    for (const [name, value] of Object.entries(target.headers)) xhr.setRequestHeader(name, value);
    // A presigned URL signs only the host, so adding headers would break the
    // signature; the proxy path needs our own session token instead.
    if (target.mode === 'proxy') xhr.setRequestHeader('authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress({ loaded: event.loaded, total: event.total });
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, 'upload_failed', 'Upload failed. Please try again.'));
    xhr.onerror = () => reject(new ApiError(0, 'network', 'Network error during upload.'));
    xhr.onabort = () => reject(new ApiError(0, 'aborted', 'Upload cancelled.'));

    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}
