import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";

const ARTIFACT = resolve(
  import.meta.dirname,
  "../circuits/zelyo_credential/target/zelyo_credential.json",
);

const WITNESS = resolve(
  import.meta.dirname,
  "../circuits/zelyo_credential/target/zelyo_credential.gz",
);

async function main() {
  const circuit = JSON.parse(await readFile(ARTIFACT, "utf8"));

  // Use the witness produced by `nargo execute` (msgpack inside gzip), which
  // is the format bb.js 5.x expects for UltraHonk proof generation.
  const compressedWitness = new Uint8Array(await readFile(WITNESS));

  const api = await Barretenberg.new();
  const backend = new UltraHonkBackend(circuit.bytecode, api);

  const proof = await backend.generateProof(compressedWitness);
  const vk = await backend.getVerificationKey();

  // local sanity: bb.js verifies its own proof
  const ok = await backend.verifyProof({ ...proof, verificationKey: vk });
  console.log("[spike] local bb.js verifyProof =", ok);

  await writeFile(
    resolve(import.meta.dirname, "proof.json"),
    JSON.stringify(
      {
        proof: Buffer.from(proof.proof).toString("hex"),
        publicInputs: proof.publicInputs,
        vk: Buffer.from(vk).toString("hex"),
      },
      null,
      2,
    ),
  );
  console.log("[spike] wrote proof.json + vk");

  await api.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
