import { describe, it, expect } from "vitest";
import {
  toFieldHex,
  fieldHexToBigInt,
  BN254_MODULUS,
  encodeAddressToField,
} from "../src/index.js";

describe("field helpers", () => {
  it("round-trips bigint <-> FieldHex with 32-byte zero padding", () => {
    expect(toFieldHex(42n)).toBe(
      "0x000000000000000000000000000000000000000000000000000000000000002a",
    );
  });

  it("produces 66-char lowercase hex", () => {
    const h = toFieldHex(255n);
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
    expect(h.endsWith("ff")).toBe(true);
    expect(fieldHexToBigInt(h)).toBe(255n);
  });

  it("rejects values >= BN254 modulus", () => {
    expect(() => toFieldHex(BN254_MODULUS)).toThrow();
  });

  it("encodes a Stellar G-address to a field deterministically and within range", () => {
    const g = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";
    const a = encodeAddressToField(g);
    const b = encodeAddressToField(g);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(fieldHexToBigInt(a)).toBeLessThan(BN254_MODULUS);
  });
});
