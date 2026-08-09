/**
 * Offline shell for Mubifiles.
 *
 * Both placeholders below are filled in by scripts/gen-sw.mjs after the static
 * export exists — the list has to be built from what `next build` actually
 * emitted, since the asset filenames are content-hashed. The generator fails
 * the build if it cannot find them, so this file is never shipped unreplaced.
 *
 * If it somehow were, the precache list would be the literal string below,
 * addAll would 404, install would reject and the worker would never activate.
 * The site keeps working; it just gains no offline support. That is the right
 * way round for a failure nobody noticed.
 */
const VERSION = '__BUILD_ID__';
const CACHE = `mubifiles-${VERSION}`;
const PRECACHE = ['__PRECACHE__'];

/** The navigation fallback: the app shell, which renders without the network. */
const SHELL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // A new build should take over immediately rather than waiting for every
      // tab to close. Nothing here is stateful across versions, so there is no
      // half-upgraded state to land in.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never touch anything that is not a plain GET of our own static output.
  //
  // The API is the important exclusion and it is excluded twice over: by path
  // when the Worker serves this origin, and by origin when the UI is on Vercel
  // and the API is on the Worker's own domain. A cached API response would be
  // worse than an offline error — it would show a session that has since
  // expired, or files that are already deleted. Uploads and downloads are
  // non-GET or cross-origin and fall out here too.
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Network first, so a returning visitor gets the current build rather than
    // whatever was cached. Session URLs (/?code=123456) are deliberately not
    // written to the cache — the shell is enough to render them offline, and
    // caching one would leave a stale code in storage.
    event.respondWith(fetch(request).catch(() => caches.match(SHELL).then((cached) => cached ?? Response.error())));
    return;
  }

  // Everything else is a content-hashed build asset: if it is in the cache it
  // is by definition current, so there is nothing to revalidate.
  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});
