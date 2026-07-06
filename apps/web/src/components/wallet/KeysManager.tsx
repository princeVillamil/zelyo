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
import {
  isPasskeySupported,
  registerPasskey,
  connectPasskey,
  getStoredPasskey,
  clearStoredPasskey,
  type PasskeyCredential,
} from "@/lib/passkey";

export function KeysManager() {
  const [passphrase, setPassphrase] = useState("");
  const [blob, setBlob] = useState("");
  const [commitment, setCommitment] = useState<FieldHex | null>(null);
  const [backup, setBackup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [passkey, setPasskey] = useState<PasskeyCredential | null>(() => getStoredPasskey());
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const passkeyReady = isPasskeySupported();

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

  async function onRegisterPasskey() {
    setPasskeyError(null);
    setPasskeyBusy(true);
    try {
      const userLabel = commitment ?? "zelyo-holder";
      const cred = await registerPasskey("Zelyo", userLabel);
      setPasskey(cred);
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : "Passkey registration failed.");
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function onConnectPasskey() {
    setPasskeyError(null);
    setPasskeyBusy(true);
    try {
      const cred = await connectPasskey();
      setPasskey(cred);
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : "Passkey connection failed.");
    } finally {
      setPasskeyBusy(false);
    }
  }

  function onDisconnectPasskey() {
    clearStoredPasskey();
    setPasskey(null);
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

      <hr className="border-outline-variant" />

      <div>
        <p className="font-label text-label-md uppercase text-secondary">Passkey Smart Wallet</p>
        <p className="mt-stack-sm font-body text-body-md text-on-surface-variant">
          Register a WebAuthn passkey to control a SEP-45 style smart wallet. This lets you claim
          rewards without holding XLM for transaction fees.
        </p>

        {passkey && (
          <div className="mt-stack-md space-y-stack-sm">
            <p className="font-body text-body-md">
              Smart wallet:{" "}
              <span className="typewriter break-all text-primary">{passkey.contractId}</span>
            </p>
            <button
              type="button"
              onClick={onDisconnectPasskey}
              className="border border-outline rounded font-label text-label-md uppercase text-error px-stack-md py-stack-sm hover:bg-error-container/20"
            >
              Disconnect Passkey
            </button>
          </div>
        )}

        {!passkey && (
          <div className="mt-stack-md flex flex-wrap gap-gutter">
            <button
              type="button"
              disabled={passkeyBusy || !passkeyReady}
              onClick={onRegisterPasskey}
              className="border border-outline rounded font-label text-label-md uppercase text-primary px-stack-md py-stack-sm hover:bg-secondary-container disabled:opacity-50"
            >
              {passkeyBusy ? "Registering…" : "Register Passkey"}
            </button>
            <button
              type="button"
              disabled={passkeyBusy || !passkeyReady}
              onClick={onConnectPasskey}
              className="border border-outline rounded font-label text-label-md uppercase text-primary px-stack-md py-stack-sm hover:bg-secondary-container disabled:opacity-50"
            >
              {passkeyBusy ? "Connecting…" : "Connect Passkey"}
            </button>
          </div>
        )}

        {!passkeyReady && (
          <p className="mt-stack-sm font-body text-caption italic text-on-surface-variant">
            Passkeys are not available. Make sure your browser supports WebAuthn and that
            NEXT_PUBLIC_PASSKEY_KIT_* environment variables are configured.
          </p>
        )}

        {passkeyError && (
          <p role="alert" className="mt-stack-sm font-body text-body-md text-error">
            {passkeyError}
          </p>
        )}
      </div>
    </div>
  );
}
