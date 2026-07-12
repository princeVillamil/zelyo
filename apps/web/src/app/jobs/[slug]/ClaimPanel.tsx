"use client";

import { useState } from "react";
import { FoilStampButton } from "@/components/FoilStampButton";
import type { GateDetail } from "../../../server/jobgate.service";

type ClaimResult = { txHash?: string; explorerUrl?: string; rewardType: string };
type ClaimError = { code: string; message: string; details?: Record<string, string> };
type AssetChoice = { code: string; issuer: string };

type Props = {
  gate: GateDetail;
  proveHref: string;
  initialTxHash: string | null;
  initialNullifierHex: string | null;
  initialBoundAddress: string | null;
  isExpired?: boolean;
  receiveChoices?: AssetChoice[];
};

export function ClaimPanel({
  gate,
  proveHref,
  initialTxHash,
  initialNullifierHex,
  initialBoundAddress,
  isExpired = false,
  receiveChoices = [],
}: Props) {
  const [txHash, setTxHash] = useState<string | null>(initialTxHash);
  const [nullifierHex, setNullifierHex] = useState<string | null>(initialNullifierHex);
  const [boundAddress, setBoundAddress] = useState<string | null>(initialBoundAddress);
  const hasVerification = Boolean(txHash && nullifierHex && boundAddress);

  const [status, setStatus] = useState<"idle" | "claiming" | "done" | "error" | "rejected">("idle");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<ClaimError | null>(null);
  const [receiveAsset, setReceiveAsset] = useState<AssetChoice | null>(null);

  async function claim() {
    setStatus("claiming");
    setError(null);
    const res = await fetch(`/api/jobboard/gates/${gate.slug}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nullifierHex,
        boundAddress,
        txHash,
        ...(receiveAsset ? { receiveAsset } : {}),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      const claimError: ClaimError = {
        code: json?.error?.code ?? "ERROR",
        message: json?.error?.message ?? "Claim could not be completed.",
        details: json?.error?.details,
      };
      setError(claimError);
      setStatus(claimError.code === "ALREADY_CLAIMED" ? "rejected" : "error");
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

  if (status === "rejected" && error) {
    return (
      <div
        role="alert"
        className="border border-error-container bg-error-container/40 rounded-lg p-stack-md"
      >
        <p className="font-label text-label-md uppercase text-error">
          Claim Rejected — Already Claimed
        </p>
        <p className="font-body text-body-md text-on-error-container mt-stack-sm">
          {error.message}
        </p>
        <p className="font-body text-caption text-on-error-container mt-stack-sm">
          The nullifier registry enforces one proof, one reward — this second claim never
          reached the reward step.
        </p>
        {error.details?.explorerUrl && (
          <a
            href={error.details.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-stack-sm inline-block font-label text-label-md uppercase text-error underline"
          >
            View the original reward on the explorer
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      {receiveChoices.length > 0 && (
        <fieldset className="mb-stack-md border border-outline-variant rounded-lg p-stack-md">
          <legend className="font-label text-caption uppercase text-secondary px-1">
            Receive reward as
          </legend>
          <div className="mt-stack-sm flex flex-wrap gap-stack-md">
            <label className="flex items-center gap-1 font-body text-body-md text-on-background">
              <input
                type="radio"
                name="receiveAsset"
                checked={receiveAsset === null}
                onChange={() => setReceiveAsset(null)}
                disabled={status === "claiming"}
              />
              XLM (direct)
            </label>
            {receiveChoices.map((choice) => (
              <label
                key={choice.code}
                className="flex items-center gap-1 font-body text-body-md text-on-background"
              >
                <input
                  type="radio"
                  name="receiveAsset"
                  checked={receiveAsset?.code === choice.code}
                  onChange={() => setReceiveAsset(choice)}
                  disabled={status === "claiming"}
                />
                {choice.code} (via SDEX)
              </label>
            ))}
          </div>
          {receiveAsset && (
            <p className="mt-stack-sm font-body text-caption text-on-surface-variant">
              The issuer sends XLM; the Stellar DEX converts it to {receiveAsset.code} at the
              best available rate. Your wallet must trust {receiveAsset.code}.
            </p>
          )}
        </fieldset>
      )}
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
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
