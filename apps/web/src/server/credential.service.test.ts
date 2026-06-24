import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Attributes, FieldHex } from "@zelyo/zk-shared";

const idc = "0x" + "ab".repeat(32);

// vi.mock is hoisted above top-level consts, so the shared mock state must be
// created with vi.hoisted (which runs first).
const { db, mintLog } = vi.hoisted(() => {
  const mintLog: string[] = [];
  const ic = "0x" + "ab".repeat(32);
  const db = {
    holderKey: {
      findFirst: vi.fn(async () => ({ id: "hk1", idCommitment: ic })),
      findUnique: vi.fn(async () => ({ id: "hk1", idCommitment: ic })),
    },
    issuer: { findFirstOrThrow: vi.fn(async () => ({ id: "iss1", name: "Institute" })) },
    merkleTree: { findFirstOrThrow: vi.fn(async () => ({ id: "tree1" })) },
    leaf: { findUniqueOrThrow: vi.fn(async () => ({ id: "leaf7" })) },
    rootHistory: { create: vi.fn(async () => ({})) },
    credential: { create: vi.fn(async () => ({ id: "cred1" })), update: vi.fn(async () => ({})) },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  return { db, mintLog };
});

vi.mock("@zelyo/zk-shared", async (orig) => {
  const actual = await orig<typeof import("@zelyo/zk-shared")>();
  return { ...actual, buildLeaf: vi.fn(() => ("0x" + "0c".repeat(32)) as FieldHex) };
});
vi.mock("./merkle.service", () => ({
  insertLeaf: vi.fn(async () => ({ index: 7, rootHex: ("0x" + "11".repeat(32)) as FieldHex })),
}));
vi.mock("@/lib/stellar", () => ({ publishRoot: vi.fn(async () => ({ txHash: "TX_9f3a" })) }));
vi.mock("@/lib/storage", () => ({ putObject: vi.fn(async () => undefined) }));
vi.mock("./mintlog", () => ({
  publishMintLog: vi.fn(async (_id: string, e: { event: string }) => { mintLog.push(e.event); }),
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { mintCredential } from "./credential.service";
import { publishRoot } from "@/lib/stellar";
import { putObject } from "@/lib/storage";

const attributes: Attributes = {
  track: "Data Engineering",
  grade: "A",
  issueDate: "2026-06-23",
  courseName: "Distributed Systems",
  learnerName: "Ada Lovelace",
};

describe("mintCredential", () => {
  beforeEach(() => { mintLog.length = 0; });

  it("resolves commitment by username, publishes root, persists, writes VC, returns summary", async () => {
    const out = await mintCredential(
      { holder: { username: "ada" }, attributes },
      { actorUserId: "admin1", ip: "127.0.0.1", jobId: "job1" },
    );
    expect(out).toEqual({
      id: "cred1",
      leafIndex: 7,
      merkleRootHex: "0x" + "11".repeat(32),
      vcFileKey: expect.stringMatching(/^vc\/cred1\.json$/),
    });
    expect(publishRoot).toHaveBeenCalledWith("0x" + "11".repeat(32));
    expect(db.rootHistory.create).toHaveBeenCalledWith({
      data: { rootHex: "0x" + "11".repeat(32), txHash: "TX_9f3a", valid: true },
    });
    expect(putObject).toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it("NEVER passes attributes into publishRoot or the mint log", async () => {
    await mintCredential({ holder: { idCommitment: idc as FieldHex }, attributes }, {
      actorUserId: "admin1",
      jobId: "job2",
    });
    const rootArg = (vi.mocked(publishRoot).mock.calls[0] as unknown[])[0];
    expect(JSON.stringify(rootArg)).not.toContain("Ada Lovelace");
    expect(mintLog).toContain("PUBLISH_ROOT");
    const auditCalls = db.auditLog.create.mock.calls as unknown as unknown[][];
    const auditMeta = JSON.stringify(auditCalls[0]?.[0] ?? {});
    expect(auditMeta).not.toContain("Ada Lovelace");
    expect(auditMeta).not.toContain('"grade"');
  });

  it("throws if username resolves to no holder commitment", async () => {
    db.holderKey.findFirst.mockResolvedValueOnce(null as never);
    await expect(
      mintCredential({ holder: { username: "ghost" }, attributes }, { actorUserId: "admin1", jobId: "j" }),
    ).rejects.toThrow(/commitment/i);
  });
});
