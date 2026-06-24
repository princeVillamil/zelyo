import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/merkle.service", () => ({ getCurrentRoot: vi.fn(async () => ("0x" + "11".repeat(32))) }));
vi.mock("@/lib/db", () => ({
  db: {
    rootHistory: { findFirst: vi.fn(async () => ({ rootHex: "0x" + "11".repeat(32), txHash: "TX1", valid: true })) },
    nullifier: { findUnique: vi.fn(async () => null) },
  },
}));
vi.mock("@/lib/env", () => ({
  env: {
    ZK_SCOPE_APP_ID: "zelyo-v1",
    NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    CREDENTIAL_REGISTRY_CONTRACT_ID: "CABC",
    CIRCUIT_ARTIFACT_BASE: "/circuit",
    APP_URL: "http://localhost:3000",
  },
}));
vi.mock("@zelyo/zk-shared", async (orig) => {
  const a = await orig<typeof import("@zelyo/zk-shared")>();
  return { ...a, computeScope: vi.fn(() => ("0x" + "ab".repeat(32))) };
});

import { GET as rootGET } from "./root/route";
import { GET as nullGET } from "./nullifier/[hash]/route";

describe("registry routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /api/registry/root returns the current root + on-chain ref", async () => {
    const res = await rootGET(new Request("http://localhost/api/registry/root"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ rootHex: "0x" + "11".repeat(32), txHash: "TX1" });
  });

  it("GET /api/registry/nullifier/[hash] reports not-used when absent (chain authoritative)", async () => {
    const res = await nullGET(new Request("http://localhost/x"), { params: Promise.resolve({ hash: "0x" + "cd".repeat(32) }) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ used: false });
  });

  it("GET /api/registry/nullifier/[hash] 422 on malformed hash", async () => {
    const res = await nullGET(new Request("http://localhost/x"), { params: Promise.resolve({ hash: "nope" }) });
    expect(res.status).toBe(422);
  });
});
