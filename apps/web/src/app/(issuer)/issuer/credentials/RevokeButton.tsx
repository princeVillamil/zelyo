"use client";

import { useState } from "react";

export function RevokeButton({ credentialId }: { credentialId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string>("");

  async function revoke() {
    setState("busy");
    const res = await fetch(`/api/issuer/credentials/${credentialId}/revoke`, { method: "POST" });
    if (res.ok) {
      setState("done");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    setMsg(body.error?.message ?? "Revoke failed");
    setState("error");
  }

  if (state === "done") return <span className="font-label text-label-md uppercase text-error">Revoked</span>;

  return (
    <span className="inline-flex flex-col items-end gap-unit">
      <button
        onClick={revoke}
        disabled={state === "busy"}
        className="font-label text-label-md uppercase text-error hover:opacity-80 disabled:opacity-50"
      >
        {state === "busy" ? "Revoking…" : "Revoke"}
      </button>
      {state === "error" && <span className="font-caption italic text-error">{msg}</span>}
    </span>
  );
}
