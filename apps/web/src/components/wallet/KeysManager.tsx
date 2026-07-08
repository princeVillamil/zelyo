"use client";

import { useState, useEffect } from "react";
import type { FieldHex } from "@zelyo/zk-shared";
import {
  generateHolderSecret,
  persistHolderSecret,
  exportBackup,
  restoreBackup,
  deriveIdCommitment,
} from "@/lib/holder-key.client";
import { RuleOrnament } from "@/components/RuleOrnament";

export function KeysManager({
  initialCommitment = null,
}: {
  initialCommitment?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [restoreInput, setRestoreInput] = useState("");
  const [commitment, setCommitment] = useState<FieldHex | null>(
    initialCommitment as FieldHex | null
  );
  const [backup, setBackup] = useState<string | null>(null);
  const [mode, setMode] = useState<"generate" | "restore">("generate");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // States to handle conflict/orphaned credentials UI
  const [conflictCommitment, setConflictCommitment] = useState<FieldHex | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [pendingSecret, setPendingSecret] = useState<FieldHex | null>(null);
  const [pendingAction, setPendingAction] = useState<"generate" | "restore" | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid gap-gutter md:grid-cols-[1fr_auto] w-full animate-pulse">
        {/* Left Column: Inputs Skeleton */}
        <div className="space-y-stack-lg">
          <div className="space-y-stack-sm">
            <div className="h-4 w-32 bg-outline-variant/40 rounded" />
            <div className="h-10 w-full bg-outline-variant/20 border-b border-outline-variant/40" />
            <div className="h-4 w-72 bg-outline-variant/30 rounded mt-2" />
          </div>
          <div>
            <div className="h-12 w-48 bg-outline-variant/30 rounded" />
          </div>
        </div>

        {/* Right Column: Card Skeleton */}
        <article className="manuscript-glow relative rounded-lg border border-outline-variant bg-surface-container-lowest p-stack-lg text-on-background min-h-[350px] flex flex-col justify-between h-full min-w-0 w-full">
          <div>
            <div className="h-5 w-40 bg-outline-variant/40 rounded mb-4" />
            <div className="h-px bg-outline-variant/30 w-full mb-6" />

            <div className="space-y-stack-md">
              <div>
                <div className="h-4 w-44 bg-outline-variant/30 rounded mb-2" />
                <div className="h-10 w-full bg-surface-container-low border border-dashed border-outline-variant/40 rounded" />
              </div>

              <div>
                <div className="h-4 w-24 bg-outline-variant/30 rounded mb-2" />
                <div className="h-[120px] w-full bg-surface-container-low border border-dashed border-outline-variant/40 rounded animate-pulse" />
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <div className="border-t border-outline-variant my-stack-sm" />
            <div className="flex justify-between items-center">
              <div className="h-4 w-12 bg-outline-variant/30 rounded" />
              <div className="h-4 w-28 bg-outline-variant/30 rounded" />
            </div>
          </div>
        </article>
      </div>
    );
  }

  const handleRestoreInputChange = (val: string) => {
    setRestoreInput(val);
    if (val.trim()) {
      setMode("restore");
    } else {
      setMode("generate");
    }
  };

  async function publishCommitment(c: FieldHex, force = false): Promise<Response> {
    // Only the public commitment is ever sent to the server; never `s`.
    return fetch("/api/holder/commitment", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(force ? { idCommitment: c, force: true } : { idCommitment: c }),
    });
  }

  async function onGenerate() {
    setError(null);
    setConflictMessage(null);
    setConflictCommitment(null);
    setPendingSecret(null);
    setPendingAction(null);
    setBusy(true);
    try {
      const s = await generateHolderSecret();
      const c = deriveIdCommitment(s);

      // Check for conflict first
      const res = await publishCommitment(c);
      if (res.status === 409) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setConflictCommitment(c);
        setConflictMessage(body?.error?.message ?? "Your existing credentials will be orphaned.");
        setPendingSecret(s);
        setPendingAction("generate");
        return;
      }
      if (!res.ok) throw new Error(`commitment ${res.status}`);

      // No conflict, persist immediately
      await persistHolderSecret(s, passphrase);
      const backupStr = await exportBackup(s, passphrase);
      setBackup(backupStr);
      setRestoreInput("");
      setCommitment(c);
      setMode("generate");
    } catch {
      setError("Could not generate the identity. Choose a passphrase and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    setError(null);
    setConflictMessage(null);
    setConflictCommitment(null);
    setPendingSecret(null);
    setPendingAction(null);
    setBusy(true);
    try {
      const s = await restoreBackup(restoreInput, passphrase);
      const c = deriveIdCommitment(s);

      // Check for conflict first
      const res = await publishCommitment(c);
      if (res.status === 409) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setConflictCommitment(c);
        setConflictMessage(body?.error?.message ?? "Your existing credentials will be orphaned.");
        setPendingSecret(s);
        setPendingAction("restore");
        return;
      }
      if (!res.ok) throw new Error(`commitment ${res.status}`);

      // No conflict, persist immediately
      await persistHolderSecret(s, passphrase);
      setCommitment(c);
      setBackup(restoreInput);
      setRestoreInput("");
      setMode("generate");
    } catch {
      setError("Restore failed: check the backup blob and passphrase.");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmReplace() {
    if (!conflictCommitment || !pendingSecret || !pendingAction) return;
    setError(null);
    setBusy(true);
    try {
      const res = await publishCommitment(conflictCommitment, true); // force = true
      if (!res.ok) throw new Error(`commitment ${res.status}`);

      await persistHolderSecret(pendingSecret, passphrase);
      if (pendingAction === "generate") {
        const backupStr = await exportBackup(pendingSecret, passphrase);
        setBackup(backupStr);
        setRestoreInput("");
      } else {
        setBackup(restoreInput);
        setRestoreInput("");
      }
      setCommitment(conflictCommitment);
      setMode("generate");

      // Clear conflict states
      setConflictCommitment(null);
      setConflictMessage(null);
      setPendingSecret(null);
      setPendingAction(null);
    } catch {
      setError(
        pendingAction === "generate"
          ? "Could not generate the identity. Choose a passphrase and try again."
          : "Restore failed: check the backup blob and passphrase."
      );
    } finally {
      setBusy(false);
    }
  }

  function onCancelReplace() {
    setConflictCommitment(null);
    setConflictMessage(null);
    setPendingSecret(null);
    setPendingAction(null);
  }

  return (
    <div className="grid gap-gutter md:grid-cols-[1fr_auto] w-full">
      {/* Left Column: Inputs & Actions */}
      <div className="space-y-stack-lg">
        {conflictMessage ? (
          <div
            role="alert"
            className="border-l-4 border-error bg-error-container/40 px-stack-md py-stack-sm space-y-stack-md"
          >
            <div className="space-y-stack-sm">
              <p className="font-body text-body-md text-on-error-container font-semibold">
                Changing your identity key will orphan your existing credentials; they would no longer be provable.
              </p>
              <p className="font-body text-body-sm text-on-error-container/80">
                {conflictMessage}
              </p>
              <p className="font-body text-body-sm text-on-error-container/80 italic">
                To keep them, click Cancel and restore the matching backup blob on the right instead.
              </p>
            </div>
            <div className="flex gap-stack-sm pt-2">
              <button
                type="button"
                onClick={onConfirmReplace}
                disabled={busy}
                className="bg-error text-on-error hover:bg-error/95 px-stack-md py-2 rounded font-label text-caption uppercase tracking-wider disabled:opacity-60 transition-colors"
              >
                Replace Anyway
              </button>
              <button
                type="button"
                onClick={onCancelReplace}
                disabled={busy}
                className="bg-transparent hover:bg-surface-variant/20 border border-outline px-stack-md py-2 rounded font-label text-caption uppercase tracking-wider text-on-surface disabled:opacity-60 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-stack-sm">
              <label className="font-label text-label-md uppercase text-secondary" htmlFor="kpass">
                Vault Passphrase
              </label>
              <input
                id="kpass"
                aria-label="Passphrase"
                type="password"
                className="mt-unit w-full border-b border-outline bg-transparent text-body-md focus:border-primary focus:outline-none"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
              <p className="font-body text-caption italic text-on-surface-variant">
                Your secret is sealed locally with this passphrase. It is never sent to Zelyo.
              </p>
            </div>

            <div>
              <button
                type="button"
                disabled={busy || !passphrase}
                onClick={mode === "restore" ? onRestore : onGenerate}
                className="foil-stamp inline-flex items-center justify-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform disabled:opacity-60 disabled:pointer-events-none"
              >
                <span className="relative z-10">{mode === "restore" ? "Restore" : "Generate Identity"}</span>
              </button>
            </div>
          </>
        )}

        {error && (
          <p
            role="alert"
            className="border-l-4 border-error bg-error-container/40 px-stack-md py-stack-sm font-body text-body-md text-on-error-container"
          >
            {error}
          </p>
        )}
      </div>

      {/* Right Column: Identity Details & Backup */}
      <article className="manuscript-glow relative rounded-lg border border-outline-variant bg-surface-container-lowest p-stack-lg text-on-background min-h-[350px] flex flex-col justify-between h-full min-w-0 w-full">
        <div className="min-w-0 w-full">
          <h2 className="font-label text-label-md uppercase text-secondary flex justify-between items-center">
            <span>Identity Attestation</span>
            <span className="material-symbols-outlined text-caption">fingerprint</span>
          </h2>
          <RuleOrnament className="my-stack-sm" />

          {commitment ? (
            <div className="space-y-stack-md min-w-0 w-full">
              <div className="min-w-0 w-full">
                <span className="font-label text-caption uppercase text-secondary block">
                  Public Identity Commitment
                </span>
                <div className="mt-unit min-h-10 border border-dashed border-outline-variant rounded bg-surface-container-low flex items-center px-stack-sm font-mono text-caption text-primary overflow-x-auto whitespace-nowrap py-2 w-full min-w-0" title={commitment}>
                  {commitment}
                </div>
              </div>

              <div>
                {backup ? (
                  <div className="space-y-stack-sm">
                    <div>
                      <span className="font-label text-caption uppercase text-secondary block">
                        Backup Blob (Generated)
                      </span>
                      <p className="mt-unit font-body text-caption italic text-on-surface-variant mb-unit">
                        Sealed backup generated. Copy and store this string securely.
                      </p>
                      <textarea
                        readOnly
                        aria-label="Backup blob output"
                        className="mt-unit w-full border border-dashed border-outline-variant rounded bg-surface-container-low p-stack-sm typewriter text-caption focus:outline-none"
                        rows={5}
                        value={backup}
                      />
                    </div>
                    <div className="border-t border-outline-variant/30 pt-stack-sm">
                      <label className="font-label text-caption uppercase text-secondary block" htmlFor="krestore">
                        Restore Another Backup Blob
                      </label>
                      <textarea
                        id="krestore"
                        aria-label="Backup blob input"
                        placeholder="Paste another backup blob here to restore."
                        className="mt-unit w-full border border-dashed border-outline-variant rounded bg-surface-container-low p-stack-sm typewriter text-caption focus:border-primary focus:outline-none placeholder:italic placeholder:text-secondary/50"
                        rows={4}
                        value={restoreInput}
                        onChange={(e) => handleRestoreInputChange(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="font-label text-caption uppercase text-secondary block" htmlFor="krestore">
                      Restore Backup Blob
                    </label>
                    <textarea
                      id="krestore"
                      aria-label="Backup blob input"
                      placeholder="Paste your backup blob here to restore."
                      className="mt-unit w-full border border-dashed border-outline-variant rounded bg-surface-container-low p-stack-sm typewriter text-caption focus:border-primary focus:outline-none placeholder:italic placeholder:text-secondary/50"
                      rows={5}
                      value={restoreInput}
                      onChange={(e) => handleRestoreInputChange(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-stack-md min-w-0 w-full">
              <div className="opacity-60 min-w-0 w-full">
                <span className="font-label text-caption uppercase text-secondary block">
                  Public Identity Commitment
                </span>
                <div className="mt-unit h-10 border border-dashed border-outline-variant rounded bg-surface-container-low flex items-center px-stack-sm font-mono text-caption text-secondary overflow-x-auto whitespace-nowrap w-full min-w-0">
                  0x0000000000000000000000000000000000000000000000000000000000000...
                </div>
              </div>

              <div>
                <label className="font-label text-caption uppercase text-secondary block" htmlFor="krestore">
                  Restore Backup Blob
                </label>
                <textarea
                  id="krestore"
                  aria-label="Backup blob input"
                  placeholder="Paste your backup blob here to restore."
                  className="mt-unit w-full border border-dashed border-outline-variant rounded bg-surface-container-low p-stack-sm typewriter text-caption focus:border-primary focus:outline-none placeholder:italic placeholder:text-secondary/50"
                  rows={5}
                  value={restoreInput}
                  onChange={(e) => handleRestoreInputChange(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto">
          <div className="border-t border-outline-variant my-stack-sm" />
          <div className="flex justify-between items-center text-caption font-body text-secondary">
            <span>Status</span>
            <span className="flex items-center gap-1.5 font-label text-caption uppercase">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${commitment ? "bg-primary" : "bg-outline-variant animate-pulse"}`} />
              {commitment ? "ACTIVE" : "AWAITING SETUP"}
            </span>
          </div>
        </div>
      </article>
    </div>
  );
}

