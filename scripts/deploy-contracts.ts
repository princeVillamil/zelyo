import "dotenv/config";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Keypair } from "@stellar/stellar-sdk";

const RPC = process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
const WASM_DIR = "contracts/target/wasm32v1-none/release";
const ENV_PATH = ".env";

function sh(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: "utf8" }).trim();
}

async function fundFriendbot(publicKey: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (!res.ok && res.status !== 400) {
    throw new Error(`Friendbot funding failed: ${res.status}`);
  }
}

function deploy(wasm: string, source: string): string {
  return sh("stellar", [
    "contract",
    "deploy",
    "--wasm",
    `${WASM_DIR}/${wasm}`,
    "--source",
    source,
    "--rpc-url",
    RPC,
    "--network-passphrase",
    PASSPHRASE,
  ]);
}

function upsertEnv(key: string, value: string): void {
  let body = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  body = re.test(body) ? body.replace(re, line) : `${body.trimEnd()}\n${line}\n`;
  writeFileSync(ENV_PATH, body);
}

async function main(): Promise<void> {
  const secret = process.env.ISSUER_SECRET;
  if (!secret) throw new Error("ISSUER_SECRET is required to deploy");
  const kp = Keypair.fromSecret(secret);
  const pub = kp.publicKey();

  console.log(`Funding deployer ${pub} via Friendbot (testnet only)...`);
  await fundFriendbot(pub);

  console.log("Deploying verifier...");
  const verifierId = deploy("verifier.wasm", secret);
  console.log(`  VERIFIER_CONTRACT_ID=${verifierId}`);

  console.log("Deploying credential_registry...");
  const registryId = deploy("credential_registry.wasm", secret);
  console.log(`  CREDENTIAL_REGISTRY_CONTRACT_ID=${registryId}`);

  console.log("Initializing registry (issuer=attestor=deployer for dev)...");
  sh("stellar", [
    "contract",
    "invoke",
    "--id",
    registryId,
    "--source-account",
    secret,
    "--rpc-url",
    RPC,
    "--network-passphrase",
    PASSPHRASE,
    "--",
    "initialize",
    "--issuer",
    pub,
    "--attestor",
    pub,
    "--verifier",
    verifierId,
  ]);

  upsertEnv("VERIFIER_CONTRACT_ID", verifierId);
  upsertEnv("CREDENTIAL_REGISTRY_CONTRACT_ID", registryId);
  console.log("Wrote contract IDs to .env");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
