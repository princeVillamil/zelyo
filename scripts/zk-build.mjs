#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIRCUIT_DIR = join(ROOT, "circuits", "zelyo_credential");
const TARGET = join(CIRCUIT_DIR, "target", "zelyo_credential.json");
const OUT_DIR = join(ROOT, "apps", "web", "public", "circuit");

// nargo + bb live outside the workspace (installed per docs/toolchain.md). Make
// sure their default install dirs are on PATH so `pnpm zk:build` works without a
// sourced shell profile.
process.env.PATH = [
  join(homedir(), ".nargo", "bin"),
  join(homedir(), ".bb"),
  process.env.PATH ?? "",
].join(":");

function run(cmd, args, cwd) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

// 1. Compile the circuit -> ACIR + ABI bundle.
run("nargo", ["compile"], CIRCUIT_DIR);
if (!existsSync(TARGET)) throw new Error(`nargo compile did not produce ${TARGET}`);

// 2. Export ACIR + ABI to the web app.
mkdirSync(OUT_DIR, { recursive: true });
const artifactOut = join(OUT_DIR, "zelyo_credential.json");
copyFileSync(TARGET, artifactOut);

// 3. Generate the UltraHonk verification key at build time (bb default scheme is
//    ultra_honk). bb writes `vk` (+ `vk_hash`) into OUT_DIR.
const vkOut = join(OUT_DIR, "vk");
run("bb", ["write_vk", "-b", artifactOut, "-o", OUT_DIR]);
if (!existsSync(vkOut)) throw new Error(`bb write_vk did not produce ${vkOut}`);

// 4. Manifest: hashes + scope params for the client/verifier.
const artifactBytes = readFileSync(artifactOut);
const abiHash = createHash("sha256").update(artifactBytes).digest("hex");
const manifest = {
  artifact: "/circuit/zelyo_credential.json",
  vk: "/circuit/vk",
  abiHash,
  scopeAppId: process.env.ZK_SCOPE_APP_ID ?? "zelyo-v1",
  merkleDepth: 20,
  publicInputOrder: [
    "root", "scope", "bound_address", "nullifier",
    "disclosed", "predicate_mode", "predicate_lo", "predicate_hi",
  ],
};
writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("zk:build complete →", OUT_DIR);
