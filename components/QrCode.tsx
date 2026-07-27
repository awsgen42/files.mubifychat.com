'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Renders the pairing URL as a QR image. Generated client-side so it costs
 * nothing on the server, and re-generated when the theme flips so the codes
 * stay legible on both backgrounds.
 */
export function QrCode({ value, size = 168 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      const url = await QRCode.toDataURL(value, {
        width: size * 2,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f1117ff', light: '#ffffffff' },
      });
      if (!cancelled) setDataUrl(url);
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    // The QR itself stays on solid white — scanners need the contrast — but the
    // frame around it is glass so it sits with the rest of the UI.
    <div
      className="glass flex shrink-0 items-center justify-center rounded-2xl p-2.5"
      style={{ width: size + 20, height: size + 20 }}
    >
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise
        <img
          src={dataUrl}
          alt="QR code for this session"
          width={size}
          height={size}
          className="rounded-xl bg-white p-2"
        />
      ) : (
        <div className="h-full w-full animate-pulse rounded-xl bg-surface-muted" />
      )}
    </div>
  );
}
