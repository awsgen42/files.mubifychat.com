/**
 * The worker shim.
 *
 * Deliberately this short. Everything it does lives in engine.ts, which knows
 * nothing about workers — so the same code can be run on the main thread to
 * measure what moving it off actually buys, instead of the claim being
 * unfalsifiable. See perf/controls.mjs.
 */
import { createEngine, type WorkerRequest } from './engine';

export type { WorkerRequest, WorkerResponse } from './engine';

const handle = createEngine((response) => (self as unknown as Worker).postMessage(response));

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void handle(event.data);
});
