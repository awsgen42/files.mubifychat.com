'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the browser currently believes it has a network connection.
 *
 * `navigator.onLine` is a weak signal — it reports whether an interface is up,
 * not whether anything is reachable — so it is used only to get ahead of a
 * failure the user would otherwise discover by watching a spinner. Requests
 * still fail the ordinary way when it is wrong in the optimistic direction.
 *
 * The server snapshot is `true` deliberately. The page is prerendered, and
 * rendering an offline notice into static HTML would show it to every crawler
 * and to anyone whose first paint beats hydration.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
