"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  requestAccess,
  getAddress,
  signTransaction,
  getNetwork,
} from "@stellar/freighter-api";
import {
  isPasskeySupported,
  isPasskitConfigured,
  getPasskeyConfigStatus,
  registerPasskeyWallet,
  connectPasskeyWallet,
  clearStoredPasskeyWallet,
  loadStoredPasskeyWallet,
  type PasskeyWallet,
} from "@/lib/passkey.client";

interface LinkedWallet {
  id: string;
  type: "STELLAR_ACCOUNT" | "PASSKEY_SMART_WALLET";
  address: string;
  credentialId?: string | null;
  isDefault: boolean;
}

export function WalletLinker() {
  const [mounted, setMounted] = useState(false);
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [passkeyWallet, setPasskeyWallet] = useState<PasskeyWallet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    void fetchWallets();
    setPasskeyWallet(loadStoredPasskeyWallet());
    // fetchWallets is wrapped in useCallback and stable; intentionally omit to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWallets = useCallback(async () => {
    try {
      const res = await fetch("/api/holder/wallet");
      if (!res.ok) throw new Error("Could not load wallets");
      const data = (await res.json()) as { wallets: LinkedWallet[] };
      setWallets(data.wallets);
    } catch (err) {
      // Fail silently on initial load; the user will see an empty list.
      setError(err instanceof Error ? err.message : "Could not load wallets");
    }
  }, []);

  async function linkSep10Wallet() {
    setError(null);
    setBusy(true);
    try {
      // 1. Ensure Freighter is installed and connected.
      const connected = await isConnected();
      if (!connected.isConnected) {
        throw new Error(
          "Freighter extension not found. Please install Freighter and refresh the page.",
        );
      }

      // 2. Check Freighter network matches the app.
      const networkRes = await getNetwork();
      if (networkRes.error) {
        throw new Error(networkRes.error.message ?? "Could not read Freighter network.");
      }
      const expectedPassphrase = process.env.NEXT_PUBLIC_PASSKEY_KIT_NETWORK_PASSPHRASE ?? "";
      if (networkRes.networkPassphrase !== expectedPassphrase) {
        throw new Error(
          `Freighter is on "${networkRes.network}", but Zelyo expects "${expectedPassphrase}". Please switch networks in Freighter.`,
        );
      }

      // 3. Request access if not already allowed.
      const access = await requestAccess();
      if (access.error || !access.address) {
        throw new Error(access.error?.message ?? "Freighter access was denied.");
      }

      // 4. Get the selected address.
      const addressRes = await getAddress();
      if (addressRes.error || !addressRes.address) {
        throw new Error(addressRes.error?.message ?? "Could not get Freighter address.");
      }
      const account = addressRes.address;

      if (!account.startsWith("G")) {
        throw new Error("Freighter returned an invalid Stellar account.");
      }

      // 5. Fetch SEP-10 challenge.
      const challengeRes = await fetch(`/api/sep10/challenge?account=${encodeURIComponent(account)}`);
      if (!challengeRes.ok) throw new Error("Could not fetch SEP-10 challenge.");
      const { transaction: challengeXdr } = (await challengeRes.json()) as { transaction: string };

      // 6. Sign with Freighter.
      const signed = await signTransaction(challengeXdr, {
        networkPassphrase: expectedPassphrase,
      });
      if (signed.error || !signed.signedTxXdr) {
        throw new Error(signed.error?.message ?? "Freighter failed to sign the challenge.");
      }

      // 7. Exchange signed challenge for a token and link wallet.
      const tokenRes = await fetch("/api/sep10/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transaction: signed.signedTxXdr }),
      });
      if (!tokenRes.ok) {
        const errBody = (await tokenRes.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(errBody?.error?.message ?? "SEP-10 verification failed.");
      }

      await fetchWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link wallet");
    } finally {
      setBusy(false);
    }
  }

  async function createPasskeyWallet() {
    setError(null);
    setBusy(true);
    try {
      const wallet = await registerPasskeyWallet("Zelyo", "holder");
      setPasskeyWallet(wallet);
      await saveWalletToServer("PASSKEY_SMART_WALLET", wallet.contractId, wallet.keyIdBase64);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create passkey wallet");
    } finally {
      setBusy(false);
    }
  }

  async function saveWalletToServer(
    type: "STELLAR_ACCOUNT" | "PASSKEY_SMART_WALLET",
    address: string,
    credentialId?: string,
  ) {
    const res = await fetch("/api/holder/wallet", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, address, credentialId, makeDefault: true }),
    });
    if (!res.ok) throw new Error("Could not save wallet on server.");
    await fetchWallets();
  }

  async function disconnectPasskey() {
    clearStoredPasskeyWallet();
    setPasskeyWallet(null);
    await fetchWallets();
  }

  async function removeWallet(id: string) {
    const res = await fetch(`/api/holder/wallet?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError("Could not remove wallet.");
      return;
    }
    await fetchWallets();
  }

  if (!mounted) {
    return (
      <div className="animate-pulse space-y-stack-sm">
        <div className="h-4 w-32 bg-outline-variant/40 rounded" />
        <div className="h-10 w-full bg-outline-variant/20 rounded" />
      </div>
    );
  }

  const passkeyConfigured = isPasskitConfigured();
  const passkeySupported = isPasskeySupported();
  const passkeyStatus = getPasskeyConfigStatus();

  return (
    <section className="space-y-stack-md">
      <h2 className="font-label text-label-md uppercase text-secondary">Linked Wallets</h2>

      {error && (
        <p
          role="alert"
          className="border-l-4 border-error bg-error-container/40 px-stack-md py-stack-sm font-body text-body-md text-on-error-container"
        >
          {error}
        </p>
      )}

      {!passkeyStatus.enabled && (
        <p className="font-body text-body-sm text-on-surface-variant">
          Passkey wallets are disabled. Set{" "}
          <code className="font-mono text-caption">NEXT_PUBLIC_SEP45_ENABLED=true</code> and restart the dev
          server to enable them.
        </p>
      )}

      {passkeyStatus.enabled && !passkeyConfigured && (
        <div className="rounded border border-outline-variant bg-surface-container-lowest p-stack-md">
          <p className="font-body text-body-md text-on-surface-variant">
            Passkey wallets are enabled but configuration is incomplete. Missing environment variables:
          </p>
          <ul className="mt-stack-sm list-disc list-inside font-mono text-caption text-error">
            {passkeyStatus.missing.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-stack-sm">
        <button
          type="button"
          disabled={busy}
          onClick={linkSep10Wallet}
          className="foil-stamp inline-flex items-center justify-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform disabled:opacity-60 disabled:pointer-events-none"
        >
          Connect Stellar Wallet
        </button>

        {passkeyConfigured && passkeySupported ? (
          <button
            type="button"
            disabled={busy}
            onClick={createPasskeyWallet}
            className="inline-flex items-center justify-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-surface bg-surface-container-high hover:bg-surface-container-highest border border-outline transition-transform hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none"
          >
            Create Passkey Wallet
          </button>
        ) : passkeyConfigured && !passkeySupported ? (
          <p className="font-body text-body-sm text-on-surface-variant">
            Passkeys require a browser with WebAuthn support.
          </p>
        ) : null}
      </div>

      {passkeyWallet && !wallets.some((w) => w.address === passkeyWallet.contractId) && (
        <div className="rounded border border-outline-variant bg-surface-container-lowest p-stack-md">
          <p className="font-label text-caption uppercase text-secondary">Passkey Wallet (local)</p>
          <p className="font-mono text-caption text-primary break-all">{passkeyWallet.contractId}</p>
          <div className="flex gap-stack-sm mt-stack-sm">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                saveWalletToServer(
                  "PASSKEY_SMART_WALLET",
                  passkeyWallet.contractId,
                  passkeyWallet.keyIdBase64,
                )
              }
              className="text-primary hover:underline font-body text-body-sm"
            >
              Save to account
            </button>
            <button
              type="button"
              onClick={disconnectPasskey}
              className="text-error hover:underline font-body text-body-sm"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {wallets.length > 0 ? (
        <ul className="space-y-stack-sm">
          {wallets.map((wallet) => (
            <li
              key={wallet.id}
              className="flex items-center justify-between rounded border border-outline-variant bg-surface-container-lowest p-stack-md"
            >
              <div className="min-w-0">
                <p className="font-label text-caption uppercase text-secondary">
                  {wallet.type === "STELLAR_ACCOUNT" ? "Stellar Account" : "Passkey Smart Wallet"}
                  {wallet.isDefault && (
                    <span className="ml-stack-sm text-primary">· Default</span>
                  )}
                </p>
                <p className="font-mono text-caption text-primary break-all">{wallet.address}</p>
              </div>
              <button
                type="button"
                onClick={() => removeWallet(wallet.id)}
                className="text-error hover:underline font-body text-body-sm shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-body-sm text-on-surface-variant">
          No wallets linked yet. Connect a Stellar account or create a passkey wallet to use it for
          verifications.
        </p>
      )}
    </section>
  );
}
