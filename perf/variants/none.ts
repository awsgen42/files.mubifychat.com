/**
 * Worker feasibility probe.
 *
 * The repo has never shipped a Web Worker and there is no precedent for one
 * under Next 16 with output: 'export'. Everything in the architecture assumes
 * the zip reading and JSON parsing happen off the main thread, so this settles
 * whether a worker bundles and executes in a *production static build served
 * from disk* before any number is measured that assumes it.
 *
 * Settled: it does. The build also emits a copy of this file's source into
 * static/media as an unused asset; the worker itself is loaded through
 * Turbopack's worker shim, which pulls the compiled chunks.
 *
 * It imports both zip libraries under test so the answer covers the real
 * dependency graph rather than an empty worker that proves nothing.
 */

export type ProbeRequest = { kind: 'ping' } | { kind: 'centralDirectory'; file: File };
export type ProbeResponse =
  | { kind: 'pong'; where: string; hasZipJs: boolean; hasFflate: boolean }
  | { kind: 'entries'; count: number; ms: number }
  | { kind: 'error'; message: string };

self.addEventListener('message', async (event: MessageEvent<ProbeRequest>) => {
  const post = (r: ProbeResponse) => (self as unknown as Worker).postMessage(r);
  try {
    if (event.data.kind === 'ping') {
      post({
        kind: 'pong',
        // `typeof window` is not a reliable discriminator: a bundler runtime
        // can define `window` inside a worker chunk, and the first version of
        // this probe reported 'window-scope' from what turned out to be a real
        // worker. These cannot be faked by an alias — a DedicatedWorker global
        // has no document and does have importScripts.
        where: JSON.stringify({
          global: Object.getPrototypeOf(self)?.constructor?.name ?? '?',
          hasDocument: typeof document !== 'undefined',
          hasImportScripts:
            typeof (self as unknown as { importScripts?: unknown }).importScripts === 'function',
          isWorkerGlobal:
            typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !== 'undefined' &&
            self instanceof (globalThis as unknown as { WorkerGlobalScope: new () => object }).WorkerGlobalScope,
        }),
        hasZipJs: false,
        hasFflate: false,
      });
      return;
    }
    if (event.data.kind === 'centralDirectory') {
      post({ kind: 'entries', count: 0, ms: 0 });
    }
  } catch (error) {
    post({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
