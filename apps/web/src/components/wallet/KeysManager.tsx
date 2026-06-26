"use client";

import { useState } from "react";
import type { FieldHex } from "@zelyo/zk-shared";
import {
  generateHolderSecret,
  persistHolderSecret,
  exportBackup,
  restoreBackup,
  deriveIdCommitment,
} from "@/lib/holder-key.client";

export function KeysManager() {
  const [passphrase, setPassphrase] = useState("");
  const [blob, setBlob] = useState("");
  const [commitment, setCommitment] = useState<FieldHex | null>(null);
  const [backup, setBackup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function publishCommitment(c: FieldHex, force = false): Promise<Response> {
    // Only the public commitment is ever sent to the server; never `s`.
    return fetch("/api/holder/commitment", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(force ? { idCommitment: c, force: true } : { idCommitment: c }),
    });
  }

  // Publishes the commitment. On 409 (the change would orphan provable credentials)
  // it asks for confirmation and retries with force. Returns false if the user
  // cancelled, true on success; throws on any other failure.
  async function publishWithGuard(c: FieldHex): Promise<boolean> {
    let res = await publishCommitment(c);
    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      const ok = window.confirm(
        `${body?.error?.message ?? "Your existing credentials will be orphaned."}\n\nReplace your identity anyway? Previously minted credentials will no longer be provable. To keep them, cancel and restore the matching backup blob instead.`,
      );
      if (!ok) return false;
      res = await publishCommitment(c, true);
    }
    if (!res.ok) throw new Error(`commitment ${res.status}`);
    return true;
  }

  async function onGenerate() {
    setError(null);
    setBusy(true);
    try {
      const s = await generateHolderSecret();
      const c = deriveIdCommitment(s);

      // Publish first (don't touch the local secret yet) so the server guard can
      // reject before we overwrite the existing identity in this browser.
      if (!(await publishWithGuard(c))) return;

      await persistHolderSecret(s, passphrase);
      setBackup(await exportBackup(s, passphrase));
      setCommitment(c);
    } catch {
      setError("Could not generate the identity. Choose a passphrase and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    setError(null);
    setBusy(true);
    try {
      const s = await restoreBackup(blob, passphrase);
      const c = deriveIdCommitment(s);

      // Publish first: restoring the key the credentials were minted under re-homes
      // them and is accepted; restoring a different key that would orphan provable
      // credentials hits the same 409 confirm path as Generate.
      if (!(await publishWithGuard(c))) return;

      await persistHolderSecret(s, passphrase);
      setCommitment(c);
    } catch {
      setError("Restore failed: check the backup blob and passphrase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-stack-lg">
      <div>
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
        <p className="mt-stack-sm font-body text-caption italic text-on-surface-variant">
          Your secret is sealed locally with this passphrase. It is never sent to Zelyo.
        </p>
      </div>

      {commitment && (
        <p className="font-body text-body-md">
          Public identity commitment:{" "}
          <span className="typewriter break-all text-primary">{commitment}</span>
        </p>
      )}

      {backup && (
        <div>
          <p className="font-label text-label-md uppercase text-secondary">Backup Blob</p>
          <textarea
            readOnly
            aria-label="Backup blob output"
            className="mt-unit w-full border border-outline-variant rounded bg-surface-container-high p-stack-sm typewriter text-caption"
            rows={4}
            value={backup}
          />
        </div>
      )}

      {error && <p role="alert" className="font-body text-body-md text-error">{error}</p>}

      <div className="flex flex-wrap gap-gutter">
        <button
          type="button"
          disabled={busy || !passphrase}
          onClick={onGenerate}
          className="border border-outline rounded font-label text-label-md uppercase text-primary px-stack-md py-stack-sm hover:bg-secondary-container"
        >
          Generate Identity
        </button>
      </div>

      <div>
        <label className="font-label text-label-md uppercase text-secondary" htmlFor="kblob">
          Restore from Backup Blob
        </label>
        <textarea
          id="kblob"
          aria-label="Backup blob"
          className="mt-unit w-full border border-outline-variant rounded bg-transparent p-stack-sm typewriter text-caption"
          rows={4}
          value={blob}
          onChange={(e) => setBlob(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !passphrase || !blob}
          onClick={onRestore}
          className="mt-stack-sm border border-outline rounded font-label text-label-md uppercase text-primary px-stack-md py-stack-sm hover:bg-secondary-container"
        >
          Restore
        </button>
        {!busy && (!passphrase || !blob) && (
          <p className="mt-stack-sm font-body text-caption italic text-on-surface-variant">
            {!passphrase && !blob
              ? "Enter the vault passphrase and paste your backup blob to restore."
              : !passphrase
                ? "Enter the vault passphrase that sealed this backup to restore."
                : "Paste your backup blob above to restore."}
          </p>
        )}
      </div>
    </div>
  );
}
