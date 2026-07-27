'use client';

import { useEffect, useRef, useState } from 'react';
import { LinkIcon, UploadIcon } from './Icons';
import { Button, Card } from './ui';

const CODE_LENGTH = 6;

interface StartScreenProps {
  busy: boolean;
  /** Prefilled from a scanned QR link (?code=123456). */
  initialCode?: string;
  onCreate: (oneShot: boolean) => void;
  onJoin: (code: string) => void;
}

export function StartScreen({ busy, initialCode, onCreate, onJoin }: StartScreenProps) {
  const [code, setCode] = useState(initialCode ?? '');
  const [oneShot, setOneShot] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const attemptedRef = useRef<string | null>(null);

  // Joining as soon as the sixth digit lands removes a tap on mobile, but only
  // once per code so a rejected join doesn't retry in a loop.
  useEffect(() => {
    if (code.length === CODE_LENGTH && attemptedRef.current !== code && !busy) {
      attemptedRef.current = code;
      onJoin(code);
    }
  }, [code, busy, onJoin]);

  return (
    <div className="grid gap-4 sm:gap-5">
      <Card>
        <h2 className="text-base font-semibold">Send something</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start a session on this device, then open Mubifiles on the other one and enter the code.
        </p>

        <label className="glass-input mt-4 flex cursor-pointer items-start gap-3 p-3">
          <input
            type="checkbox"
            checked={oneShot}
            onChange={(event) => setOneShot(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-sm">
            <span className="font-medium">One-time download</span>
            <span className="block text-muted-foreground">
              Each file can be downloaded once, then it&apos;s gone.
            </span>
          </span>
        </label>

        <Button className="mt-4 w-full" onClick={() => onCreate(oneShot)} disabled={busy}>
          <UploadIcon />
          Start a session
        </Button>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Receive something</h2>
        <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code shown on the other device.</p>

        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.length === CODE_LENGTH) {
              attemptedRef.current = code;
              onJoin(code);
            }
          }}
        >
          <input
            ref={inputRef}
            value={formatInput(code)}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            placeholder="000 000"
            aria-label="Session code"
            className="glass-input w-full flex-1 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] outline-none placeholder:text-muted-foreground/40 sm:text-left"
          />
          <Button type="submit" variant="secondary" disabled={busy || code.length !== CODE_LENGTH}>
            <LinkIcon />
            Connect
          </Button>
        </form>
      </Card>
    </div>
  );
}

function formatInput(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}
