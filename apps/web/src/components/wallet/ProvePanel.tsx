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

const DISCLOSABLE: { key: keyof Attributes; label: string }[] = [
  { key: "track", label: "Track" },
  { key: "courseName", label: "Course Name" },
  { key: "issueDate", label: "Issue Date" },
  { key: "grade", label: "Grade" },
  { key: "learnerName", label: "Learner Name" },
];

const RESULT_COPY: Record<string, string> = {
  NULLIFIER_USED: "This credential has already been used to prove this fact. Each holder may register once.",
  INVALID_PROOF: "The proof could not be verified. Please regenerate it.",
  UNKNOWN_ROOT: "The issuing root is no longer recognised by the registry.",
  ERROR: "The verification could not be completed. Please try again.",
};

export function ProvePanel({ credential }: { credential: ProvePanelCredential }) {
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
        }),
      });
      const result = (await res.json()) as { ok: boolean; result: string; txHash?: string };

      if (result.ok && result.txHash) {
        log("SEALED ON-CHAIN", result.txHash.slice(0, 10));
        router.push(`/verify/result/${result.txHash}`);
      } else {
        log("REGISTRY REJECTED", result.result);
        setError((RESULT_COPY[result.result] ?? RESULT_COPY.ERROR) as string | null);
      }
    } catch (err) {
      if (err instanceof ProverError && err.code === "NOT_ISOLATED") {
        setError("Secure proving is unavailable: this page is not cross-origin isolated.");
      } else {
        setError("Proof generation failed. Please try again.");
      }
      log("ERROR", "FAILED");
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
