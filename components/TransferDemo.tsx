/**
 * The animated illustration under the landing headline: a phone starts a
 * session, a code and QR resolve, the computer enters the code, a file lands.
 *
 * A miniature of the real UI rather than a drawing of it — the same .glass /
 * .card / .glass-input surfaces, the same icon components, and the same copy
 * constants the start screen renders. It re-themes and re-words with the
 * product instead of alongside it. Geometry lives in globals.css under
 * "Landing-page transfer demo".
 *
 * Deliberately not a client component: it is pure markup driven by CSS
 * keyframes, so it is in the prerendered HTML and costs no JavaScript.
 *
 * Accessibility: the whole figure carries one label and the stage inside is
 * hidden. To a screen reader this is a single image with a sentence of alt
 * text — labelling the parts would narrate a cartoon.
 */
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
import { DemoQrCode } from './DemoQrCode';
import { FileIcon, LinkIcon, LogoMark, UploadIcon } from './Icons';

const LABEL =
  'Start a session on your phone and it shows a six-digit code and a QR code. ' +
  'Enter that code on your computer, or scan the QR, and files move between the two devices.';

export function TransferDemo() {
  return (
    <div className="mf-demo" role="img" aria-label={LABEL}>
      <div className="mf-stage" aria-hidden="true">
        {/* ─────────── phone ─────────── */}
        <div className="mf-phone">
          <div className="mf-head">
            <LogoMark width={21} height={21} />
            <div>
              <p className="mf-brand">Mubifiles</p>
              <p className="mf-tag text-muted-foreground">Phone to PC in seconds</p>
            </div>
          </div>

          <div className="mf-body">
            {/* state A: the send card */}
            <div className="mf-slot mf-send">
              <section className="glass card" style={{ padding: 11 }}>
                <h2 className="mf-h2">{SEND_HEADING}</h2>
                <p className="mf-p text-muted-foreground">{SEND_BODY}</p>
                <span className="glass-input mf-opt">
                  <span className="mf-box" />
                  <span>
                    <span className="mf-opt-t">{ONE_SHOT_LABEL}</span>
                    <span className="mf-opt-s text-muted-foreground" style={{ display: 'block' }}>
                      {ONE_SHOT_HINT}
                    </span>
                  </span>
                </span>
                <span className="mf-btn bg-accent text-accent-foreground">
                  <UploadIcon width={12} height={12} strokeWidth={1.9} />
                  {START_ACTION}
                </span>
              </section>
            </div>

            {/* state B: the resolved code */}
            <div className="mf-slot mf-reveal">
              <section className="glass card" style={{ padding: '13px 11px' }}>
                <p className="mf-code">482 071</p>
                <p className="mf-cap text-muted-foreground">SESSION CODE</p>
                <div className="mf-qr mf-qrpop">
                  <DemoQrCode />
                </div>
                <p className="mf-scan text-muted-foreground">or scan it</p>
              </section>
            </div>
          </div>
        </div>

        {/* ─────────── wire ─────────── */}
        <div className="mf-wire" />

        {/* ─────────── computer ─────────── */}
        <div className="mf-pc">
          <div className="mf-pc-win">
            <div className="mf-pc-bar">
              <span className="mf-dot" />
              <span className="mf-dot" />
              <span className="mf-dot" />
              <span className="mf-url">mubifiles.com</span>
            </div>
            <div className="mf-pc-screen">
              <section className="glass card" style={{ padding: 12 }}>
                <h2 className="mf-h2">{RECEIVE_HEADING}</h2>
                <p className="mf-p text-muted-foreground">{RECEIVE_BODY}</p>
                <div className="mf-field">
                  <div className="glass-input mf-input">
                    <span className="mf-digit mf-d1">4</span>
                    <span className="mf-digit mf-d2">8</span>
                    <span className="mf-digit mf-d3">2</span>{' '}
                    <span className="mf-digit mf-d4">0</span>
                    <span className="mf-digit mf-d5">7</span>
                    <span className="mf-digit mf-d6">1</span>
                    <span className="mf-caret" />
                  </div>
                  <span className="glass mf-connect">
                    <LinkIcon width={11} height={11} strokeWidth={1.9} />
                    {CONNECT_ACTION}
                  </span>
                </div>
              </section>

              <div className="mf-status">
                <span className="mf-led" />
                <span>Connected</span>
              </div>

              <div className="mf-file">
                <FileIcon width={12} height={12} strokeWidth={1.7} stroke="var(--accent)" />
                <span>photo.jpg</span>
                <span className="mf-saved text-muted-foreground">SAVED</span>
              </div>
            </div>
          </div>
          <div className="mf-stand" />
          <div className="mf-base" />
        </div>
      </div>
    </div>
  );
}
