'use client';

import { useEffect } from 'react';

/**
 * Registers the offline shell. Renders nothing — it exists only for the
 * effect, so the prerendered HTML is unchanged by its presence.
 *
 * Registration waits for `load` so it never competes with the first paint for
 * bandwidth: the worker's whole job is the *second* visit.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register('/sw.js').catch((error) => {
        // A failed registration costs offline support and nothing else, so it
        // is logged rather than surfaced.
        console.error('Service worker registration failed', error);
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
