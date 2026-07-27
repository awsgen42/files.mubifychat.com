'use client';

import { useEffect, useState } from 'react';
import type { SessionView } from '@/shared/types';
import { formatCode, formatCountdown } from '@/lib/format';
import { CheckIcon, CopyIcon } from './Icons';
import { Button, Card, Pill, StatusDot } from './ui';

interface CodePanelProps {
  session: SessionView;
  pairingUrl: string;
  qr: React.ReactNode;
}

export function CodePanel({ session, pairingUrl, qr }: CodePanelProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const remaining = useCountdown(session.expiresAt);
  const paired = session.participants.length > 1;

  const copy = async (what: 'code' | 'link', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard can be blocked without a secure context; the value is
      // visible on screen either way.
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={paired ? 'success' : 'muted'}>
              <StatusDot active={paired} />
              {paired ? 'Both devices connected' : 'Waiting for the other device'}
            </Pill>
            {session.oneShot && <Pill tone="accent">One-time download</Pill>}
          </div>

          <p
            className="mt-3 bg-gradient-to-br from-foreground to-accent bg-clip-text font-mono text-4xl font-semibold tracking-[0.18em] tabular-nums text-transparent sm:text-5xl"
            aria-label={`Session code ${session.code.split('').join(' ')}`}
          >
            {formatCode(session.code)}
          </p>

          <p className="mt-2 text-sm text-muted-foreground">
            Closes in <span className="tabular-nums">{formatCountdown(remaining)}</span> of inactivity
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => copy('code', session.code)}>
              {copied === 'code' ? <CheckIcon /> : <CopyIcon />}
              {copied === 'code' ? 'Copied' : 'Copy code'}
            </Button>
            <Button variant="secondary" onClick={() => copy('link', pairingUrl)}>
              {copied === 'link' ? <CheckIcon /> : <CopyIcon />}
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>

        <div className="flex justify-center sm:justify-end">{qr}</div>
      </div>
    </Card>
  );
}

/** Ticks once a second so the inactivity countdown stays honest. */
function useCountdown(target: number): number {
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    setRemaining(target - Date.now());
    const interval = window.setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [target]);

  return remaining;
}
