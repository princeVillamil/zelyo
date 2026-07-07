import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  gateFindUnique,
  verificationFindFirst,
  claimFindUnique,
  claimCreate,
  issueClaimableBalance,
  issuePayment,
  setVerifiedFlag,
} = vi.hoisted(() => ({
  gateFindUnique: vi.fn(),
  verificationFindFirst: vi.fn(),
  claimFindUnique: vi.fn(),
  claimCreate: vi.fn(),
  issueClaimableBalance: vi.fn(),
  issuePayment: vi.fn(),
  setVerifiedFlag: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  db: {
    jobGate: { findUnique: gateFindUnique },
    verification: { findFirst: verificationFindFirst },
    gateClaim: { findUnique: claimFindUnique, create: claimCreate },
  },
}));
vi.mock("../../lib/stellar", () => ({ issueClaimableBalance, issuePayment, setVerifiedFlag }));
vi.mock("../../lib/explorer", () => ({ explorerTxUrl: vi.fn((txHash: string) => `https://explorer.test/tx/${txHash}`) }));

import { claimGate } from "../jobgate.service";
import type { FieldHex } from "@zelyo/zk-shared";

const NULL = "0xnull" as FieldHex;

const gate = (rewardType: string) => ({
  id: "g1",
  slug: "data-engineering",
  rewardType,
  requiredPredicates: [{ attribute: "track", equals: "Data Engineering" }],
  rewardConfig: { asset: { code: "ZELYO", issuer: "GISSUER", amount: "1" } },
  expiresAt: null,
});

const verified = {
  result: "VERIFIED",
  txHash: "tx1",
  nullifierHex: "0xnull",
  boundAddress: "GHOLDER",
  disclosed: { value: "0x" + "ab".repeat(32), raw: { track: "Data Engineering" } },
};

beforeEach(() => {
  for (const m of [gateFindUnique, verificationFindFirst, claimFindUnique, claimCreate, issueClaimableBalance, issuePayment, setVerifiedFlag]) m.mockReset();
});

