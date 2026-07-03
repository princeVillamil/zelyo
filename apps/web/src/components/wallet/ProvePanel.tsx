"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Attributes, FieldHex, ProofBundle } from "@zelyo/zk-shared";
import { loadHolderSecret } from "@/lib/holder-key.client";
import { proveCredential, ProverError } from "@/lib/prover.client";
import { FoilStampButton } from "@/components/FoilStampButton";
import { TypewriterLog, type LogLine } from "@/components/TypewriterLog";
import { LedgerPanel } from "@/components/LedgerPanel";

export interface ProvePanelCredential {
  id: string;
  attributes: Attributes;
  leafIndex: number;
  merklePath: { siblings: FieldHex[]; pathIndices: number[] };
  root: FieldHex;
}

// The current circuit only supports disclosing `track`. Keep the array single-item
// so the UI does not over-promise attributes that cannot be proven/claimed.
const DISCLOSABLE: { key: keyof Attributes; label: string }[] = [
  { key: "track", label: "Track" },
];

const RESULT_COPY: Record<string, string> = {
  NULLIFIER_USED: "This credential has already been used to prove this fact. Each holder may register once.",
  INVALID_PROOF: "The proof could not be verified. Please regenerate it.",
  UNKNOWN_ROOT: "The issuing root is no longer recognised by the registry.",
  ERROR: "The verification could not be completed. Please try again.",
};

export function ProvePanel({ credential, gate }: { credential: ProvePanelCredential; gate?: string | undefined }) {
  const router = useRouter();
  // Default: reveal only `track`; name/grade hidden.
  const [disclose, setDisclose] = useState<Partial<Record<keyof Attributes, boolean>>>({ track: true });
  const [address, setAddress] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [lines, setLines] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const log = (event: string, status = "OK") => {
    const time = new Date().toISOString().slice(11, 19);
    setLines((prev) => [...prev, { time, event, status }]);
  };

  const toggle = (key: keyof Attributes) =>
    setDisclose((prev) => ({ ...prev, [key]: !prev[key] }));

  async function onGenerate() {
    setError(null);
    setBusy(true);
    try {
      log("UNSEALING IDENTITY SECRET");
      const s = await loadHolderSecret(passphrase);
      if (!s) {
        setError("No holder secret found in this browser. Restore it on the Keys page first.");
        return;
      }
      log("WITNESS + PROOF (UltraHonk)", "RUNNING");
      const bundle: ProofBundle = await proveCredential({
        s,
        attributes: credential.attributes,
        disclose: { track: disclose.track === true },
        merklePath: credential.merklePath,
        root: credential.root,
        boundStellarAddress: address,
      });
      log("PROOF GENERATED");

      log("SUBMITTING TO REGISTRY");
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proof: Array.from(bundle.proof),
          publicInputs: bundle.publicInputs,
          boundStellarAddress: address,
          credentialId: credential.id,
        }),
      });
      const result = (await res.json()) as { ok: boolean; result: string; txHash?: string };

      if (result.ok && result.txHash) {
        log("SEALED ON-CHAIN", result.txHash.slice(0, 10));
        if (gate) {
          // Came from a gate — loop back with the proof identity so the holder can claim.
          const params = new URLSearchParams({
            txHash: result.txHash,
            nullifier: bundle.publicInputs.nullifier,
            address,
          });
          router.push(`/jobs/${gate}?${params.toString()}`);
        } else {
          router.push(`/verify/result/${result.txHash}`);
        }
      } else {
        log("REGISTRY REJECTED", result.result);
        setError((RESULT_COPY[result.result] ?? RESULT_COPY.ERROR) as string | null);
      }
    } catch (err) {
      if (err instanceof ProverError && err.code === "NOT_ISOLATED") {
        setError("Secure proving is unavailable: this page is not cross-origin isolated.");
      } else if (err instanceof ProverError && err.code === "LEAF_MISMATCH") {
        setError(
          "This credential was issued to a different identity key than the one in this browser. " +
            "It can't be proven — likely you regenerated your keys after it was issued. Restore the original key backup, or have it re-issued.",
        );
      } else {
        setError("Proof generation failed. Please try again.");
      }
      // Surface the precise failure on-page (ledger) so debugging doesn't depend
      // on the browser console: ProverError code, or the raw error message.
      const detail =
        err instanceof ProverError
          ? err.code
          : err instanceof Error
            ? `${err.name}: ${err.message}`.slice(0, 80)
            : "FAILED";
      log("ERROR", detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
      <section>
        <p className="font-label text-label-md uppercase text-secondary">Selective Disclosure</p>
        <p className="mt-stack-sm font-body text-body-md italic text-on-surface-variant">
          Select the attributes you wish to encode into the resulting proof. All other data remains
          strictly private.
        </p>
        <fieldset className="mt-stack-md space-y-stack-sm">
          {DISCLOSABLE.map(({ key, label }) => {
            const checked = disclose[key] === true;
            return (
              <label
                key={key}
                className={`flex items-center gap-stack-sm py-unit ${checked ? "font-semibold text-primary" : "text-on-surface-variant"}`}
              >
                <input
                  type="checkbox"
                  className="text-primary"
                  checked={checked}
                  onChange={() => toggle(key)}
                  aria-label={label}
                />
                {label}
              </label>
            );
          })}
        </fieldset>

        <div className="mt-stack-md">
          <label className="font-label text-label-md uppercase text-secondary" htmlFor="addr">
            Stellar Address
          </label>
          <input
            id="addr"
            aria-label="Stellar Address"
            className="mt-unit w-full border-b border-outline bg-transparent font-mono text-body-md focus:border-primary focus:outline-none"
            placeholder="G…"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="mt-stack-md">
          <label className="font-label text-label-md uppercase text-secondary" htmlFor="pass">
            Vault Passphrase
          </label>
          <input
            id="pass"
            aria-label="Passphrase"
            type="password"
            className="mt-unit w-full border-b border-outline bg-transparent text-body-md focus:border-primary focus:outline-none"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="mt-stack-md font-body text-body-md text-error">
            {error}
          </p>
        )}

        <FoilStampButton
          className="mt-stack-lg"
          disabled={busy || !address || !passphrase}
          onClick={onGenerate}
        >
          {busy ? "Sealing…" : "Generate ZK-Proof"}
        </FoilStampButton>
      </section>

      <LedgerPanel>
        <TypewriterLog lines={lines} />
      </LedgerPanel>
    </div>
  );
}
