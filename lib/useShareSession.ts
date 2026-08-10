'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionView } from '@/shared/types';
import type { UploadedPart } from '@/shared/types';
import { partCount, partRange } from '@/shared/upload';
import { ApiError, api, isRetryable, uploadFile, uploadPart } from './api';
import {
  LanUnavailableError,
  answerOffer,
  chunkSizeFor,
  createOffer,
  isLanSupported,
  receiveFiles,
  sendFile,
  whenOpen,
} from './lan';
import { ensureReachable, reportReachable, setPollDriven } from './reachability';
import {
  LAN_ANSWER_TIMEOUT_MS,
  LAN_SIGNAL_MAX_AGE_MS,
  PART_RETRIES,
  PART_RETRY_BASE_MS,
  POLL_ACTIVE_MS,
  POLL_IDLE_AFTER_MS,
  POLL_IDLE_MS,
  SPEED_WINDOW_MS,
} from './tuning';
import { beginUpload, findResumable, forgetSessionUploads, forgetUpload, markPaused, recordPart } from './uploads';

const STORAGE_KEY = 'mubifiles.session';

/** A request we cancelled ourselves says nothing about the network. */
function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export interface Transfer {
  itemId: string;
  name: string;
  loaded: number;
  total: number;
  bytesPerSecond: number;
  secondsRemaining: number;
  error?: string;
  /**
   * 'pausing' means the part in flight is being allowed to finish. Aborting it
   * would discard up to a part's worth of bytes the sender has already paid
   * for on a metered connection — the opposite of what pause is for — and the
   * part boundary is the only point at which progress becomes durable, since
   * the etag does not exist until the part completes.
   */
  status?: 'pausing' | 'paused';
  /**
   * Which way the bytes are moving. Cloud uploads are always outbound; a
   * direct transfer is the only thing that can be inbound, because on the
   * cloud path an arriving file is a download the user starts by hand.
   */
  direction: 'send' | 'receive';
  /** 'lan' bytes go device to device and never touch R2. */
  via: 'r2' | 'lan';
  /**
   * A finished direct receive. There is no server item behind it — the file
   * only ever existed on these two devices — so the blob is held here until
   * the user saves it.
   */
  received?: { blob: Blob; name: string };
}

