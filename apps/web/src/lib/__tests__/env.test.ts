import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const GOOD: Record<string, string> = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  LOG_LEVEL: "info",
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
};

describe("env", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(GOOD)) process.env[k] = v;
  });
  afterEach(() => {
    vi.resetModules();
  });

  it("parses a valid environment", async () => {
    const { env } = await import("../env");
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.ZK_VERIFY_MODE).toBe("server");
    expect(env.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("fails fast (parseEnv throws) when AUTH_SECRET is too short", async () => {
    const { parseEnv } = await import("../env");
    expect(() => parseEnv({ ...GOOD, AUTH_SECRET: "short" })).toThrow(/AUTH_SECRET/);
  });
});
