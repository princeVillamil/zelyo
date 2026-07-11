"use client";

import type { PasskeyKit } from "passkey-kit";

const STORAGE_KEY = "zelyo:passkey-wallet";

export interface PasskeyWallet {
  keyIdBase64: string;
  contractId: string; // C... address
}

export interface PasskeyConfigStatus {
  configured: boolean;
  enabled: boolean;
  missing: string[];
}

/** Return a detailed breakdown of which passkey-kit env vars are present/missing.
 *  NOTE: Next.js only inlines NEXT_PUBLIC_* values when accessed by literal name,
 *  so each check must use a direct `process.env.X` lookup. */
export function getPasskeyConfigStatus(): PasskeyConfigStatus {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_PASSKEY_KIT_RPC_URL) missing.push("NEXT_PUBLIC_PASSKEY_KIT_RPC_URL");
  if (!process.env.NEXT_PUBLIC_PASSKEY_KIT_NETWORK_PASSPHRASE) missing.push("NEXT_PUBLIC_PASSKEY_KIT_NETWORK_PASSPHRASE");
  if (!process.env.NEXT_PUBLIC_PASSKEY_KIT_WALLET_WASM_HASH) missing.push("NEXT_PUBLIC_PASSKEY_KIT_WALLET_WASM_HASH");
  if (!process.env.NEXT_PUBLIC_SEP45_ENABLED) missing.push("NEXT_PUBLIC_SEP45_ENABLED");

  const enabled = process.env.NEXT_PUBLIC_SEP45_ENABLED === "true";
  return {
    configured: enabled && missing.length === 0,
    enabled,
    missing,
  };
}

/** True when passkey-kit config is present and SEP-45 feature flag is enabled. */
export function isPasskitConfigured(): boolean {
  return getPasskeyConfigStatus().configured;
}

/** True when the browser supports WebAuthn. */
export function isPasskeySupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator?.credentials !== "undefined"
  );
}

/** Lazily create a PasskeyKit instance from public env vars. */
async function getKit(): Promise<PasskeyKit> {
  const rpcUrl = process.env.NEXT_PUBLIC_PASSKEY_KIT_RPC_URL;
  const networkPassphrase = process.env.NEXT_PUBLIC_PASSKEY_KIT_NETWORK_PASSPHRASE;
  const walletWasmHash = process.env.NEXT_PUBLIC_PASSKEY_KIT_WALLET_WASM_HASH;

  if (!rpcUrl || !networkPassphrase || !walletWasmHash) {
    throw new Error("Passkey-kit is not configured.");
  }

  const { PasskeyKit } = await import("passkey-kit");
  return new PasskeyKit({
    rpcUrl,
    networkPassphrase,
    walletWasmHash,
  });
}

/** Load the stored passkey wallet from localStorage. */
export function loadStoredPasskeyWallet(): PasskeyWallet | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PasskeyWallet;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/** Persist a passkey wallet to localStorage. */
function storePasskeyWallet(wallet: PasskeyWallet): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
}

/** Clear the stored passkey wallet. */
export function clearStoredPasskeyWallet(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Register a new WebAuthn passkey and deploy a Soroban smart wallet.
 * Returns the smart-wallet contract address (C...).
 */
export async function registerPasskeyWallet(appName: string, userIdentifier: string): Promise<PasskeyWallet> {
  if (!isPasskeySupported()) {
    throw new Error("Passkeys are not supported in this browser.");
  }

  const kit = await getKit();
  const { keyIdBase64, contractId } = await kit.createWallet(appName, userIdentifier);

  const wallet: PasskeyWallet = { keyIdBase64, contractId };
  storePasskeyWallet(wallet);
  return wallet;
}

/**
 * Connect to an existing passkey wallet. Prompts WebAuthn if no wallet is stored.
 */
export async function connectPasskeyWallet(): Promise<PasskeyWallet> {
  const stored = loadStoredPasskeyWallet();
  if (stored) return stored;

  if (!isPasskeySupported()) {
    throw new Error("Passkeys are not supported in this browser.");
  }

  const kit = await getKit();
  const { keyIdBase64, contractId } = await kit.connectWallet();

  const wallet: PasskeyWallet = { keyIdBase64, contractId };
  storePasskeyWallet(wallet);
  return wallet;
}

/**
 * Sign a Soroban transaction envelope (base64 XDR) with the stored passkey.
 * Returns the signed envelope as base64 XDR.
 */
export async function signWithPasskey(txXdr: string): Promise<string> {
  const stored = loadStoredPasskeyWallet();
  if (!stored) {
    throw new Error("No passkey wallet connected.");
  }

  const kit = await getKit();
  const signed = await kit.sign(txXdr, { keyId: stored.keyIdBase64 });
  return (signed as unknown as { toEnvelope: () => { toXDR: (fmt: string) => string } }).toEnvelope().toXDR("base64");
}
