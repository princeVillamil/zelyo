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
  poseidon,
  type FieldHex,
  type Attributes,
  type PublicInputs,
  type ProofBundle,
} from "@zelyo/zk-shared";

export class ProverError extends Error {
  constructor(public readonly code: "NOT_ISOLATED" | "MANIFEST" | "EXECUTE" | "PROVE") {
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

// `disclosed` is the encoding of the single revealed attribute (track).
function encodeTrack(track: string): FieldHex {
  const bytes = new TextEncoder().encode(track);
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  const field = ("0x" + v.toString(16).padStart(64, "0")) as FieldHex;
  return poseidon([field]);
}

export function buildPublicInputs(input: ProveInput, scope: FieldHex): PublicInputs {
  return {
    root: input.root,
    scope,
    boundAddress: encodeAddressToField(input.boundStellarAddress),
    nullifier: computeNullifier(input.s, scope),
    disclosed: encodeTrack(input.attributes.track),
  };
}

// Default deps: dynamic-import the WASM packages only in the browser, lazily.
const defaultDeps: ProverDeps = {
  async fetchManifest() {
    const res = await fetch("/api/circuit/manifest", { cache: "force-cache" });
    if (!res.ok) throw new ProverError("MANIFEST");
    return (await res.json()) as CircuitManifest;
  },
  async loadNoir(manifest) {
    const { Noir } = await import("@noir-lang/noir_js");
    const acir = await (await fetch(manifest.artifact.acirUrl)).json();
    return new Noir(acir, manifest.abi) as unknown as NoirLike;
  },
  async loadBackend(manifest) {
    const { UltraHonkBackend } = await import("@aztec/bb.js");
    const acir = await (await fetch(manifest.artifact.acirUrl)).json();
    return new UltraHonkBackend(acir.bytecode, { manifest: manifest }) as unknown as BackendLike;
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
  let witness: Uint8Array;
  try {
    const result = await noir.execute({
      s: input.s,
      attributes: input.attributes,
      merkle_path: input.merklePath,
      root: publicInputs.root,
      scope: publicInputs.scope,
      bound_address: publicInputs.boundAddress,
      nullifier: publicInputs.nullifier,
      disclosed: publicInputs.disclosed,
    });
    witness = result.witness;
  } catch {
    throw new ProverError("EXECUTE");
  }

  const backend = await deps.loadBackend(manifest);
  let proof: Uint8Array;
  try {
    ({ proof } = await backend.generateProof(witness));
  } catch {
    throw new ProverError("PROVE");
  }

  return { proof, publicInputs };
}
