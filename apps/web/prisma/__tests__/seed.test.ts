import { describe, it, expect, vi } from "vitest";

const store = { users: 0, issuers: 0, trees: 0, gates: 0 };
const upsert = (k: keyof typeof store) =>
  vi.fn(async () => { store[k] = 1; return {}; }); // idempotent: count never exceeds 1

vi.mock("../../src/lib/db", () => ({
  db: {
    user: { upsert: upsert("users") },
    issuer: { create: upsert("issuers"), findFirst: vi.fn(async () => null) },
    merkleTree: { create: upsert("trees"), findFirst: vi.fn(async () => null) },
    jobGate: { upsert: upsert("gates") },
    $disconnect: vi.fn(),
  },
}));
vi.mock("@node-rs/argon2", () => ({ hash: vi.fn(async () => "$argon2id$hash"), Algorithm: { Argon2id: 2 } }));
vi.mock("@zelyo/zk-shared", () => ({ MERKLE_DEPTH: 20, emptyTreeRoot: () => "0x" + "00".repeat(32) }));
vi.mock("../../src/lib/env", () => ({
  env: {
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "a-strong-password",
    ISSUER_NAME: "Institute of Distributed Systems",
    ISSUER_STELLAR_ACCOUNT: "GISSUER",
  },
}));

describe("seed", () => {
  it("is idempotent: running twice yields one of each entity", async () => {
    const { seed } = await import("../seed");
    await seed();
    await seed();
    expect(store).toEqual({ users: 1, issuers: 1, trees: 1, gates: 1 });
  });
});
