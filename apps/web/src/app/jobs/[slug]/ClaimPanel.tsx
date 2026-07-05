"use client";

import { useState } from "react";
import { FoilStampButton } from "@/components/FoilStampButton";
import type { GateDetail } from "../../../server/jobgate.service";

type ClaimResult = { txHash?: string; explorerUrl?: string; rewardType: string };

type Props = {
  gate: GateDetail;
  proveHref: string;
  initialTxHash: string | null;
  initialNullifierHex: string | null;
  initialBoundAddress: string | null;
  isExpired?: boolean;
};

export function ClaimPanel({
  gate,
  proveHref,
  initialTxHash,
  initialNullifierHex,
  initialBoundAddress,
  isExpired = false,
}: Props) {
  const [txHash, setTxHash] = useState<string | null>(initialTxHash);
  const [nullifierHex, setNullifierHex] = useState<string | null>(initialNullifierHex);
  const [boundAddress, setBoundAddress] = useState<string | null>(initialBoundAddress);
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

  if (isExpired) {
    return (
      <div className="border border-outline-variant bg-surface-container-lowest rounded-lg p-stack-md">
        <p className="font-label text-label-md uppercase text-error">Gate Expired</p>
        <p className="font-body text-body-md text-on-surface-variant mt-stack-sm">
          This gate is no longer accepting claims.
        </p>
      </div>
    );
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
        {result.txHash && (
          <>
            <p className="font-mono text-caption text-on-surface-variant mt-stack-sm break-all">
              {result.txHash}
            </p>
            {result.explorerUrl && (
              <a
                href={result.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-stack-sm inline-block font-label text-label-md uppercase text-primary underline"
              >
                View on explorer
              </a>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <FoilStampButton
        type="button"
        onClick={claim}
        disabled={status === "claiming"}
      >
        {status === "claiming" ? "Claiming…" : "Claim Your Reward"}
      </FoilStampButton>
      {error ? (
        <p
          role="alert"
          className="mt-stack-sm border-l-4 border-error bg-error-container/40 px-stack-md py-stack-sm font-body text-body-md text-on-error-container"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
