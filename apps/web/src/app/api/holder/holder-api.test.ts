import { describe, it, expect, vi, beforeEach } from "vitest";

const session = { user: { id: "u1", role: "HOLDER" } };
vi.mock("@/auth", () => ({ auth: vi.fn(async () => session) }));
vi.mock("@/server/merkle.service", () => ({
  getMerkleProof: vi.fn(async () => ({ siblings: ["0xaa"], pathIndices: [0], rootHex: "0xroot" })),
}));
vi.mock("@/lib/storage", () => ({ signedVcUrl: vi.fn(async () => "https://signed/vc.json") }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/db", () => ({
  db: {
    holderKey: { findUnique: vi.fn(), upsert: vi.fn() },
    credential: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

import { GET as listCreds } from "./credentials/route";
import { GET as getVc } from "./credentials/[id]/vc/route";
import { PUT as putCommitment } from "./commitment/route";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { buildLeaf, type Attributes, type FieldHex } from "@zelyo/zk-shared";

const commitmentA = ("0x" + "11".repeat(32)) as FieldHex;
const commitmentB = ("0x" + "22".repeat(32)) as FieldHex;
const attributes: Attributes = {
  courseName: "Distributed Systems",
  track: "Data Engineering",
  issueDate: "2026-01-01",
  grade: "A",
  learnerName: "Ada",
};
// Leaf as minted under commitmentA.
const leafA = buildLeaf(commitmentA, attributes);

beforeEach(() => vi.clearAllMocks());

describe("holder APIs", () => {
  it("GET /credentials returns the caller's credentials with merkle path + root", async () => {
    vi.mocked(db.holderKey.findUnique).mockResolvedValue({ id: "hk1" } as never);
    vi.mocked(db.credential.findMany).mockResolvedValue([
      { id: "c1", status: "ACTIVE", attributes: { track: "Data Engineering" }, leafIndex: 3, merkleRootHex: "0xroot" },
    ] as never);
    const res = await listCreds(new Request("http://x/api/holder/credentials"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.credentials[0]).toMatchObject({
      id: "c1",
      leafIndex: 3,
      root: "0xroot",
      merklePath: { siblings: ["0xaa"], pathIndices: [0] },
    });
  });

  it("GET /credentials is 401 for unauthenticated callers", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const res = await listCreds(new Request("http://x"));
    expect(res.status).toBe(401);
  });

  it("GET vc returns a signed URL only for the owner", async () => {
    vi.mocked(db.holderKey.findUnique).mockResolvedValue({ id: "hk1" } as never);
    vi.mocked(db.credential.findFirst).mockResolvedValue({ id: "c1", vcFileKey: "vc/c1.json", holderKeyId: "hk1" } as never);
    const res = await getVc(new Request("http://x"), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://signed/vc.json");
  });

  it("GET vc is 404 when the credential is not the caller's", async () => {
    vi.mocked(db.holderKey.findUnique).mockResolvedValue({ id: "hk1" } as never);
    vi.mocked(db.credential.findFirst).mockResolvedValue(null as never);
    const res = await getVc(new Request("http://x"), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(404);
  });

  it("PUT commitment upserts idCommitment", async () => {
    vi.mocked(db.holderKey.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.holderKey.upsert).mockResolvedValue({ idCommitment: "0x" + "ab".repeat(32) } as never);
    const c = "0x" + "ab".repeat(32);
    const res = await putCommitment(new Request("http://x", { method: "PUT", body: JSON.stringify({ idCommitment: c }) }));
    expect(res.status).toBe(200);
    expect((await res.json()).idCommitment).toBe(c);
  });

  it("PUT commitment rejects a payload that contains the secret s", async () => {
    const res = await putCommitment(
      new Request("http://x", { method: "PUT", body: JSON.stringify({ idCommitment: "0x" + "ab".repeat(32), s: "0xdead" }) }),
    );
    expect(res.status).toBe(400);
    expect(db.holderKey.upsert).not.toHaveBeenCalled();
  });

  it("PUT commitment rejects a change that orphans provable credentials (409)", async () => {
    vi.mocked(db.holderKey.findUnique).mockResolvedValue({ id: "hk1", idCommitment: commitmentA } as never);
    vi.mocked(db.credential.findMany).mockResolvedValue([
      { status: "ACTIVE", attributes, leaf: { leafHex: leafA } },
    ] as never);
    const res = await putCommitment(
      new Request("http://x", { method: "PUT", body: JSON.stringify({ idCommitment: commitmentB }) }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("COMMITMENT_HAS_CREDENTIALS");
    expect(db.holderKey.upsert).not.toHaveBeenCalled();
  });

  it("PUT commitment allows restoring the original key that re-homes orphaned credentials", async () => {
    // Server currently holds commitmentB (a key that orphaned the credentials); the
    // stored leaves were minted under commitmentA. Restoring A must be accepted.
    vi.mocked(db.holderKey.findUnique).mockResolvedValue({ id: "hk1", idCommitment: commitmentB } as never);
    vi.mocked(db.credential.findMany).mockResolvedValue([
      { status: "ACTIVE", attributes, leaf: { leafHex: leafA } },
    ] as never);
    vi.mocked(db.holderKey.upsert).mockResolvedValue({ idCommitment: commitmentA } as never);
    const res = await putCommitment(
      new Request("http://x", { method: "PUT", body: JSON.stringify({ idCommitment: commitmentA }) }),
    );
    expect(res.status).toBe(200);
    expect(db.holderKey.upsert).toHaveBeenCalled();
  });

  it("PUT commitment allows re-publishing the same commitment (idempotent)", async () => {
    vi.mocked(db.holderKey.findUnique).mockResolvedValue({ id: "hk1", idCommitment: commitmentA } as never);
    vi.mocked(db.holderKey.upsert).mockResolvedValue({ idCommitment: commitmentA } as never);
    const res = await putCommitment(
      new Request("http://x", { method: "PUT", body: JSON.stringify({ idCommitment: commitmentA }) }),
    );
    expect(res.status).toBe(200);
    expect(db.credential.findMany).not.toHaveBeenCalled(); // no change → no orphan scan
    expect(db.holderKey.upsert).toHaveBeenCalled();
  });

  it("PUT commitment with force replaces a changed commitment and audits it", async () => {
    vi.mocked(db.holderKey.findUnique).mockResolvedValue({ id: "hk1", idCommitment: commitmentA } as never);
    vi.mocked(db.credential.findMany).mockResolvedValue([
      { status: "ACTIVE", attributes, leaf: { leafHex: leafA } },
    ] as never);
    vi.mocked(db.holderKey.upsert).mockResolvedValue({ idCommitment: commitmentB } as never);
    const res = await putCommitment(
      new Request("http://x", { method: "PUT", body: JSON.stringify({ idCommitment: commitmentB, force: true }) }),
    );
    expect(res.status).toBe(200);
    expect(db.holderKey.upsert).toHaveBeenCalled();
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      "holder.commitment.replace",
      expect.objectContaining({ meta: expect.objectContaining({ orphanedCredentials: 1 }) }),
    );
  });
});
