'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { api } from './api';

/**
 * Whether the API can actually be reached, which is not the same question as
 * whether a network interface is up.
 *
 * `navigator.onLine` answers the second and is treated here as a negative
 * signal only: false means definitely offline, true means nothing at all. On a
 * phone hotspot with no upstream, or on guest Wi-Fi before the captive portal
 * is signed into, it reports true while every request hangs — and that is the
 * exact situation this app is for, two devices on one hotspot.
 *
 * So reachability is measured rather than assumed, by asking the API whether
 * it is there.
 */

/** Long enough for a slow mobile round trip, short enough not to be a wait. */
export const PROBE_TIMEOUT_MS = 2500;

/**
 * How long a reading stays good for. Long enough that one user action cannot
 * fire several probes, short enough that a stale "reachable" is not acted on.
 */
export const REACHABILITY_TTL_MS = 5000;

/**
 * The probe itself, kept free of React and of module state so it can be
 * tested directly.
 *
 * Any response at all means reachable — a 404 is a perfectly good answer to
 * "are you there". Only a thrown error or the timeout means unreachable. The
 * request deliberately runs in the default CORS mode rather than `no-cors`:
 * a captive portal that intercepts it will not return our origin's CORS
 * header, so the fetch rejects and we correctly read it as unreachable, where
 * an opaque response would have looked like success.
 */
export async function probeReachable(url: string, timeoutMs: number = PROBE_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // HEAD, so nothing is transferred beyond headers.
    await fetch(url, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------------------------------------------ */
/* Shared state                                                        */
/* ------------------------------------------------------------------ */

let reachable = true;
let checkedAt = 0;
/**
 * True while a session's poll loop is running. That loop hits the API every
 * few seconds already, so its outcome is a better reachability signal than a
 * probe and costs nothing extra — probing alongside it would just double the
 * request rate on the endpoint we are trying to be frugal with.
 */
let pollDriven = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Records a reading from anywhere — a probe, or a poll that succeeded. */
export function reportReachable(value: boolean): void {
  checkedAt = Date.now();
  if (reachable === value) return;
  reachable = value;
  emit();
}

export function setPollDriven(value: boolean): void {
  pollDriven = value;
}

/**
 * The current reading, refreshed if it is stale.
 *
 * Never runs on a timer: callers are the online/offline events, tab focus, and
 * the moment just before an action that needs the network. `force` skips the
 * freshness check for the cases where something has definitely changed.
 */
export async function ensureReachable(force = false): Promise<boolean> {
  // The one thing navigator.onLine is good for.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    reportReachable(false);
    return false;
  }
  if (pollDriven) return reachable;
  if (!force && Date.now() - checkedAt < REACHABILITY_TTL_MS) return reachable;

  const result = await probeReachable(api.probeUrl());
  reportReachable(result);
  return result;
}

/* ------------------------------------------------------------------ */
/* React binding                                                       */
/* ------------------------------------------------------------------ */

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Reachability, for rendering.
 *
 * The server snapshot is always `true`: the page is prerendered, and baking a
 * "cannot reach" notice into static HTML would show it to crawlers and to
 * anyone whose first paint beats hydration.
 */
export function useReachability(): boolean {
  const value = useSyncExternalStore(
    subscribe,
    () => reachable,
    () => true,
  );

  useEffect(() => {
    const offline = () => reportReachable(false);
    const online = () => void ensureReachable(true);
    const focused = () => {
      if (document.visibilityState === 'visible') void ensureReachable();
    };

    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    window.addEventListener('focus', focused);
    document.addEventListener('visibilitychange', focused);
    // Once on mount, treated as the first focus: a page opened on a dead
    // hotspot should say so before the user reaches for a button, and neither
    // focus nor visibilitychange fires on initial load.
    void ensureReachable(true);

    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      window.removeEventListener('focus', focused);
      document.removeEventListener('visibilitychange', focused);
    };
  }, []);

  return value;
}
