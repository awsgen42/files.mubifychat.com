'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  MAX_PAYLOAD_BYTES,
  buildPayload,
  checkUrl,
  isTooLong,
  payloadByteLength,
  type PayloadKind,
  type WifiSecurity,
} from '@/lib/qrpayload';
import { AlertIcon, CheckIcon, DownloadIcon } from './Icons';
import { Button, Card, cx } from './ui';

/**
 * The QR generator page's interactive half.
 *
 * The encoder is the `qrcode` package the session QR already uses — this adds
 * no second QR implementation, only the inputs, the two download formats and
 * the payload rules in lib/qrpayload.ts.
 */

const KINDS: readonly { id: PayloadKind; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'url', label: 'Link' },
  { id: 'wifi', label: 'Wi-Fi' },
];

/** Rendered at 4x the displayed size so the PNG is usable when printed. */
const PREVIEW_PX = 240;
const EXPORT_PX = 960;

/**
 * Fixed, not tokenised. A QR has to be dark-on-light whatever the page theme
 * is doing — the same decision, for the same reason, as the session QR.
 */
const QR_COLORS = { dark: '#0f1117ff', light: '#ffffffff' } as const;

export function QrTool() {
  const [kind, setKind] = useState<PayloadKind>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [security, setSecurity] = useState<WifiSecurity>('WPA');
  const [hidden, setHidden] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payload = useMemo(
    () => buildPayload(kind, { text, url, wifi: { ssid, password, security, hidden } }),
    [kind, text, url, ssid, password, security, hidden],
  );

  const urlProblem = kind === 'url' ? checkUrl(url) : null;
  const tooLong = payload !== '' && isTooLong(payload);
  const encodable = payload !== '' && !tooLong && urlProblem !== 'not-a-url';

  useEffect(() => {
    if (!encodable) {
      setDataUrl(null);
      setSvg(null);
      setError(null);
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const [png, vector] = await Promise.all([
          QRCode.toDataURL(payload, {
            width: EXPORT_PX,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: QR_COLORS,
          }),
          QRCode.toString(payload, {
            type: 'svg',
            margin: 2,
            errorCorrectionLevel: 'M',
            color: QR_COLORS,
          }),
        ]);
        if (cancelled) return;
        setDataUrl(png);
        setSvg(vector);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setDataUrl(null);
        setSvg(null);
        setError(err instanceof Error ? err.message : 'That could not be encoded.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [payload, encodable]);

  return (
    <>
      <Card>
        <h2 className="text-base font-semibold">What should the code contain?</h2>

        <div role="group" aria-label="Code type" className="mt-3 flex flex-wrap gap-2">
          {KINDS.map((option) => (
            <Button
              key={option.id}
              variant={kind === option.id ? 'primary' : 'secondary'}
              className="px-3 py-2 text-xs"
              aria-pressed={kind === option.id}
              onClick={() => setKind(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Each kind's inputs occupy the same reserved block, so switching
            between them cannot move the preview or anything below it. */}
        <div className="mt-4 min-h-52">
          {kind === 'text' && (
            <label className="block">
              <span className="text-sm font-medium">Text</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={5}
                placeholder="Anything you want the code to contain…"
                className="glass-input mt-1.5 w-full resize-y p-3 text-sm outline-none placeholder:text-muted-foreground/60"
              />
            </label>
          )}

          {kind === 'url' && (
            <label className="block">
              <span className="text-sm font-medium">Link</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                inputMode="url"
                spellCheck={false}
                placeholder="example.com/page"
                className="glass-input mt-1.5 w-full p-3 text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <span className="mt-1.5 block min-h-8 text-xs text-muted-foreground">
                {urlProblem === 'not-a-url' ? (
                  <span className="flex items-center gap-1.5 text-danger">
                    <AlertIcon width={14} height={14} />
                    That does not look like a web address.
                  </span>
                ) : url.trim() !== '' ? (
                  `Encodes as ${payload}`
                ) : (
                  'https:// is added for you if you leave it off.'
                )}
              </span>
            </label>
          )}

          {kind === 'wifi' && (
            <div className="grid gap-3">
              <label className="block">
                <span className="text-sm font-medium">Network name (SSID)</span>
                <input
                  value={ssid}
                  onChange={(event) => setSsid(event.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="MyNetwork"
                  className="glass-input mt-1.5 w-full p-3 text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Password</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  disabled={security === 'nopass'}
                  placeholder={security === 'nopass' ? 'Open network — no password' : '••••••••'}
                  className="glass-input mt-1.5 w-full p-3 text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
                />
              </label>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Security</span>
                  <select
                    value={security}
                    onChange={(event) => setSecurity(event.target.value as WifiSecurity)}
                    className="glass-input px-2 py-1.5 text-sm outline-none"
                  >
                    <option value="WPA">WPA/WPA2/WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Open</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hidden}
                    onChange={(event) => setHidden(event.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span>Hidden network</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 min-h-8 text-xs text-muted-foreground tabular-nums">
          {tooLong ? (
            <span className="flex items-center gap-1.5 text-danger">
              <AlertIcon width={14} height={14} />
              {payloadByteLength(payload).toLocaleString()} bytes — a QR code holds about{' '}
              {MAX_PAYLOAD_BYTES.toLocaleString()}. Shorten it and the code will appear.
            </span>
          ) : payload !== '' ? (
            `${payloadByteLength(payload).toLocaleString()} of ${MAX_PAYLOAD_BYTES.toLocaleString()} bytes used`
          ) : (
            ''
          )}
        </p>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Your code</h2>
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* Fixed box: the preview appearing must not move the buttons or the
              sections below, so the space is reserved before there is one. */}
          <div
            className="glass flex shrink-0 items-center justify-center rounded-2xl p-2.5"
            style={{ width: PREVIEW_PX + 20, height: PREVIEW_PX + 20 }}
          >
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise
              <img
                src={dataUrl}
                alt="Your QR code"
                width={PREVIEW_PX}
                height={PREVIEW_PX}
                className="rounded-xl bg-white p-2"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-border-contrast p-4 text-center text-xs text-muted-foreground"
                style={{ width: PREVIEW_PX, height: PREVIEW_PX }}
              >
                {error ?? 'Your code appears here as you type.'}
              </div>
            )}
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2">
            <DownloadButton
              label="Download PNG"
              hint="For screens — messages, slides, web pages."
              filename="qr-code.png"
              href={dataUrl}
            />
            <DownloadButton
              label="Download SVG"
              hint="For print — stays sharp at any size."
              filename="qr-code.svg"
              href={svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null}
            />
            <CopyPayload payload={encodable ? payload : ''} />
          </div>
        </div>
      </Card>
    </>
  );
}

function DownloadButton({
  label,
  hint,
  filename,
  href,
}: {
  label: string;
  hint: string;
  filename: string;
  href: string | null;
}) {
  return (
    <div>
      {href ? (
        <a
          href={href}
          download={filename}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-lg shadow-accent/25 transition-all duration-200 hover:shadow-accent/40 hover:brightness-110 active:scale-[0.98]"
        >
          <DownloadIcon />
          {label}
        </a>
      ) : (
        // Same shape and size as the link, so the row does not move when a
        // code appears — a disabled button rather than nothing at all.
        <Button className="w-full" disabled>
          <DownloadIcon />
          {label}
        </Button>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function CopyPayload({ payload }: { payload: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div>
      <Button
        variant="secondary"
        className="w-full"
        disabled={payload === ''}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(payload);
            setCopied(true);
            timer.current = window.setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard access can be denied; the code itself still works.
          }
        }}
      >
        {copied ? <CheckIcon /> : null}
        {copied ? 'Copied' : 'Copy the encoded text'}
      </Button>
      <p className={cx('mt-1 text-xs text-muted-foreground')}>
        The exact string inside the code, useful for checking a Wi-Fi entry.
      </p>
    </div>
  );
}
