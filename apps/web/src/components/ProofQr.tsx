"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Scannable QR for a proof receipt URL. Generated client-side so the receipt
 * page stays static-renderable; the URL is absolute (APP_URL + path) so a
 * judge's phone lands on the live receipt.
 */
export function ProofQr({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 168 })
      .then((png) => {
        if (!cancelled) setDataUrl(png);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!dataUrl) {
    return (
      <div
        aria-label="Generating QR code…"
        className="h-[168px] w-[168px] shrink-0 rounded border border-outline-variant bg-surface-container"
      />
    );
  }

  return (
    // next/image can't optimize a generated data URL; a plain <img> is correct here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      width={168}
      height={168}
      alt={`QR code linking to ${url}`}
      className="shrink-0 rounded border border-outline-variant bg-white p-1"
    />
  );
}
