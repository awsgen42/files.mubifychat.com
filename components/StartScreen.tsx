'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CONNECT_ACTION,
  ONE_SHOT_HINT,
  ONE_SHOT_LABEL,
  RECEIVE_BODY,
  RECEIVE_HEADING,
  SEND_BODY,
  SEND_HEADING,
  START_ACTION,
} from '@/lib/copy';
import { AppColumns } from './AppColumns';
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

  const send = (
    <Card>
      <h2 className="text-base font-semibold">{SEND_HEADING}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{SEND_BODY}</p>

      <label className="glass-input mt-4 flex cursor-pointer items-start gap-3 p-3">
        <input
          type="checkbox"
          checked={oneShot}
          onChange={(event) => setOneShot(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
        />
        <span className="text-sm">
          <span className="font-medium">{ONE_SHOT_LABEL}</span>
          <span className="block text-muted-foreground">{ONE_SHOT_HINT}</span>
        </span>
      </label>

      <Button className="mt-4 w-full" onClick={() => onCreate(oneShot)} disabled={busy}>
        <UploadIcon />
        {START_ACTION}
      </Button>
    </Card>
  );

  const receive = (
    <Card>
      <h2 className="text-base font-semibold">{RECEIVE_HEADING}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{RECEIVE_BODY}</p>

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
          {CONNECT_ACTION}
        </Button>
      </form>
    </Card>
  );

  // Equal halves: sending and receiving are two choices of equal standing, and
  // nothing we know yet says a desktop visitor wants one over the other.
  return <AppColumns arrangement="even" lead={send} trail={receive} />;
}

function formatInput(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}
