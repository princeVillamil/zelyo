"use client";

import { useState } from "react";

export function VcDownloadButton({ credentialId }: { credentialId: string }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const res = await fetch(`/api/holder/credentials/${credentialId}/vc`);
      if (!res.ok) return;
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="border border-outline rounded font-label text-label-md uppercase text-primary px-stack-md py-stack-sm hover:bg-secondary-container"
    >
      {busy ? "Preparing…" : "Download Raw VC"}
    </button>
  );
}
