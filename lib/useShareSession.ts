'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionView } from '@/shared/types';
import { ApiError, api, uploadFile } from './api';

const STORAGE_KEY = 'mubifiles.session';
const POLL_INTERVAL_MS = 2000;
/** Progress speed is averaged over this window so the readout doesn't jitter. */
const SPEED_WINDOW_MS = 3000;

export interface Transfer {
  itemId: string;
  name: string;
  loaded: number;
  total: number;
  bytesPerSecond: number;
  secondsRemaining: number;
  error?: string;
}

interface Credentials {
  code: string;
  token: string;
}

function loadCredentials(): Credentials | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Credentials>;
    return parsed.code && parsed.token ? { code: parsed.code, token: parsed.token } : null;
  } catch {
    return null;
  }
}

function storeCredentials(credentials: Credentials | null): void {
  try {
    if (credentials) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private-mode browsers can refuse storage; the session still works in-tab.
  }
}

export interface ShareSession {
  ready: boolean;
  busy: boolean;
  session: SessionView | null;
  credentials: Credentials | null;
  transfers: Transfer[];
  error: string | null;
  clearError: () => void;
  create: (oneShot: boolean) => Promise<void>;
  join: (code: string) => Promise<void>;
  sendText: (text: string) => Promise<void>;
  sendFiles: (files: File[]) => Promise<void>;
  end: () => Promise<void>;
  leave: () => void;
  downloadUrl: (itemId: string) => string;
}

export function useShareSession(): ShareSession {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<SessionView | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Polling reads these without wanting to re-subscribe on every change.
  const credentialsRef = useRef<Credentials | null>(null);
  credentialsRef.current = credentials;

  const reset = useCallback(() => {
    storeCredentials(null);
    setCredentials(null);
    setSession(null);
    setTransfers([]);
  }, []);

  /** Restore a session across reloads so a refresh doesn't lose the pairing. */
  useEffect(() => {
    const saved = loadCredentials();
    if (!saved) {
      setReady(true);
      return;
    }
    setCredentials(saved);
    api
      .getSession(saved.code, saved.token)
      .then(setSession)
      .catch(() => reset())
      .finally(() => setReady(true));
  }, [reset]);

  /** Poll for the other device joining and for new items. */
  useEffect(() => {
    if (!credentials) return;
    let cancelled = false;
    let controller: AbortController | null = null;

    const poll = async () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      const current = credentialsRef.current;
      if (!current) return;

      controller?.abort();
      controller = new AbortController();
      try {
        const next = await api.getSession(current.code, current.token, controller.signal);
        if (!cancelled) setSession(next);
      } catch (err) {
        // A 404/401 means the session is gone for good; anything else is
        // transient (offline, aborted poll) and worth retrying silently.
        if (!cancelled && err instanceof ApiError && (err.status === 404 || err.status === 401)) {
          setError('This session has ended or expired.');
          reset();
        }
      }
    };

    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', poll);
    void poll();

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [credentials, reset]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }, []);

  const create = useCallback(
    (oneShot: boolean) =>
      run(async () => {
        const result = await api.createSession(oneShot);
        const next = { code: result.code, token: result.token };
        storeCredentials(next);
        setCredentials(next);
        setSession(result.session);
      }),
    [run],
  );

  const join = useCallback(
    (code: string) =>
      run(async () => {
        const result = await api.joinSession(code);
        const next = { code: result.code, token: result.token };
        storeCredentials(next);
        setCredentials(next);
        setSession(result.session);
      }),
    [run],
  );

  const sendText = useCallback(
    (text: string) =>
      run(async () => {
        const current = credentialsRef.current;
        if (!current) throw new Error('No active session.');
        setSession(await api.sendText(current.code, current.token, text));
      }),
    [run],
  );

  const sendFiles = useCallback(
    (files: File[]) =>
      run(async () => {
        const current = credentialsRef.current;
        if (!current) throw new Error('No active session.');

        // Sequential rather than parallel: one honest progress bar at a time,
        // and it keeps a phone's upstream from being split across transfers.
        for (const file of files) {
          const created = await api.createFileItem(current.code, current.token, file);
          const itemId = created.item.id;
          setSession(created.session);
          setTransfers((list) => [
            ...list,
            { itemId, name: file.name, loaded: 0, total: file.size, bytesPerSecond: 0, secondsRemaining: 0 },
          ]);

          const startedAt = performance.now();
          let windowStart = startedAt;
          let windowBytes = 0;
          let bytesPerSecond = 0;

          try {
            await uploadFile(created.upload, file, current.token, ({ loaded, total }) => {
              const elapsed = performance.now() - windowStart;
              windowBytes = loaded;
              if (elapsed >= SPEED_WINDOW_MS) {
                bytesPerSecond = (windowBytes / (performance.now() - startedAt)) * 1000;
                windowStart = performance.now();
              } else if (bytesPerSecond === 0) {
                bytesPerSecond = (loaded / Math.max(1, performance.now() - startedAt)) * 1000;
              }
              const remaining = bytesPerSecond > 0 ? (total - loaded) / bytesPerSecond : 0;
              setTransfers((list) =>
                list.map((t) =>
                  t.itemId === itemId ? { ...t, loaded, total, bytesPerSecond, secondsRemaining: remaining } : t,
                ),
              );
            });
            setSession(await api.completeUpload(current.code, current.token, itemId));
            setTransfers((list) => list.filter((t) => t.itemId !== itemId));
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Upload failed.';
            setTransfers((list) => list.map((t) => (t.itemId === itemId ? { ...t, error: message } : t)));
            throw err;
          }
        }
      }),
    [run],
  );

  const end = useCallback(
    () =>
      run(async () => {
        const current = credentialsRef.current;
        if (current) await api.endSession(current.code, current.token).catch(() => undefined);
        reset();
      }),
    [reset, run],
  );

  const leave = useCallback(() => {
    reset();
    setError(null);
  }, [reset]);

  const downloadUrl = useCallback(
    (itemId: string) => {
      const current = credentialsRef.current;
      return current ? api.downloadUrl(current.code, current.token, itemId) : '#';
    },
    [],
  );

  return {
    ready,
    busy,
    session,
    credentials,
    transfers,
    error,
    clearError: () => setError(null),
    create,
    join,
    sendText,
    sendFiles,
    end,
    leave,
    downloadUrl,
  };
}
