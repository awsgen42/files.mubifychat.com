import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeReachable } from '../lib/reachability';

/**
 * The probe answers one question: did anything answer at all.
 *
 * That distinction is the whole point — navigator.onLine reports whether an
 * interface is up, which on a hotspot with no upstream is true while every
 * request hangs. So "reachable" has to mean a response came back, and an
 * unhelpful response still counts.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const stubFetch = (impl: (url: string, init: RequestInit) => Promise<Response>) => {
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
};

describe('probeReachable', () => {
  it('treats any response as reachable, including ones that failed', async () => {
    for (const status of [200, 204, 404, 429, 500]) {
      stubFetch(async () => new Response(null, { status }));
      expect(await probeReachable('/api/')).toBe(true);
    }
  });

  it('treats a thrown request as unreachable', async () => {
    // What a dead hotspot or a refused connection actually produces.
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await probeReachable('/api/')).toBe(false);
  });

  it('treats a request that never answers as unreachable', async () => {
    // The case navigator.onLine misses: the socket opens and nothing comes
    // back. Without the timeout this would hang until TCP gave up.
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const started = Date.now();
    expect(await probeReachable('/api/', 40)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('asks for headers only, and never from a cache', async () => {
    const spy = stubFetch(async () => new Response(null, { status: 404 }));
    await probeReachable('/api/');
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/');
    expect(init.method).toBe('HEAD');
    // A cached answer would report the last visit's connectivity, not this one.
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not leave its timer running once a response arrives', async () => {
    vi.useFakeTimers();
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    stubFetch(async () => new Response(null, { status: 200 }));
    await probeReachable('/api/');
    expect(clear).toHaveBeenCalled();
  });
});
