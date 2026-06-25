import { describe, it, expect, vi } from "vitest";
import {
  buildPublicInputs,
  assertCrossOriginIsolated,
  proveCredential,
  ProverError,
  type ProveInput,
} from "./prover.client";
import { computeScope, computeNullifier, encodeAddressToField, type FieldHex } from "@zelyo/zk-shared";

const SCOPE = computeScope("zelyo-v1", "Test SDF Network ; September 2015", "CDREG...");
const ADDR = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

const input: ProveInput = {
  s: ("0x" + "11".repeat(32)) as FieldHex,
  attributes: {
    track: "Data Engineering",
    grade: "A",
    issueDate: "2026-01-01",
    courseName: "Distributed Systems",
    learnerName: "Ada Lovelace",
  },
  disclose: { track: true },
  merklePath: { siblings: [("0x" + "00".repeat(32)) as FieldHex], pathIndices: [0] },
  root: ("0x" + "ab".repeat(32)) as FieldHex,
  boundStellarAddress: ADDR,
};

describe("prover.client", () => {
  it("builds public inputs from zk-shared (scope, nullifier, bound address)", () => {
    const pi = buildPublicInputs(input, SCOPE);
    expect(pi.root).toBe(input.root);
    expect(pi.scope).toBe(SCOPE);
    expect(pi.nullifier).toBe(computeNullifier(input.s, SCOPE));
    expect(pi.boundAddress).toBe(encodeAddressToField(ADDR));
    expect(pi.disclosed).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("throws NOT_ISOLATED when cross-origin isolation is off", () => {
    vi.stubGlobal("crossOriginIsolated", false);
    expect(() => assertCrossOriginIsolated()).toThrowError(ProverError);
    expect(() => assertCrossOriginIsolated()).toThrowError(/NOT_ISOLATED/);
    vi.unstubAllGlobals();
  });

  it("runs the pipeline with injected deps and returns a ProofBundle", async () => {
    vi.stubGlobal("crossOriginIsolated", true);
    const proof = new Uint8Array([1, 2, 3]);
    const deps = {
      fetchManifest: vi.fn().mockResolvedValue({
        artifact: { acirUrl: "/circuit/acir.json", vkeyUrl: "/circuit/vk" },
        hash: "deadbeef",
        abi: {},
        scope: ("0x" + "cd".repeat(32)) as FieldHex,
        scopeParams: { appId: "zelyo-v1", chainId: "Test SDF Network ; September 2015", registryId: "CDREG..." },
      }),
      loadNoir: vi.fn().mockResolvedValue({
        execute: vi.fn().mockResolvedValue({ witness: new Uint8Array([9]) }),
      }),
      loadBackend: vi.fn().mockResolvedValue({
        generateProof: vi.fn().mockResolvedValue({ proof, publicInputs: [] }),
      }),
    };
    const bundle = await proveCredential(input, deps);
    expect(bundle.proof).toBe(proof);
    expect(bundle.publicInputs.nullifier).toBe(computeNullifier(input.s, SCOPE));
    expect(deps.loadNoir).toHaveBeenCalledOnce();
    expect(deps.loadBackend).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("never includes the raw secret s in the produced bundle", async () => {
    vi.stubGlobal("crossOriginIsolated", true);
    const deps = {
      fetchManifest: vi.fn().mockResolvedValue({
        artifact: { acirUrl: "a", vkeyUrl: "c" },
        hash: "h",
        abi: {},
        scope: ("0x" + "cd".repeat(32)) as FieldHex,
        scopeParams: { appId: "zelyo-v1", chainId: "Test SDF Network ; September 2015", registryId: "CDREG..." },
      }),
      loadNoir: vi.fn().mockResolvedValue({ execute: vi.fn().mockResolvedValue({ witness: new Uint8Array() }) }),
      loadBackend: vi.fn().mockResolvedValue({ generateProof: vi.fn().mockResolvedValue({ proof: new Uint8Array(), publicInputs: [] }) }),
    };
    const bundle = await proveCredential(input, deps);
    expect(JSON.stringify(bundle.publicInputs)).not.toContain(input.s);
    vi.unstubAllGlobals();
  });
});
