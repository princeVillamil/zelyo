import { describe, it, expect } from "vitest";
import { emptyTreeRoot, MERKLE_DEPTH } from "../src/index.js";

describe("emptyTreeRoot", () => {
  it("is deterministic, 32-byte FieldHex, depth-defaulted to MERKLE_DEPTH", () => {
    expect(MERKLE_DEPTH).toBe(20);
    const a = emptyTreeRoot();
    const b = emptyTreeRoot(20);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    // different depth → different root
    expect(emptyTreeRoot(4)).not.toBe(a);
  });
});
