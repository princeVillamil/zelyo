"use client";

import { PasskeyKit } from "passkey-kit";
import { env } from "./env";

const STORAGE_KEY = "zelyo:passkey";

export type PasskeyCredential = {
  keyIdBase64: string;
  contractId: string;
};

export class PasskeyError extends Error {
  constructor(
    public readonly code: "NOT_CONFIGURED" | "CREATION_FAILED" | "CONNECT_FAILED" | "NOT_SUPPORTED",
    message: string,
  ) {
    super(message);
    this.name = "PasskeyError";
  }
}

function isConfigured(): boolean {
  return Boolean(
    env.NEXT_PUBLIC_PASSKEY_KIT_RPC_URL &&
      env.NEXT_PUBLIC_PASSKEY_KIT_NETWORK_PASSPHRASE &&
      env.NEXT_PUBLIC_PASSKEY_KIT_WALLET_WASM_HASH,
  );
}

function getKit(): PasskeyKit {
  if (!isConfigured()) {
    throw new PasskeyError("NOT_CONFIGURED", "Passkey smart-wallet is not configured in this environment.");
  }
  return new PasskeyKit({
    rpcUrl: env.NEXT_PUBLIC_PASSKEY_KIT_RPC_URL!,
    networkPassphrase: env.NEXT_PUBLIC_PASSKEY_KIT_NETWORK_PASSPHRASE!,
    walletWasmHash: env.NEXT_PUBLIC_PASSKEY_KIT_WALLET_WASM_HASH!,
    timeoutInSeconds: 30,
  });
}

export function isPasskeySupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof PublicKeyCredential !== "undefined" && isConfigured();
}

export async function registerPasskey(appName: string, userIdentifier: string): Promise<PasskeyCredential> {
  if (!isPasskeySupported()) {
    throw new PasskeyError("NOT_SUPPORTED", "Passkeys are not supported in this browser or environment.");
  }
  const kit = getKit();
  try {
    const { keyIdBase64, contractId } = await kit.createWallet(appName, userIdentifier);
    const cred: PasskeyCredential = { keyIdBase64, contractId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cred));
    return cred;
  } catch (err) {
    throw new PasskeyError(
      "CREATION_FAILED",
      err instanceof Error ? err.message : "Passkey registration failed.",
    );
  }
}

export async function connectPasskey(): Promise<PasskeyCredential> {
  if (!isPasskeySupported()) {
    throw new PasskeyError("NOT_SUPPORTED", "Passkeys are not supported in this browser or environment.");
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as PasskeyCredential;
    } catch {
      /* ignore corrupt storage */
    }
  }

  const kit = getKit();
  try {
    const connected = await kit.connectWallet({ prompt: true } as never);
    if (!connected) {
      throw new PasskeyError("CONNECT_FAILED", "No passkey selected.");
    }
    const cred: PasskeyCredential = {
      keyIdBase64: connected.keyIdBase64,
      contractId: connected.contractId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cred));
    return cred;
  } catch (err) {
    throw new PasskeyError(
      "CONNECT_FAILED",
      err instanceof Error ? err.message : "Passkey connection failed.",
    );
  }
}

export function getStoredPasskey(): PasskeyCredential | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PasskeyCredential;
  } catch {
    return null;
  }
}

export function clearStoredPasskey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Sign a Stellar transaction with the stored passkey.
 * The returned transaction is ready for submission (via Horizon/RPC or Launchtube).
 */
export async function signWithPasskey(txn: unknown): Promise<unknown> {
  const cred = getStoredPasskey();
  if (!cred) {
    throw new PasskeyError("CONNECT_FAILED", "No passkey wallet found. Register or connect first.");
  }
  const kit = getKit();
  return kit.sign(txn as never, { keyId: cred.keyIdBase64 });
}
