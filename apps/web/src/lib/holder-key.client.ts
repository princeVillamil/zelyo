"use client";

import { idCommitment, type FieldHex } from "@zelyo/zk-shared";

// BN254 scalar field modulus.
const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const DB_NAME = "zelyo";
const STORE = "keys";
const RECORD_ID = "holder";
const BACKUP_VERSION = 1;

export class HolderKeyError extends Error {
  constructor(public readonly code: "DECRYPT_FAILED" | "BAD_BACKUP") {
    super(code);
    this.name = "HolderKeyError";
  }
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v;
}
function fieldHex(v: bigint): FieldHex {
  return ("0x" + (v % FIELD_MODULUS).toString(16).padStart(64, "0")) as FieldHex;
}
function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function generateHolderSecret(): Promise<FieldHex> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return fieldHex(bytesToBigInt(raw));
}

export function deriveIdCommitment(s: FieldHex): FieldHex {
  return idCommitment(s);
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

interface Envelope {
  v: number;
  salt: string;
  iv: string;
  ct: string;
}

async function seal(s: FieldHex, passphrase: string): Promise<Envelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  // Store the field hex (without 0x) as bytes — never the raw decimal/string in clear.
  const plaintext = new TextEncoder().encode(s);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );
  return { v: BACKUP_VERSION, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

async function open(env: Envelope, passphrase: string): Promise<FieldHex> {
  const key = await deriveKey(passphrase, unb64(env.salt));
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(env.iv) },
      key,
      unb64(env.ct),
    );
  } catch {
    throw new HolderKeyError("DECRYPT_FAILED");
  }
  return new TextDecoder().decode(plain) as FieldHex;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      // Close eagerly if another connection requests a version change (e.g. a delete),
      // so deleteDatabase is never blocked by a lingering connection.
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}
function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = fn(store);
        // Close the connection once the transaction settles to avoid leaking
        // handles that would block a subsequent deleteDatabase.
        req.transaction!.oncomplete = () => db.close();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      }),
  );
}

export async function persistHolderSecret(s: FieldHex, passphrase: string): Promise<void> {
  const envelope = await seal(s, passphrase);
  await tx("readwrite", (store) => store.put(envelope, RECORD_ID));
}

export async function hasHolderSecret(): Promise<boolean> {
  const v = await tx<Envelope | undefined>("readonly", (store) => store.get(RECORD_ID));
  return v != null;
}

export async function loadHolderSecret(passphrase: string): Promise<FieldHex | null> {
  const env = await tx<Envelope | undefined>("readonly", (store) => store.get(RECORD_ID));
  if (!env) return null;
  return open(env, passphrase);
}

export async function exportBackup(s: FieldHex, passphrase: string): Promise<string> {
  const env = await seal(s, passphrase);
  return JSON.stringify({ kind: "zelyo-holder-backup", ...env });
}

export async function restoreBackup(blob: string, passphrase: string): Promise<FieldHex> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch {
    throw new HolderKeyError("BAD_BACKUP");
  }
  const e = parsed as Partial<Envelope> & { kind?: string };
  if (e.kind !== "zelyo-holder-backup" || !e.salt || !e.iv || !e.ct) {
    throw new HolderKeyError("BAD_BACKUP");
  }
  return open({ v: e.v ?? BACKUP_VERSION, salt: e.salt, iv: e.iv, ct: e.ct }, passphrase);
}
