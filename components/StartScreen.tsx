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
  /** No connection: both actions would hang, so neither is offered. */
  offline?: boolean;
  /** Prefilled from a scanned QR link (?code=123456). */
  initialCode?: string;
  onCreate: (oneShot: boolean) => void;
  onJoin: (code: string) => void;
}

export function StartScreen({ busy, offline = false, initialCode, onCreate, onJoin }: StartScreenProps) {
  // Everything that would reach the network is gated on this, including the
  // auto-join below — a scanned QR must not fire a doomed request either.
  const blocked = busy || offline;
  const [code, setCode] = useState(initialCode ?? '');
  const [oneShot, setOneShot] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const attemptedRef = useRef<string | null>(null);

  // Joining as soon as the sixth digit lands removes a tap on mobile, but only
  // once per code so a rejected join doesn't retry in a loop.
  useEffect(() => {
    if (code.length === CODE_LENGTH && attemptedRef.current !== code && !blocked) {
      attemptedRef.current = code;
      onJoin(code);
    }
  }, [code, blocked, onJoin]);

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

      <Button className="mt-4 w-full" onClick={() => onCreate(oneShot)} disabled={blocked}>
        <UploadIcon />
        {START_ACTION}
      </Button>
    </Card>
  );

  const receive = (
    // Centred at lg only: the two cards form one equal-height band there, and
    // Receive has less to say than Send, so top-aligning it would leave a void
    // under it. Below lg the cards are their own height and this is a no-op.
    <Card className="lg:flex lg:flex-col lg:justify-center">
      <h2 className="text-base font-semibold">{RECEIVE_HEADING}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{RECEIVE_BODY}</p>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.length === CODE_LENGTH && !blocked) {
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
          disabled={offline}
          className="glass-input w-full flex-1 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] outline-none placeholder:text-muted-foreground/40 sm:text-left"
        />
        <Button type="submit" variant="secondary" disabled={blocked || code.length !== CODE_LENGTH}>
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
