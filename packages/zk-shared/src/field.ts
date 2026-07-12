import type { FieldHex } from "./types";

// BN254 (alt_bn128) scalar field modulus — the field Noir's poseidon2 operates over.
export const BN254_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function toFieldHex(value: bigint): FieldHex {
  if (value < 0n) throw new Error("field value must be non-negative");
  if (value >= BN254_MODULUS) throw new Error("field value must be < BN254 modulus");
  return ("0x" + value.toString(16).padStart(64, "0")) as FieldHex;
}

export function fieldHexToBigInt(h: FieldHex): bigint {
  if (!/^0x[0-9a-f]{1,64}$/.test(h)) throw new Error(`invalid FieldHex: ${h}`);
  const v = BigInt(h);
  if (v >= BN254_MODULUS) throw new Error("FieldHex out of field range");
  return v;
}

// Stellar StrKey -> a single BN254 field. Supports both public-key accounts
// (G...: version byte 0x30 + 32-byte ed25519 pubkey + CRC16) and Soroban
// contract IDs (C...: version byte 0x10 + 32-byte contract hash + CRC16).
// The Noir side receives the identical bigint as bound_address.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(s: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`invalid base32 char: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

function decodeStrKey(raw: string): { version: number; payload: Uint8Array } {
  const decoded = base32Decode(raw);
  if (decoded.length !== 35) {
    throw new Error(`expected a 35-byte StrKey payload, got ${decoded.length}`);
  }
  return { version: decoded[0]!, payload: decoded.slice(1, 33) };
}

export function encodeAddressToField(stellarAddress: string): FieldHex {
  if (/^G[A-Z2-7]{55}$/.test(stellarAddress)) {
    const { payload } = decodeStrKey(stellarAddress);
    let acc = 0n;
    for (const byte of payload) acc = (acc << 8n) | BigInt(byte);
    return toFieldHex(acc % BN254_MODULUS);
  }

  if (/^C[A-Z2-7]{55}$/.test(stellarAddress)) {
    const { version, payload } = decodeStrKey(stellarAddress);
    if (version !== 0x10) {
      throw new Error("expected a Soroban contract StrKey (C... version byte 0x10)");
    }
    let acc = 0n;
    for (const byte of payload) acc = (acc << 8n) | BigInt(byte);
    return toFieldHex(acc % BN254_MODULUS);
  }

  throw new Error("expected a Stellar public key (G... StrKey) or contract ID (C... StrKey)");
}
