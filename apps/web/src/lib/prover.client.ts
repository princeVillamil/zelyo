// PROVING RUNS CLIENT-SIDE ONLY. bb.js (Barretenberg) uses WASM threads via
// SharedArrayBuffer, which requires the page to be cross-origin isolated:
//   Cross-Origin-Opener-Policy: same-origin
//   Cross-Origin-Embedder-Policy: require-corp
// These are set in next.config.ts on the app + /circuit + prover routes.
// Without them `globalThis.crossOriginIsolated` is false and proving silently
// fails — assertCrossOriginIsolated() turns that into a clear ProverError.
// REAL-BROWSER TEST: unit tests inject deps (no WASM). Verify true proving in a
// real browser via the Phase 7 Playwright "selective disclosure" e2e on
// /wallet/prove/[id], which loads the actual circuit artifact under COOP/COEP.

"use client";

import {
  computeScope,
  computeNullifier,
  encodeAddressToField,
  attributesToFields,
  idCommitment,
  buildLeaf,
  poseidon,
  type FieldHex,
  type Attributes,
  type PublicInputs,
  type ProofBundle,
} from "@zelyo/zk-shared";

export class ProverError extends Error {
  constructor(
    public readonly code: "NOT_ISOLATED" | "MANIFEST" | "EXECUTE" | "PROVE" | "LEAF_MISMATCH",
  ) {
    super(code);
    this.name = "ProverError";
  }
}

export interface ProveInput {
  s: FieldHex;
  attributes: Attributes;
  disclose: { track: boolean };
  merklePath: { siblings: FieldHex[]; pathIndices: number[] };
  root: FieldHex;
  boundStellarAddress: string;
}

interface CircuitManifest {
  artifact: {
    acirUrl: string;
    vkeyUrl: string;
  };
  hash: string;
  abi: unknown;
  scope: FieldHex;
  scopeParams: { appId: string; chainId: string; registryId: string };
}

interface NoirLike {
  execute(inputs: Record<string, unknown>): Promise<{ witness: Uint8Array }>;
}
interface BackendLike {
  generateProof(witness: Uint8Array): Promise<{ proof: Uint8Array; publicInputs: string[] }>;
}

export interface ProverDeps {
  fetchManifest(): Promise<CircuitManifest>;
  loadNoir(manifest: CircuitManifest): Promise<NoirLike>;
  loadBackend(manifest: CircuitManifest): Promise<BackendLike>;
}

export function assertCrossOriginIsolated(): void {
  if ((globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated !== true) {
    throw new ProverError("NOT_ISOLATED");
  }
}

// Field-pack the three on-circuit attributes (track/grade/issue_date) exactly as
// the leaf builder + Noir `AttributesF` do. Returned in circuit field order.
function attrFields(a: Attributes): { track: FieldHex; grade: FieldHex; issue_date: FieldHex } {
  const [track, grade, issue_date] = attributesToFields(a);
  return { track, grade, issue_date };
}

export function buildPublicInputs(input: ProveInput, scope: FieldHex): PublicInputs {
  const { track } = attrFields(input.attributes);
  return {
    root: input.root,
    scope,
    boundAddress: encodeAddressToField(input.boundStellarAddress),
    nullifier: computeNullifier(input.s, scope),
    disclosed: {
      value: poseidon([track]),
      raw: { track: input.attributes.track },
    },
  };
}

// Default deps: dynamic-import the WASM packages only in the browser, lazily.
const defaultDeps: ProverDeps = {
  async fetchManifest() {
    // Manifest is small JSON whose hash/scope/URLs gate proof correctness — never
    // serve a stale copy. `no-store` always revalidates against the server; the
    // large circuit artifact is fetched + cached separately in loadNoir/loadBackend.
    const res = await fetch("/api/circuit/manifest", { cache: "no-store" });
    if (!res.ok) throw new ProverError("MANIFEST");
    return (await res.json()) as CircuitManifest;
  },
  async loadNoir(manifest) {
    const { Noir } = await import("@noir-lang/noir_js");
    const acir = await (await fetch(manifest.artifact.acirUrl)).json();
    return new Noir(acir) as unknown as NoirLike;
  },
  async loadBackend(manifest) {
    const { UltraHonkBackend, Barretenberg } = await import("@aztec/bb.js");
    const acir = await (await fetch(manifest.artifact.acirUrl)).json();
    const api = await Barretenberg.new({ threads: navigator.hardwareConcurrency ?? 4 });
    return new UltraHonkBackend(acir.bytecode, api) as unknown as BackendLike;
  },
};

export async function proveCredential(
  input: ProveInput,
  deps: ProverDeps = defaultDeps,
): Promise<ProofBundle> {
  assertCrossOriginIsolated();

  const manifest = await deps.fetchManifest();
  const scope = computeScope(
    manifest.scopeParams.appId,
    manifest.scopeParams.chainId,
    manifest.scopeParams.registryId,
  );
  const publicInputs = buildPublicInputs(input, scope);

  const noir = await deps.loadNoir(manifest);

  // Preflight: rebuild the leaf from the holder's secret and walk the Merkle path
  // locally. The circuit does the same and aborts with an opaque ACVM error if it
  // fails — doing it here gives a clear, actionable message and logs the mismatch.
  const idc = idCommitment(input.s);
  const localLeaf = buildLeaf(idc, input.attributes);
  let node = localLeaf;
  input.merklePath.siblings.forEach((sib, i) => {
    node = input.merklePath.pathIndices[i] === 1 ? poseidon([sib, node]) : poseidon([node, sib]);
  });
  if (node !== input.root) {
    console.error("[prover] Merkle preflight FAILED — credential leaf does not match your identity key.", {
      idCommitmentFromSecret: idc,
      rebuiltLeaf: localLeaf,
      derivedRoot: node,
      expectedRoot: input.root,
    });
    throw new ProverError("LEAF_MISMATCH");
  }

  let witness: Uint8Array;
  try {
    const result = await noir.execute({
      s: input.s,
      // AttributesF struct — field-packed, never the raw strings.
      attributes: attrFields(input.attributes),
      // Flat depth-20 arrays the circuit expects (not the {siblings,pathIndices} wrapper).
      merkle_path: input.merklePath.siblings,
      path_indices: input.merklePath.pathIndices.map((i) => i === 1),
      root: publicInputs.root,
      scope: publicInputs.scope,
      bound_address: publicInputs.boundAddress,
      nullifier: publicInputs.nullifier,
      disclosed: publicInputs.disclosed.value,
    });
    witness = result.witness;
  } catch (err) {
    console.error("[prover] noir.execute failed:", err);
    throw new ProverError("EXECUTE");
  }

  const backend = await deps.loadBackend(manifest);
  let proof: Uint8Array;
  try {
    ({ proof } = await backend.generateProof(witness));
  } catch (err) {
    console.error("[prover] backend.generateProof failed:", err);
    throw new ProverError("PROVE");
  }

  return { proof, publicInputs };
}
