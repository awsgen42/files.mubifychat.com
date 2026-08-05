'use client';

import { useEffect, useMemo, useState } from 'react';
import { CodePanel } from '@/components/CodePanel';
import { Composer } from '@/components/Composer';
import { AlertIcon, LogoMark, PowerIcon } from '@/components/Icons';
import { ItemList } from '@/components/ItemList';
import { LandingContent } from '@/components/LandingContent';
import { QrCode } from '@/components/QrCode';
import { SiteFooter } from '@/components/SiteFooter';
import { StartScreen } from '@/components/StartScreen';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TransferList } from '@/components/TransferList';
import { Button } from '@/components/ui';
import { useShareSession } from '@/lib/useShareSession';

export default function Home() {
  const share = useShareSession();
  const [initialCode, setInitialCode] = useState<string>();

  // A scanned QR opens `/?code=123456`; strip it from the URL afterwards so a
  // refresh doesn't try to re-join a session that has already been left.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code')?.replace(/\D/g, '').slice(0, 6);
    if (code?.length === 6) {
      setInitialCode(code);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Once the code has done its job, forget it — otherwise ending the session
  // drops us back to the start screen and it auto-joins the dead code again.
  useEffect(() => {
    if (share.session) setInitialCode(undefined);
  }, [share.session]);

  const pairingUrl = useMemo(() => {
    if (!share.session) return '';
    return `${window.location.origin}${window.location.pathname}?code=${share.session.code}`;
  }, [share.session]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <div>
            {/* Not an <h1>: the landing section below owns the page heading. */}
            <p className="text-lg font-semibold leading-tight">Mubifiles</p>
            <p className="text-xs text-muted-foreground">Phone to PC in seconds</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* aria-label because the text label is hidden below sm: without it
              the button is icon-only and has no accessible name on mobile. */}
          {share.session && (
            <Button
              variant="danger"
              onClick={() => void share.end()}
              disabled={share.busy}
              aria-label="End session"
            >
              <PowerIcon />
              <span className="hidden sm:inline">End session</span>
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {share.error && (
        <div
          role="alert"
          className="glass mt-5 flex items-start gap-2.5 rounded-xl border-danger/30 bg-danger/10 p-3.5 text-sm text-danger"
        >
          <AlertIcon width={18} height={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">{share.error}</span>
          <button onClick={share.clearError} className="shrink-0 font-medium underline underline-offset-2">
            Dismiss
          </button>
        </div>
      )}

      {/* No separate loading branch: a "Loading…" placeholder is a fraction of
          StartScreen's height, so swapping it in on hydration shoved everything
          below it down the page (CLS 0.32 on mobile). Rendering the real
          StartScreen from the start reserves exactly the right space at every
          viewport, with its controls disabled until the session restore
          settles. It also means crawlers see the actual UI, not a spinner. */}
      <main className="mt-5 flex-1 sm:mt-6">
        {share.session ? (
          <div className="grid gap-4 sm:gap-5">
            <CodePanel
              session={share.session}
              pairingUrl={pairingUrl}
              qr={pairingUrl ? <QrCode value={pairingUrl} /> : null}
            />
            <Composer
              busy={share.busy}
              maxFileBytes={share.session.limits.maxFileBytes}
              maxTextChars={share.session.limits.maxTextChars}
              onSendText={(text) => void share.sendText(text)}
              onSendFiles={(files) => void share.sendFiles(files)}
            />
            <TransferList transfers={share.transfers} />
            <ItemList session={share.session} downloadUrl={share.downloadUrl} />
          </div>
        ) : (
          <StartScreen
            busy={share.busy || !share.ready}
            initialCode={initialCode}
            onCreate={(oneShot) => void share.create(oneShot)}
            onJoin={(code) => void share.join(code)}
          />
        )}
      </main>

      {/* Rendered whenever no session is open, which is also the state the
          static export is prerendered in — so this copy is in the HTML a
          crawler receives, before any JavaScript runs. */}
      {!share.session && <LandingContent />}

      <SiteFooter />
    </div>
  );
}
