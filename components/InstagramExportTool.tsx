'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from './ui';
import type { ProbeResponse } from '@/lib/instagram/probe.worker';

/**
 * Skeleton while Phase 1 is measured. It exists so the worker question can be
 * settled in a production static build rather than in dev, and so the numbers
 * that follow are measured against the real bundle graph.
 */
export function InstagramExportTool() {
  const [status, setStatus] = useState('starting worker…');
  const worker = useRef<Worker | null>(null);

  useEffect(() => {
    // The URL form matters: a bare string path is not traced by the bundler in
    // a static export, and the worker 404s at runtime.
    const w = new Worker(new URL('../lib/instagram/probe.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = w;
    w.onmessage = (event: MessageEvent<ProbeResponse>) => {
      const data = event.data;
      if (data.kind === 'pong') {
        setStatus(`worker alive in ${data.where} · zip.js=${data.hasZipJs}`);
      } else if (data.kind === 'entries') {
        setStatus(`central directory: ${data.count} entries in ${Math.round(data.ms)} ms`);
      } else if (data.kind === 'error') {
        setStatus(`worker error: ${data.message}`);
      }
    };
    w.onerror = (event) => setStatus(`worker failed to load: ${event.message}`);
    w.postMessage({ kind: 'ping' });
    // Exposed for the measurement harness; removed when this stops being a probe.
    (window as unknown as { __igWorker?: Worker }).__igWorker = w;
    return () => w.terminate();
  }, []);

  return (
    <Card>
      <h2 className="text-base font-semibold">Phase 1 probe</h2>
      <p className="mt-2 min-h-10 font-mono text-xs text-muted-foreground" data-probe>
        {status}
      </p>
      <input
        type="file"
        accept=".zip"
        className="mt-3 block w-full text-xs"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            setStatus('reading central directory…');
            worker.current?.postMessage({ kind: 'centralDirectory', file });
          }
        }}
      />
    </Card>
  );
}
