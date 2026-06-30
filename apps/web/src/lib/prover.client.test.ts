import { describe, it, expect, vi } from "vitest";
import {
  buildPublicInputs,
  assertCrossOriginIsolated,
  proveCredential,
  ProverError,
  type ProveInput,
} from "./prover.client";
import {
  computeScope,
  computeNullifier,
  encodeAddressToField,
  idCommitment,
  buildLeaf,
  poseidon,
  type FieldHex,
  type Attributes,
} from "@zelyo/zk-shared";

const SCOPE = computeScope("zelyo-v1", "Test SDF Network ; September 2015", "CDREG...");
const ADDR = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

const S = ("0x" + "11".repeat(32)) as FieldHex;
const ATTRS: Attributes = {
  track: "Data Engineering",
  grade: "A",
  issueDate: "2026-01-01",
  courseName: "Distributed Systems",
  learnerName: "Ada Lovelace",
};
const SIBLING = ("0x" + "00".repeat(32)) as FieldHex;
// Build a consistent leaf/path/root so the prover's Merkle preflight passes.
// pathIndices[0] === 0 → the leaf is the left child: root = Poseidon(leaf, sibling).
const LEAF = buildLeaf(idCommitment(S), ATTRS);
const ROOT = poseidon([LEAF, SIBLING]);

const input: ProveInput = {
  s: S,
  attributes: ATTRS,
  disclose: { track: true },
  merklePath: { siblings: [SIBLING], pathIndices: [0] },
  root: ROOT,
  boundStellarAddress: ADDR,
};

describe("prover.client", () => {
  it("builds public inputs from zk-shared (scope, nullifier, bound address)", () => {
    const pi = buildPublicInputs(input, SCOPE);
    expect(pi.root).toBe(input.root);
    expect(pi.scope).toBe(SCOPE);
    expect(pi.nullifier).toBe(computeNullifier(input.s, SCOPE));
    expect(pi.boundAddress).toBe(encodeAddressToField(ADDR));
    expect(pi.disclosed.value).toMatch(/^0x[0-9a-f]{64}$/);
    expect(pi.disclosed.raw.track).toBe("Data Engineering");
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
