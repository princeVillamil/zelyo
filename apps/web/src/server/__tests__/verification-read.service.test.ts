import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, rootFindUnique } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  rootFindUnique: vi.fn(),
}));
vi.mock("../../lib/db", () => ({
  db: { verification: { findFirst }, rootHistory: { findUnique: rootFindUnique } },
}));
vi.mock("../../lib/explorer", () => ({
  explorerTxUrl: (h: string) => `https://explorer.test/tx/${h}`,
}));

import { getVerificationByTxHash } from "../verification-read.service";

beforeEach(() => {
  findFirst.mockReset();
  rootFindUnique.mockReset();
});

describe("getVerificationByTxHash", () => {
  it("returns null when no row matches", async () => {
    findFirst.mockResolvedValue(null);
    expect(await getVerificationByTxHash("nope")).toBeNull();
  });

  it("maps a VERIFIED row to a view with an explorer URL and no PII", async () => {
    findFirst.mockResolvedValue({
      txHash: "tx1",
      result: "VERIFIED",
      nullifierHex: "0xnull",
      rootHex: "0xroot",
      boundAddress: "0xdeadbeef",
      boundStellarAddress: "GASTINUANRYSHXSWZNAGDKYNISWSP4ZCDC534OVIA7IE272OIWSSQZGJ",
      disclosed: { track: "Data Engineering" },
      createdAt: new Date("2026-06-23T00:00:00Z"),
      credentialId: null,
      jobGate: { slug: "data-engineering", title: "Data Engineering" },
    });
    rootFindUnique.mockResolvedValue({ txHash: "roottx" });
    const view = await getVerificationByTxHash("tx1");
    expect(view).toEqual({
      txHash: "tx1",
      result: "VERIFIED",
      nullifierHex: "0xnull",
      rootHex: "0xroot",
      rootAnchorTxHash: "roottx",
      boundAddress: "0xdeadbeef",
      boundStellarAddress: "GASTINUANRYSHXSWZNAGDKYNISWSP4ZCDC534OVIA7IE272OIWSSQZGJ",
      disclosed: { track: "Data Engineering" },
      disclosedRaw: {},
      explorerUrl: "https://explorer.test/tx/tx1",
      createdAt: new Date("2026-06-23T00:00:00Z"),
      jobGateSlug: "data-engineering",
      jobGateTitle: "Data Engineering",
      credentialId: null,
    });
    // disclosed carries only the predicate target; never name/grade/email.
    expect(Object.keys(view!.disclosed as object)).toEqual(["track"]);
  });

  it("leaves root anchors null when the proof pre-dates rootHex persistence", async () => {
    findFirst.mockResolvedValue({
      txHash: "tx1",
      result: "VERIFIED",
      nullifierHex: "0xnull",
      rootHex: null,
      boundAddress: "0xdeadbeef",
      boundStellarAddress: null,
      disclosed: {},
      createdAt: new Date("2026-06-23T00:00:00Z"),
      credentialId: null,
      jobGate: null,
    });
    const view = await getVerificationByTxHash("tx1");
    expect(view?.rootHex).toBeNull();
    expect(view?.rootAnchorTxHash).toBeNull();
    expect(view?.jobGateSlug).toBeNull();
    expect(view?.jobGateTitle).toBeNull();
    expect(rootFindUnique).not.toHaveBeenCalled();
  });
});