describe("claimGate", () => {
  it("issues a claimable balance for a CLAIMABLE_BALANCE gate", async () => {
    gateFindUnique.mockResolvedValue(gate("CLAIMABLE_BALANCE"));
    verificationFindFirst.mockResolvedValue(verified);
    claimFindUnique.mockResolvedValue(null);
    issueClaimableBalance.mockResolvedValue({ txHash: "CBTX" });
    claimCreate.mockResolvedValue({});

    const res = await claimGate("data-engineering", NULL, "GHOLDER", "tx1");

    expect(issueClaimableBalance).toHaveBeenCalledWith("GHOLDER", {
      code: "ZELYO",
      issuer: "GISSUER",
      amount: "1",
    });
    expect(issuePayment).not.toHaveBeenCalled();
    expect(setVerifiedFlag).not.toHaveBeenCalled();
    expect(claimCreate).toHaveBeenCalledWith({
      data: { jobGateId: "g1", nullifierHex: "0xnull", boundAddress: "GHOLDER", txHash: "CBTX" },
    });
    expect(res).toEqual({
      txHash: "CBTX",
      explorerUrl: "https://explorer.test/tx/CBTX",
      rewardType: "CLAIMABLE_BALANCE",
    });
  });

  it("issues a direct payment for a native-XLM CLAIMABLE_BALANCE gate", async () => {
    gateFindUnique.mockResolvedValue({
      ...gate("CLAIMABLE_BALANCE"),
      rewardConfig: { asset: { code: "XLM", issuer: "", amount: "10" } },
    });
    verificationFindFirst.mockResolvedValue(verified);
    claimFindUnique.mockResolvedValue(null);
    issuePayment.mockResolvedValue({ txHash: "PAYTX" });
    claimCreate.mockResolvedValue({});

    const res = await claimGate("data-engineering", NULL, "GHOLDER", "tx1");

    expect(issuePayment).toHaveBeenCalledWith("GHOLDER", { code: "XLM", issuer: "", amount: "10" });
    expect(issueClaimableBalance).not.toHaveBeenCalled();
    expect(claimCreate).toHaveBeenCalledWith({
      data: { jobGateId: "g1", nullifierHex: "0xnull", boundAddress: "GHOLDER", txHash: "PAYTX" },
    });
    expect(res).toEqual({
      txHash: "PAYTX",
      explorerUrl: "https://explorer.test/tx/PAYTX",
      rewardType: "CLAIMABLE_BALANCE",
    });
  });

  it("issues a claimable balance for a REGULATED_ASSET gate", async () => {
    gateFindUnique.mockResolvedValue({
      ...gate("REGULATED_ASSET"),
      rewardConfig: { asset: { code: "ZELYO", issuer: "GISSUER", amount: "1" } },
    });
    verificationFindFirst.mockResolvedValue(verified);
    claimFindUnique.mockResolvedValue(null);
    issueClaimableBalance.mockResolvedValue({ txHash: "CBTX" });
    claimCreate.mockResolvedValue({});

    const res = await claimGate("data-engineering", NULL, "GHOLDER", "tx1");

    expect(issueClaimableBalance).toHaveBeenCalledWith("GHOLDER", {
      code: "ZELYO",
      issuer: "GISSUER",
      amount: "1",
    });
    expect(issuePayment).not.toHaveBeenCalled();
    expect(setVerifiedFlag).not.toHaveBeenCalled();
    expect(claimCreate).toHaveBeenCalledWith({
      data: { jobGateId: "g1", nullifierHex: "0xnull", boundAddress: "GHOLDER", txHash: "CBTX" },
    });
    expect(res).toEqual({
      txHash: "CBTX",
      explorerUrl: "https://explorer.test/tx/CBTX",
      rewardType: "REGULATED_ASSET",
    });
  });

  it("flips the verified flag for a FLAG gate", async () => {
    gateFindUnique.mockResolvedValue(gate("FLAG"));
    verificationFindFirst.mockResolvedValue(verified);
    claimFindUnique.mockResolvedValue(null);
    setVerifiedFlag.mockResolvedValue({ txHash: "FLAGTX" });
    claimCreate.mockResolvedValue({});

    const res = await claimGate("data-engineering", NULL, "GHOLDER", "tx1");

    expect(setVerifiedFlag).toHaveBeenCalledWith("GHOLDER");
    expect(issueClaimableBalance).not.toHaveBeenCalled();
    expect(res).toEqual({
      txHash: "FLAGTX",
      explorerUrl: "https://explorer.test/tx/FLAGTX",
      rewardType: "FLAG",
    });
  });

  it("is idempotent: returns the existing claim without re-issuing", async () => {
    gateFindUnique.mockResolvedValue(gate("CLAIMABLE_BALANCE"));
    verificationFindFirst.mockResolvedValue(verified);
    claimFindUnique.mockResolvedValue({ txHash: "OLDTX" });

    const res = await claimGate("data-engineering", NULL, "GHOLDER", "tx1");

    expect(issueClaimableBalance).not.toHaveBeenCalled();
    expect(claimCreate).not.toHaveBeenCalled();
    expect(res).toEqual({
      txHash: "OLDTX",
      explorerUrl: "https://explorer.test/tx/OLDTX",
      rewardType: "CLAIMABLE_BALANCE",
    });
  });

  it("rejects an unknown gate", async () => {
    gateFindUnique.mockResolvedValue(null);
    await expect(claimGate("nope", NULL, "GHOLDER", "tx1")).rejects.toMatchObject({
      code: "GATE_NOT_FOUND",
    });
  });

  it("rejects when no eligible VERIFIED proof matches the predicate", async () => {
    gateFindUnique.mockResolvedValue(gate("CLAIMABLE_BALANCE"));
    verificationFindFirst.mockResolvedValue(null);
    await expect(claimGate("data-engineering", NULL, "GHOLDER", "tx1")).rejects.toMatchObject({
      code: "PROOF_NOT_ELIGIBLE",
    });
  });

  it("rejects when verification jobGateId does not match the gate id", async () => {
    gateFindUnique.mockResolvedValue(gate("CLAIMABLE_BALANCE"));
    verificationFindFirst.mockResolvedValue({
      ...verified,
      jobGateId: "g_wrong",
    });
    await expect(claimGate("data-engineering", NULL, "GHOLDER", "tx1")).rejects.toMatchObject({
      code: "PROOF_NOT_ELIGIBLE",
      message: "This proof was verified for a different gate.",
    });
  });

  it("accepts when verification jobGateId matches the gate id", async () => {
    gateFindUnique.mockResolvedValue(gate("CLAIMABLE_BALANCE"));
    verificationFindFirst.mockResolvedValue({
      ...verified,
      jobGateId: "g1",
    });
    claimFindUnique.mockResolvedValue(null);
    issueClaimableBalance.mockResolvedValue({ txHash: "CBTX" });
    claimCreate.mockResolvedValue({});

    const res = await claimGate("data-engineering", NULL, "GHOLDER", "tx1");
    expect(res.txHash).toBe("CBTX");
  });

  it("accepts when verification jobGateId is null", async () => {
    gateFindUnique.mockResolvedValue(gate("CLAIMABLE_BALANCE"));
    verificationFindFirst.mockResolvedValue({
      ...verified,
      jobGateId: null,
    });
    claimFindUnique.mockResolvedValue(null);
    issueClaimableBalance.mockResolvedValue({ txHash: "CBTX" });
    claimCreate.mockResolvedValue({});

    const res = await claimGate("data-engineering", NULL, "GHOLDER", "tx1");
    expect(res.txHash).toBe("CBTX");
  });
});