/** Where a direct transfer has got to, for the UI to explain itself. */
export type LanState = 'idle' | 'connecting' | 'transferring' | 'unavailable';

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
  /** Device to device over the local network; the file never reaches R2. */
  sendFilesDirect: (files: File[]) => Promise<void>;
  lanState: LanState;
  /** Whether a direct transfer is worth offering: a peer has to be here. */
  canSendDirect: boolean;
  end: () => Promise<void>;
  /** Sends a failed direct attempt through R2 instead, without re-picking. */
  retryViaCloud: () => Promise<void>;
  /** Drops a finished direct receive once it has been saved. */
  dismissTransfer: (itemId: string) => void;
  cancelUpload: (itemId: string) => Promise<void>;
  pauseUpload: (itemId: string) => void;
  /** Abandons the part in flight rather than waiting for it to finish. */
  stopNow: (itemId: string) => void;
  resumeUpload: (itemId: string) => Promise<void>;
  canResume: (itemId: string) => boolean;
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
  const [lanState, setLanState] = useState<LanState>('idle');

  // Polling reads these without wanting to re-subscribe on every change.
  const credentialsRef = useRef<Credentials | null>(null);
  credentialsRef.current = credentials;

  /**
   * When the session last changed. Drives the poll interval: a session that is
   * being used stays on the fast cadence, one sitting untouched backs off.
   * Local actions bump it too, so sending something resumes fast polling
   * immediately rather than waiting for the next slow tick.
   */
  /** itemIds the user has asked to stop. Read by the upload loop between parts. */
  const pauseRequests = useRef(new Set<string>());
  /** AbortControllers for the part currently in flight, keyed by item. */
  const partAborts = useRef(new Map<string, AbortController>());
  /**
   * The File behind a paused upload, so resuming needs no second trip through
   * the file picker. It only survives while the tab does — a File is a handle
   * into the local machine, not data we can persist — which is why closing the
   * tab means choosing the file again.
   */
  const pausedFiles = useRef(new Map<string, File>());

  /* --- Direct (LAN) transfer ------------------------------------- */

  /** The live peer connection, if a direct transfer is up. */
  const lanPeer = useRef<RTCPeerConnection | null>(null);
  /** Removes the receive listener when the connection goes away. */
  const lanTeardown = useRef<(() => void) | null>(null);
  /** Signal item ids already acted on, so a poll cannot replay a handshake. */
  const handledSignals = useRef(new Set<string>());
  /** Set while the sender is waiting for the peer's answer to arrive by poll. */
  const answerWaiter = useRef<((sdp: string) => void) | null>(null);
  const lanAborts = useRef(new Map<string, AbortController>());
  /** Transfers have no server item on this path, so ids are minted locally. */
  const lanCounter = useRef(0);
  /**
   * The files of the last direct attempt, kept so a failed one can be sent by
   * the cloud path without a second trip through the file picker.
   */
  const lastDirectFiles = useRef<File[]>([]);

  const closeLan = useCallback(() => {
    lanTeardown.current?.();
    lanTeardown.current = null;
    lanPeer.current?.close();
    lanPeer.current = null;
    answerWaiter.current = null;
  }, []);

  // A direct connection is tied to the tab, not the session: it cannot outlive
  // the page, and leaving it open would hold the peer's channel too.
  useEffect(() => closeLan, [closeLan]);

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

    // While this loop runs it hits the API every few seconds, so its outcome
    // is a better reachability reading than a probe and costs nothing extra.
    setPollDriven(true);

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
        reportReachable(true);
        if (cancelled) return;
        if (next.version !== lastVersion) {
          lastVersion = next.version;
          lastChangeRef.current = Date.now();
        }
        setSession(next);
      } catch (err) {
        // An ApiError means the server answered, so it is reachable whatever
        // the status said. A poll we aborted ourselves says nothing. Anything
        // else is the request never landing.
        if (err instanceof ApiError) reportReachable(true);
        else if (!isAbort(err)) reportReachable(false);

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
      setPollDriven(false);
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

  /**
   * Checked immediately before the request rather than relied on from render
   * state, which may be seconds stale. Usually free: the reading is cached, so
   * a user who has just focused the tab pays nothing for this.
   */
  const requireReachable = useCallback(async () => {
    if (await ensureReachable()) return;
    throw new Error('Cannot reach Mubifiles right now. Check your connection and try again.');
  }, []);

  const create = useCallback(
    (oneShot: boolean) =>
      run(async () => {
        await requireReachable();
        const result = await api.createSession(oneShot);
        markActive();
        const next = { code: result.code, token: result.token };
        storeCredentials(next);
        setCredentials(next);
        setSession(result.session);
      }),
    [markActive, requireReachable, run],
  );

  const join = useCallback(
    (code: string) =>
      run(async () => {
        await requireReachable();
        const result = await api.joinSession(code);
        markActive();
        const next = { code: result.code, token: result.token };
        storeCredentials(next);
        setCredentials(next);
        setSession(result.session);
      }),
    [markActive, requireReachable, run],
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
              direction: 'send',
              via: 'r2',
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

              // Starting or resuming clears any earlier pause, now that the
              // itemId the pause was recorded against is resolved.
              pauseRequests.current.delete(itemId);
              pausedFiles.current.delete(itemId);
              markPaused(itemId, false);

              const done = new Map<number, UploadedPart>(
                (resumable?.parts ?? []).map((p) => [p.partNumber, p]),
              );
              const total = partCount(file.size, partSize);

              let stopped = false;
              for (let n = 1; n <= total; n++) {
                if (done.has(n)) continue;
                // The pause takes effect here, between parts, so nothing that
                // has already been sent is thrown away.
                if (pauseRequests.current.has(itemId)) {
                  stopped = true;
                  break;
                }
                const { start, end } = partRange(n, file.size, partSize);
                // Progress is anchored to completed parts, so a retried part
                // rewinds only its own slice rather than the whole bar.
                const base = done.size * partSize;
                const controller = new AbortController();
                partAborts.current.set(itemId, controller);
                try {
                  const part = await withRetries(() =>
                    uploadPart(
                      partsUrl,
                      n,
                      file.slice(start, end),
                      current.token,
                      ({ loaded }) => report(base + loaded),
                      controller.signal,
                    ),
                  );
                  done.set(n, part);
                  recordPart(itemId, part);
                  report(done.size * partSize);
                } catch (err) {
                  // A part abandoned by "Stop now" is a pause, not a failure.
                  if (pauseRequests.current.has(itemId) && err instanceof ApiError && err.code === 'aborted') {
                    stopped = true;
                    report(done.size * partSize);
                    break;
                  }
                  throw err;
                } finally {
                  partAborts.current.delete(itemId);
                }
              }

              if (stopped) {
                pauseRequests.current.delete(itemId);
                pausedFiles.current.set(itemId, file);
                markPaused(itemId, true);
                setTransfers((list) =>
                  list.map((t) =>
                    t.itemId === itemId
                      ? { ...t, status: 'paused', bytesPerSecond: 0, secondsRemaining: 0 }
                      : t,
                  ),
                );
                return;
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

  /**
   * Progress reporting for one transfer, whichever path is moving the bytes.
   * Both the cloud and direct paths render from the same array, so the speed
   * and ETA in the UI are computed one way for both.
   */
  const progressReporter = useCallback((itemId: string, total: number) => {
    const speed = createSpeedometer();
    return (loaded: number) => {
      const { bytesPerSecond, secondsRemaining } = speed(loaded, total);
      setTransfers((list) =>
        list.map((t) => (t.itemId === itemId ? { ...t, loaded, total, bytesPerSecond, secondsRemaining } : t)),
      );
    };
  }, []);

  const failTransfers = useCallback((ids: string[], message: string) => {
    setTransfers((list) => list.map((t) => (ids.includes(t.itemId) ? { ...t, error: message, bytesPerSecond: 0 } : t)));
  }, []);

  /**
   * Sends over the local network instead of through R2.
   *
   * The two devices exchange one SDP each through the session document, then
   * talk directly. Nothing is uploaded, so there is no item to create, no
   * quota to reserve and nothing to clean up afterwards — which is also why a
   * direct transfer leaves no trace in the shared list: the file only ever
   * existed on these two devices.
   */
  const sendFilesDirect = useCallback(
    (files: File[]) =>
      run(async () => {
        const current = credentialsRef.current;
        if (!current) throw new Error('No active session.');
        if (!isLanSupported()) throw new Error('This browser cannot make a direct connection.');

        markActive();
        closeLan();
        lastDirectFiles.current = files;
        setLanState('connecting');

        const ids = files.map(() => `lan:${++lanCounter.current}`);
        setTransfers((list) => [
          ...list,
          ...files.map((file, index) => ({
            itemId: ids[index],
            name: file.name,
            loaded: 0,
            total: file.size,
            bytesPerSecond: 0,
            secondsRemaining: 0,
            direction: 'send' as const,
            via: 'lan' as const,
          })),
        ]);

        try {
          const { pc, channel, sdp } = await createOffer();
          lanPeer.current = pc;

          // Resolved by the poll effect below when the peer's answer lands.
          const answered = new Promise<string>((resolve, reject) => {
            answerWaiter.current = resolve;
            setTimeout(
              () => reject(new LanUnavailableError('The other device did not answer.')),
              LAN_ANSWER_TIMEOUT_MS,
            );
          });

          await api.sendSignal(current.code, current.token, 'offer', sdp);
          await pc.setRemoteDescription({ type: 'answer', sdp: await answered });
          await whenOpen(channel);
          setLanState('transferring');

          const chunkSize = chunkSizeFor(pc);
          for (const [index, file] of files.entries()) {
            const controller = new AbortController();
            lanAborts.current.set(ids[index], controller);
            try {
              await sendFile(channel, file, {
                chunkSize,
                signal: controller.signal,
                onProgress: progressReporter(ids[index], file.size),
              });
              setTransfers((list) => list.filter((t) => t.itemId !== ids[index]));
            } finally {
              lanAborts.current.delete(ids[index]);
            }
          }

          lastDirectFiles.current = [];
          setLanState('idle');
        } catch (err) {
          setLanState('unavailable');
          const message =
            err instanceof LanUnavailableError
              ? 'No direct connection — the devices may be on different networks.'
              : err instanceof Error
                ? err.message
                : 'The direct transfer failed.';
          failTransfers(ids, message);
          throw new Error(message);
        } finally {
          answerWaiter.current = null;
          closeLan();
        }
      }),
    [closeLan, failTransfers, markActive, progressReporter, run],
  );

  /**
   * Answers a handshake the peer posted, and receives whatever it sends.
   *
   * Nothing is accepted implicitly beyond the connection itself: the peer is
   * already an authenticated participant in this session, so it could equally
   * have sent the same file through R2.
   */
  const acceptDirect = useCallback(
    async (offerSdp: string) => {
      const current = credentialsRef.current;
      if (!current) return;

      closeLan();
      setLanState('connecting');
      try {
        const { pc, channel, sdp } = await answerOffer(offerSdp);
        lanPeer.current = pc;
        await api.sendSignal(current.code, current.token, 'answer', sdp);
        markActive();

        const dc = await channel;
        await whenOpen(dc);
        setLanState('transferring');

        let id = '';
        let report: (loaded: number) => void = () => {};

        lanTeardown.current = receiveFiles(dc, {
          onBegin: (info) => {
            id = `lan:${++lanCounter.current}`;
            report = progressReporter(id, info.size);
            setTransfers((list) => [
              ...list,
              {
                itemId: id,
                name: info.name,
                loaded: 0,
                total: info.size,
                bytesPerSecond: 0,
                secondsRemaining: 0,
                direction: 'receive',
                via: 'lan',
              },
            ]);
          },
          onProgress: (loaded) => report(loaded),
          onFile: (file) => {
            // Kept in the transfer rather than pushed into the item list: it
            // has no server item, and inventing one would claim the file is
            // in the session when it never left this device.
            setTransfers((list) =>
              list.map((t) =>
                t.itemId === id
                  ? {
                      ...t,
                      loaded: file.size,
                      bytesPerSecond: 0,
                      secondsRemaining: 0,
                      received: { blob: file.blob, name: file.name },
                    }
                  : t,
              ),
            );
          },
          onError: (err) => failTransfers([id], err.message),
        });

        // The sender closes the connection when its batch is done.
        dc.addEventListener('close', () => setLanState('idle'), { once: true });
      } catch {
        setLanState('unavailable');
        closeLan();
      }
    },
    [closeLan, failTransfers, markActive, progressReporter],
  );

  /**
   * Picks handshakes out of the polled session.
   *
   * Only the peer's signals matter — our own offer comes back on every poll —
   * and each is acted on once. A stale one is left alone: answering an offer
   * from an attempt that has already been abandoned would post an answer
   * nobody is waiting for.
   */
  useEffect(() => {
    if (!session) return;
    for (const item of session.items) {
      if (item.kind !== 'signal' || !item.sdp || item.from === session.you) continue;
      if (handledSignals.current.has(item.id)) continue;
      if (Date.now() - item.createdAt > LAN_SIGNAL_MAX_AGE_MS) continue;
      handledSignals.current.add(item.id);

      if (item.role === 'answer') answerWaiter.current?.(item.sdp);
      else if (item.role === 'offer') void acceptDirect(item.sdp);
    }
  }, [session, acceptDirect]);

  /**
   * Sends the files of a failed direct attempt through R2 instead. The point
   * is that "different networks" costs one click rather than a second trip
   * through the file picker.
   */
  const retryViaCloud = useCallback(() => {
    const files = lastDirectFiles.current;
    lastDirectFiles.current = [];
    setLanState('idle');
    setTransfers((list) => list.filter((t) => !(t.via === 'lan' && t.error)));
    return files.length > 0 ? sendFiles(files) : Promise.resolve();
  }, [sendFiles]);

  /** Drops a finished direct receive once the user has saved it. */
  const dismissTransfer = useCallback((itemId: string) => {
    setTransfers((list) => list.filter((t) => t.itemId !== itemId));
  }, []);

  /**
   * Resume is the same path as a fresh send: sendFiles finds the stored
   * manifest by file identity and skips the parts already in R2. The File
   * comes from the paused-upload map when this tab is the one that paused it;
   * a tab that has since reloaded has to be handed the file again.
   */
  const resumeUpload = useCallback(
    (itemId: string) => {
      const file = pausedFiles.current.get(itemId);
      if (!file) return Promise.resolve();
      return sendFiles([file]);
    },
    [sendFiles],
  );

  /** Whether resuming is a button or a trip through the file picker. */
  const canResume = useCallback((itemId: string) => pausedFiles.current.has(itemId), []);

  const end = useCallback(
    () =>
      run(async () => {
        const current = credentialsRef.current;
        if (current) await api.endSession(current.code, current.token).catch(() => undefined);
        reset();
      }),
    [reset, run],
  );

  /**
   * Drops a stuck or unwanted transfer.
   *
   * A direct one is purely local — there is no item, no parts and no quota to
   * release, so cancelling it is aborting the send loop and closing the
   * connection. A cloud upload has all three, and the server has to be told.
   */
  const cancelUpload = useCallback(
    (itemId: string) =>
      run(async () => {
        const current = credentialsRef.current;
        if (!current) return;

        if (itemId.startsWith('lan:')) {
          lanAborts.current.get(itemId)?.abort();
          lanAborts.current.delete(itemId);
          setTransfers((list) => list.filter((t) => t.itemId !== itemId));
          closeLan();
          setLanState('idle');
          return;
        }

        forgetUpload(itemId);
        pausedFiles.current.delete(itemId);
        pauseRequests.current.delete(itemId);
        setTransfers((list) => list.filter((t) => t.itemId !== itemId));
        setSession(await api.cancelItem(current.code, current.token, itemId));
      }),
    [closeLan, run],
  );

  /**
   * Asks the loop to stop at the next part boundary. Not immediate on purpose:
   * see Transfer.status. The upload itself is untouched server-side — its
   * parts stay, and only cancel aborts them.
   */
  const pauseUpload = useCallback((itemId: string) => {
    pauseRequests.current.add(itemId);
    setTransfers((list) => list.map((t) => (t.itemId === itemId ? { ...t, status: 'pausing' } : t)));
  }, []);

  /** For when finishing the current part would take longer than waiting is worth. */
  const stopNow = useCallback((itemId: string) => {
    pauseRequests.current.add(itemId);
    partAborts.current.get(itemId)?.abort();
  }, []);

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
    sendFilesDirect,
    lanState,
    // Both devices have to be present for a direct transfer, so it is only
    // offered once someone has actually joined.
    canSendDirect: isLanSupported() && (session?.participants.length ?? 0) > 1,
    retryViaCloud,
    dismissTransfer,
    end,
    cancelUpload,
    pauseUpload,
    stopNow,
    resumeUpload,
    canResume,
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
