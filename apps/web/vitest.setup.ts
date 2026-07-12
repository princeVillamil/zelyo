import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { vi } from "vitest";
// server-only throws when imported outside RSC; stub it for unit tests.
vi.mock("server-only", () => ({}));

// A valid baseline environment so modules that read `env` at import time
// (logger, db, redis, ratelimit, storage, stellar, auth.config) load in tests.
// Individual tests may override specific keys. setupFiles run once per test file,
// so each file starts from this baseline.
const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  LOG_LEVEL: "silent",
  AUTH_SECRET: "x".repeat(32),
  AUTH_URL: "http://localhost:3000",
  AUTH_TRUST_HOST: "true",
  DATABASE_URL: "postgresql://zelyo:zelyo@localhost:5432/zelyo?schema=public",
  DIRECT_URL: "postgresql://zelyo:zelyo@localhost:5432/zelyo?schema=public",
  REDIS_URL: "redis://localhost:6379",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "zelyo",
  S3_ACCESS_KEY_ID: "minioadmin",
  S3_SECRET_ACCESS_KEY: "minioadmin",
  S3_FORCE_PATH_STYLE: "true",
  STELLAR_NETWORK: "testnet",
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
  HORIZON_URL: "https://horizon-testnet.stellar.org",
  ISSUER_SECRET: "S".repeat(56),
  CREDENTIAL_REGISTRY_CONTRACT_ID: "C".repeat(56),
  ZK_SCOPE_APP_ID: "zelyo-v1",
  ZK_VERIFY_MODE: "server",
  CIRCUIT_ARTIFACT_BASE: "/circuit",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "a-strong-password",
  ISSUER_NAME: "Institute of Distributed Systems",
  ISSUER_STELLAR_ACCOUNT: "G".repeat(56),
  SEP10_HOME_DOMAIN: "localhost:3000",
  SEP10_SIGNER_SECRET: "S".repeat(56),
  SEP10_CHALLENGE_TTL_SECONDS: "300",
  SEP10_JWT_MAX_AGE_SECONDS: "900",
  NEXT_PUBLIC_PASSKEY_KIT_RPC_URL: "https://soroban-testnet.stellar.org",
  NEXT_PUBLIC_PASSKEY_KIT_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  NEXT_PUBLIC_PASSKEY_KIT_WALLET_WASM_HASH: "a".repeat(64),
  NEXT_PUBLIC_SEP45_ENABLED: "true",
};
for (const [k, v] of Object.entries(TEST_ENV)) {
  process.env[k] ??= v;
}
