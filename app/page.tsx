'use client';

import { useEffect, useMemo, useState } from 'react';
import { CodePanel } from '@/components/CodePanel';
import { Composer } from '@/components/Composer';
import { AppColumns } from '@/components/AppColumns';
import { AlertIcon, PowerIcon, UploadIcon } from '@/components/Icons';
import { ItemList } from '@/components/ItemList';
import { LandingContent } from '@/components/LandingContent';
import { QrCode } from '@/components/QrCode';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { StartScreen } from '@/components/StartScreen';
import { TransferList } from '@/components/TransferList';
import { Button } from '@/components/ui';
import { useReachability } from '@/lib/reachability';
import { useShareSession } from '@/lib/useShareSession';

export default function Home() {
  const share = useShareSession();
  const reachable = useReachability();
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
    // The only container on the page. Header, app area, marketing block and
    // footer are all direct children, so every block shares one left and right
    // edge at every width — the thing that was broken when the marketing block
    // carried a narrower max-width of its own and the page stepped inward
    // partway down. Prose is kept readable by capping paragraphs inside the
    // cards, not by narrowing the cards.
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10 lg:max-w-5xl">
      <SiteHeader
        path="/"
        actions={
          // aria-label because the text label is hidden below sm: without it
          // the button is icon-only and has no accessible name on mobile.
          share.session ? (
            <Button
              variant="danger"
              onClick={() => void share.end()}
              disabled={share.busy}
              aria-label="End session"
            >
              <PowerIcon />
              <span className="hidden sm:inline">End session</span>
            </Button>
          ) : null
        }
      />

      {/* Ahead of the failure rather than after it: without this the code
          field and the upload button stay live while offline, and the only
          feedback is a request that never resolves. The page itself keeps
          working — everything already on screen is readable, and the notice
          clears itself when the connection returns. */}
      {!reachable && (
        <div
          role="status"
          className="glass mt-5 flex items-start gap-2.5 rounded-xl border-border-contrast p-3.5 text-sm"
        >
          <AlertIcon width={18} height={18} className="mt-0.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-muted-foreground">
            <span className="font-medium text-foreground">Can&rsquo;t reach Mubifiles.</span> You may
            be offline, or on a network that is not letting the connection through — a hotspot with
            no signal, or guest Wi-Fi before you have signed in, both do this. Starting or joining a
            session needs that connection. This page keeps working, and the buttons come back on
            their own as soon as it does.
          </span>
        </div>
      )}

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
          /* The code and QR are reference material once you have read them,
             so they become a rail; the composer and the item list are what you
             actually watch. TransferList belongs with the composer that starts
             it — and has to be in that column anyway, since two stacked blocks
             can only split the mobile order contiguously. */
          <AppColumns
            arrangement="rail-left"
            lead={
              <CodePanel
                session={share.session}
                pairingUrl={pairingUrl}
                qr={pairingUrl ? <QrCode value={pairingUrl} /> : null}
              />
            }
            trail={
              <>
                <Composer
                  busy={share.busy}
                  offline={!reachable}
                  maxFileBytes={share.session.limits.maxFileBytes}
                  maxTextChars={share.session.limits.maxTextChars}
                  onSendText={(text) => void share.sendText(text)}
                  onSendFiles={(files) => void share.sendFiles(files)}
                  onSendFilesDirect={(files) => void share.sendFilesDirect(files)}
                  canSendDirect={share.canSendDirect}
                />

                {/* A direct transfer failing is a normal outcome — different
                    networks, or an access point that keeps its clients apart —
                    so it is explained rather than reported as an error, and
                    the way out is one button rather than the file picker
                    again. */}
                {share.lanState === 'unavailable' && (
                  <div
                    role="status"
                    className="glass mt-5 flex items-start gap-2.5 rounded-xl border-border-contrast p-3.5 text-sm"
                  >
                    <AlertIcon width={18} height={18} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Couldn&rsquo;t connect the two devices directly.
                        </span>{' '}
                        They are probably on different networks — or on Wi-Fi that keeps its devices
                        from talking to each other, which is common on guest and public networks.
                        Sending through the cloud works anywhere.
                      </p>
                      <Button className="mt-3" onClick={() => void share.retryViaCloud()} disabled={share.busy}>
                        <UploadIcon />
                        Send via cloud instead
                      </Button>
                    </div>
                  </div>
                )}

                <TransferList
                  transfers={share.transfers}
                  onCancel={(id) => void share.cancelUpload(id)}
                  onPause={share.pauseUpload}
                  onStopNow={share.stopNow}
                  onResume={(id) => void share.resumeUpload(id)}
                  canResume={share.canResume}
                  onDismiss={share.dismissTransfer}
                />
                <ItemList
                  session={share.session}
                  downloadUrl={share.downloadUrl}
                  transfers={share.transfers}
                  onCancel={(id) => void share.cancelUpload(id)}
                />
              </>
            }
          />
        ) : (
          <StartScreen
            busy={share.busy || !share.ready}
            offline={!reachable}
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
