'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionView } from '@/shared/types';
import type { UploadedPart } from '@/shared/types';
import { partCount, partRange } from '@/shared/upload';
import { ApiError, api, isRetryable, uploadFile, uploadPart } from './api';
import { PART_RETRIES, PART_RETRY_BASE_MS, POLL_ACTIVE_MS, POLL_IDLE_AFTER_MS, POLL_IDLE_MS, SPEED_WINDOW_MS } from './tuning';
import { beginUpload, findResumable, forgetSessionUploads, forgetUpload, recordPart } from './uploads';

const STORAGE_KEY = 'mubifiles.session';

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
  cancelUpload: (itemId: string) => Promise<void>;
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

  /**
   * When the session last changed. Drives the poll interval: a session that is
   * being used stays on the fast cadence, one sitting untouched backs off.
   * Local actions bump it too, so sending something resumes fast polling
   * immediately rather than waiting for the next slow tick.
   */
  const lastChangeRef = useRef<number>(Date.now());
  const markActive = useCallback(() => {
    lastChangeRef.current = Date.now();
  }, []);

  const reset = useCallback(() => {
    const current = credentialsRef.current;
    // The uploadIds these manifests pair with die with the session, so keeping
    // them would only leave junk in localStorage.
    if (current) forgetSessionUploads(current.code);
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

  /**
   * Poll for the other device joining and for new items.
   *
   * Uses a self-scheduling timeout rather than setInterval so the cadence can
   * vary: fast while something is happening, slower once the session has been
   * quiet, which is the common case of a code sitting on screen waiting to be
   * typed in elsewhere.
   */
  useEffect(() => {
    if (!credentials) return;
    let cancelled = false;
    let timer: number | undefined;
    let controller: AbortController | null = null;
    let lastVersion = -1;

    const schedule = () => {
      if (cancelled) return;
      const quietFor = Date.now() - lastChangeRef.current;
      timer = window.setTimeout(run, quietFor > POLL_IDLE_AFTER_MS ? POLL_IDLE_MS : POLL_ACTIVE_MS);
    };

    const run = async () => {
      if (cancelled) return;
      // Keep the timer alive while backgrounded but skip the request; the
      // visibility handler fires an immediate poll on return.
      if (document.visibilityState === 'hidden') return schedule();

      const current = credentialsRef.current;
      if (!current) return;

      controller?.abort();
      controller = new AbortController();
      try {
        const next = await api.getSession(current.code, current.token, controller.signal);
        if (cancelled) return;
        if (next.version !== lastVersion) {
          lastVersion = next.version;
          lastChangeRef.current = Date.now();
        }
        setSession(next);
      } catch (err) {
        // A 404/401 means the session is gone for good. Everything else —
        // offline, an aborted poll, a 429 from the poll limiter — is transient
        // and simply retried on the next tick.
        if (!cancelled && err instanceof ApiError && (err.status === 404 || err.status === 401)) {
          setError('This session has ended or expired.');
          reset();
          return;
        }
      }
      schedule();
    };

    const onVisibility = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      lastChangeRef.current = Date.now();
      window.clearTimeout(timer);
      void run();
    };

    document.addEventListener('visibilitychange', onVisibility);
    void run();

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
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
        markActive();
        const next = { code: result.code, token: result.token };
        storeCredentials(next);
        setCredentials(next);
        setSession(result.session);
      }),
    [markActive, run],
  );

  const join = useCallback(
    (code: string) =>
      run(async () => {
        const result = await api.joinSession(code);
        markActive();
        const next = { code: result.code, token: result.token };
        storeCredentials(next);
        setCredentials(next);
        setSession(result.session);
      }),
    [markActive, run],
  );

  const sendText = useCallback(
    (text: string) =>
      run(async () => {
        const current = credentialsRef.current;
        if (!current) throw new Error('No active session.');
        markActive();
        setSession(await api.sendText(current.code, current.token, text));
      }),
    [markActive, run],
  );

  const sendFiles = useCallback(
    (files: File[]) =>
      run(async () => {
        const current = credentialsRef.current;
        if (!current) throw new Error('No active session.');
        markActive();

        // Sequential rather than parallel: one honest progress bar at a time,
        // and it keeps a phone's upstream from being split across transfers.
        for (const file of files) {
          const resumable = findResumable(current.code, file);
          const created = resumable
            ? null
            : await api.createFileItem(current.code, current.token, file);
          if (created) setSession(created.session);

          const itemId = resumable ? resumable.itemId : created!.item.id;
          const target = created?.upload;

          setTransfers((list) => [
            ...list.filter((t) => t.itemId !== itemId),
            {
              itemId,
              name: file.name,
              loaded: resumable ? resumable.parts.length * resumable.partSize : 0,
              total: file.size,
              bytesPerSecond: 0,
              secondsRemaining: 0,
            },
          ]);

          const speed = createSpeedometer();
          const report = (loaded: number) => {
            const { bytesPerSecond, secondsRemaining } = speed(loaded, file.size);
            setTransfers((list) =>
              list.map((t) =>
                t.itemId === itemId
                  ? { ...t, loaded, total: file.size, bytesPerSecond, secondsRemaining }
                  : t,
              ),
            );
          };

          try {
            if (resumable || target?.mode === 'multipart') {
              const partSize = resumable ? resumable.partSize : target!.partSize!;
              // A resumed upload no longer has the create response that carried
              // the URL, so it is rebuilt from the fixed API shape.
              const partsUrl = resumable ? api.partsUrl(current.code, itemId) : target!.partsUrl!;
              if (!resumable) {
                beginUpload({
                  code: current.code,
                  itemId,
                  name: file.name,
                  size: file.size,
                  lastModified: file.lastModified,
                  partSize,
                });
              }

              const done = new Map<number, UploadedPart>(
                (resumable?.parts ?? []).map((p) => [p.partNumber, p]),
              );
              const total = partCount(file.size, partSize);

              for (let n = 1; n <= total; n++) {
                if (done.has(n)) continue;
                const { start, end } = partRange(n, file.size, partSize);
                // Progress is anchored to completed parts, so a retried part
                // rewinds only its own slice rather than the whole bar.
                const base = done.size * partSize;
                const part = await withRetries(() =>
                  uploadPart(partsUrl, n, file.slice(start, end), current.token, ({ loaded }) =>
                    report(base + loaded),
                  ),
                );
                done.set(n, part);
                recordPart(itemId, part);
                report(done.size * partSize);
              }

              const manifest = [...done.values()].sort((a, b) => a.partNumber - b.partNumber);
              setSession(await api.completeUpload(current.code, current.token, itemId, manifest));
              forgetUpload(itemId);
            } else {
              await uploadFile(target!, file, current.token, ({ loaded }) => report(loaded));
              setSession(await api.completeUpload(current.code, current.token, itemId));
            }
            setTransfers((list) => list.filter((t) => t.itemId !== itemId));
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Upload failed.';
            setTransfers((list) => list.map((t) => (t.itemId === itemId ? { ...t, error: message } : t)));
            throw err;
          }
        }
      }),
    [markActive, run],
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

  /** Drops a stuck or unwanted upload, releasing its parts and its quota. */
  const cancelUpload = useCallback(
    (itemId: string) =>
      run(async () => {
        const current = credentialsRef.current;
        if (!current) return;
        forgetUpload(itemId);
        setTransfers((list) => list.filter((t) => t.itemId !== itemId));
        setSession(await api.cancelItem(current.code, current.token, itemId));
      }),
    [run],
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
    cancelUpload,
    leave,
    downloadUrl,
  };
}

/**
 * Smooths the speed readout over a window so the number does not jitter with
 * every progress event, and derives the ETA from it.
 */
function createSpeedometer() {
  const startedAt = performance.now();
  let windowStart = startedAt;
  let bytesPerSecond = 0;

  return (loaded: number, total: number) => {
    const now = performance.now();
    if (now - windowStart >= SPEED_WINDOW_MS || bytesPerSecond === 0) {
      bytesPerSecond = (loaded / Math.max(1, now - startedAt)) * 1000;
      windowStart = now;
    }
    const secondsRemaining = bytesPerSecond > 0 ? (total - loaded) / bytesPerSecond : 0;
    return { bytesPerSecond, secondsRemaining };
  };
}

/**
 * Retries one part in isolation. This is the whole point of multipart here: a
 * dropped connection costs the part in flight, not the file.
 */
async function withRetries<T>(attempt: () => Promise<T>): Promise<T> {
  for (let tries = 0; ; tries++) {
    try {
      return await attempt();
    } catch (err) {
      if (tries >= PART_RETRIES || !isRetryable(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, PART_RETRY_BASE_MS * 2 ** tries));
    }
  }
}
