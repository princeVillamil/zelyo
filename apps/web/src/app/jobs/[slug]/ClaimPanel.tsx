"use client";

import { useState } from "react";
import type { GateDetail } from "../../../server/jobgate.service";

type ClaimResult = { txHash?: string; rewardType: string };

export function ClaimPanel({ gate, proveHref }: { gate: GateDetail; proveHref: string }) {
  const params = new URL(window.location.href).searchParams;
  const txHash = params.get("txHash");
  const nullifierHex = params.get("nullifier");
  const boundAddress = params.get("address");
  const hasVerification = Boolean(txHash && nullifierHex && boundAddress);

  const [status, setStatus] = useState<"idle" | "claiming" | "done" | "error">("idle");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setStatus("claiming");
    setError(null);
    const res = await fetch(`/api/jobboard/gates/${gate.slug}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nullifierHex, boundAddress, txHash }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus("error");
      setError(json?.error?.message ?? "Claim could not be completed.");
      return;
    }
    setResult(json as ClaimResult);
    setStatus("done");
  }

  if (!hasVerification) {
    return (
      <a
        href={proveHref}
        className="foil-stamp inline-flex items-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform"
      >
        Prove with Zelyo
      </a>
    );
  }

  if (status === "done" && result) {
    return (
      <div className="border border-outline-variant bg-surface-container-lowest rounded-lg p-stack-md">
        <p className="font-label text-label-md uppercase text-primary">Reward Unlocked</p>
        <p className="font-body text-body-md text-on-surface-variant mt-stack-sm">
          Your selective-disclosure proof unlocked this gate ({result.rewardType}).
        </p>
        <p className="font-mono text-caption text-on-surface-variant mt-stack-sm break-all">
          {result.txHash}
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={claim}
        disabled={status === "claiming"}
        className="foil-stamp inline-flex items-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform disabled:opacity-60"
      >
        {status === "claiming" ? "Claiming…" : "Claim Your Reward"}
      </button>
      {error ? (
        <p className="font-body text-body-md text-error mt-stack-sm">{error}</p>
      ) : null}
    </div>
  );
}
