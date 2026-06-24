import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/stellar", () => ({ publishRoot: vi.fn(async () => ({ txHash: "TX_REVOKE" })) }));
vi.mock("./merkle.service", () => ({
  insertLeaf: vi.fn(),
  getCurrentRoot: vi.fn(async () => ("0x" + "22".repeat(32))),
}));
vi.mock("@/lib/storage", () => ({ putObject: vi.fn() }));
vi.mock("./mintlog", () => ({ publishMintLog: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

const { db } = vi.hoisted(() => {
  const db = {
    credential: {
      findUniqueOrThrow: vi.fn(async () => ({ id: "cred1", leafId: "leaf1", status: "ACTIVE" })),
      update: vi.fn(async () => ({})),
    },
    leaf: { update: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
    merkleTree: { findFirstOrThrow: vi.fn(async () => ({ id: "tree1" })), update: vi.fn(async () => ({})) },
    rootHistory: { updateMany: vi.fn(async () => ({})), create: vi.fn(async () => ({})) },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  return { db };
});
vi.mock("@/lib/db", () => ({ db }));

import { revokeCredential } from "./credential.service";
import { publishRoot } from "@/lib/stellar";

describe("revokeCredential", () => {
  beforeEach(() => vi.clearAllMocks());

  it("zeroes the leaf, republishes the recomputed root, marks REVOKED, audits", async () => {
    const out = await revokeCredential("cred1", { actorUserId: "admin1", ip: "10.0.0.1" });
    expect(out.txHash).toBe("TX_REVOKE");
    expect(out.merkleRootHex).toBe("0x" + "22".repeat(32));
    expect(publishRoot).toHaveBeenCalledWith("0x" + "22".repeat(32));
    expect(db.credential.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "REVOKED" } }));
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it("rejects revoking an already-revoked credential", async () => {
    db.credential.findUniqueOrThrow.mockResolvedValueOnce({ id: "cred1", leafId: "leaf1", status: "REVOKED" });
    await expect(revokeCredential("cred1", { actorUserId: "a" })).rejects.toThrow(/already/i);
  });
});
