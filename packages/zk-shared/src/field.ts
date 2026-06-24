import type { FieldHex } from "./types.js";

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

// Stellar G-address (StrKey: version byte + 32-byte ed25519 pubkey + CRC16) ->
// a single BN254 field. We decode the StrKey, take the 32-byte raw pubkey, and
// reduce it mod the field modulus. The Noir side receives the identical bigint
// as bound_address.
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

export function encodeAddressToField(stellarPubKey: string): FieldHex {
  if (!/^G[A-Z2-7]{55}$/.test(stellarPubKey)) {
    throw new Error("expected a Stellar public key (G... StrKey)");
  }
  const decoded = base32Decode(stellarPubKey); // [version(1)] [pubkey(32)] [crc16(2)]
  const pubkey = decoded.slice(1, 33);
  let acc = 0n;
  for (const byte of pubkey) acc = (acc << 8n) | BigInt(byte);
  // Reduce into the field (32 bytes can exceed the 254-bit modulus; mod is exact).
  return toFieldHex(acc % BN254_MODULUS);
}
