import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const { proof, publicInputs, vk } = JSON.parse(
    await readFile(resolve(import.meta.dirname, "proof.json"), "utf8"),
  );
  console.log("[spike] proof bytes:", proof.length / 2);
  console.log("[spike] publicInputs:", publicInputs);
  console.log("[spike] vk bytes:", vk.length / 2);
  console.log(
    "[spike] follow spike/README.md for the deploy+invoke commands (contract already returns false — no BN254 host primitive on Soroban testnet).",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
