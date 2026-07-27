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
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl bg-white p-3"
      style={{ width: size + 24, height: size + 24 }}
    >
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise
        <img src={dataUrl} alt="QR code for this session" width={size} height={size} className="rounded-lg" />
      ) : (
        <div className="h-full w-full animate-pulse rounded-lg bg-neutral-200" />
      )}
    </div>
  );
}
