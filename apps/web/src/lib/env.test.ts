import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const valid = {
  NODE_ENV: "development",
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
  ISSUER_SECRET: "SABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRST",
  CREDENTIAL_REGISTRY_CONTRACT_ID: "",
  VERIFIER_CONTRACT_ID: "",
  ZK_SCOPE_APP_ID: "zelyo-v1",
  ZK_VERIFY_MODE: "onchain",
  CIRCUIT_ARTIFACT_BASE: "/circuit",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "supersecret-password",
  ISSUER_NAME: "Institute of Distributed Systems",
  ISSUER_STELLAR_ACCOUNT: "",
  NEXT_PUBLIC_EXPLORER_BASE: "https://stellar.expert/explorer/testnet",
};

describe("parseEnv", () => {
  it("parses a complete valid environment", () => {
    const env = parseEnv(valid);
    expect(env.ZK_VERIFY_MODE).toBe("onchain");
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.AUTH_TRUST_HOST).toBe(true);
  });

  it("coerces S3_FORCE_PATH_STYLE and AUTH_TRUST_HOST to booleans", () => {
    const env = parseEnv({ ...valid, S3_FORCE_PATH_STYLE: "false", AUTH_TRUST_HOST: "false" });
    expect(env.S3_FORCE_PATH_STYLE).toBe(false);
    expect(env.AUTH_TRUST_HOST).toBe(false);
  });

  it("rejects an AUTH_SECRET shorter than 32 chars", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "short" })).toThrow();
  });

  it("rejects an unknown ZK_VERIFY_MODE", () => {
    expect(() => parseEnv({ ...valid, ZK_VERIFY_MODE: "magic" })).toThrow();
  });

  it("rejects a non-URL DATABASE_URL", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "not-a-url" })).toThrow();
  });
});
