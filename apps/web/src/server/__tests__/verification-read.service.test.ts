import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("../../lib/db", () => ({ db: { verification: { findFirst } } }));
vi.mock("../../lib/explorer", () => ({
  explorerTxUrl: (h: string) => `https://explorer.test/tx/${h}`,
}));

import { getVerificationByTxHash } from "../verification-read.service";

beforeEach(() => findFirst.mockReset());

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
      boundAddress: "GABC",
      disclosed: { track: "Data Engineering" },
      createdAt: new Date("2026-06-23T00:00:00Z"),
      jobGate: { slug: "data-engineering" },
    });
    const view = await getVerificationByTxHash("tx1");
    expect(view).toEqual({
      txHash: "tx1",
      result: "VERIFIED",
      nullifierHex: "0xnull",
      boundAddress: "GABC",
      disclosed: { track: "Data Engineering" },
      explorerUrl: "https://explorer.test/tx/tx1",
      createdAt: new Date("2026-06-23T00:00:00Z"),
      jobGateSlug: "data-engineering",
    });
    // disclosed carries only the predicate target; never name/grade/email.
    expect(Object.keys(view!.disclosed as object)).toEqual(["track"]);
  });
});
