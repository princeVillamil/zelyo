import { describe, it, expect } from "vitest";
import { MERKLE_DEPTH } from "../src/index.js";
import type { Attributes, PublicInputs, ProofBundle, FieldHex } from "../src/index.js";

describe("zk-shared types", () => {
  it("pins MERKLE_DEPTH to 20", () => {
    expect(MERKLE_DEPTH).toBe(20);
  });

  it("exposes the contract shapes", () => {
    const attrs: Attributes = {
      track: "Data Engineering",
      grade: "A",
      issueDate: "2026-06-01",
      courseName: "Distributed Systems",
      learnerName: "Ada Lovelace",
    };
    const pi: PublicInputs = {
      root: "0x00" as FieldHex,
      scope: "0x00" as FieldHex,
      boundAddress: "0x00" as FieldHex,
      nullifier: "0x00" as FieldHex,
      disclosed: { value: "0x00" as FieldHex, raw: { track: "Data Engineering" } },
    };
    const bundle: ProofBundle = { proof: new Uint8Array([1]), publicInputs: pi };
    expect(attrs.track).toBe("Data Engineering");
    expect(bundle.publicInputs.root).toBe("0x00");
  });
});
