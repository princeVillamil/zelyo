import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  gateFindUnique,
  verificationFindFirst,
  claimFindUnique,
  claimCreate,
  issueClaimableBalance,
  issuePayment,
  issueSorobanAsset,
  setVerifiedFlag,
} = vi.hoisted(() => ({
  gateFindUnique: vi.fn(),
  verificationFindFirst: vi.fn(),
  claimFindUnique: vi.fn(),
  claimCreate: vi.fn(),
  issueClaimableBalance: vi.fn(),
  issuePayment: vi.fn(),
  issueSorobanAsset: vi.fn(),
  setVerifiedFlag: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  db: {
    jobGate: { findUnique: gateFindUnique },
    verification: { findFirst: verificationFindFirst },
    gateClaim: { findUnique: claimFindUnique, create: claimCreate },
  },
}));
vi.mock("../../lib/stellar", () => ({
  issueClaimableBalance,
  issuePayment,
  issueSorobanAsset,
  setVerifiedFlag,
  isContractAddress: (addr: string) => addr.startsWith("C"),
}));
vi.mock("../../lib/env", () => ({
  env: {
    USE_CHANNELS: false,
    ISSUER_STELLAR_ACCOUNT: "GISSUER",
    LOG_LEVEL: "silent",
  },
}));
vi.mock("../../lib/explorer", () => ({ explorerTxUrl: vi.fn((txHash: string) => `https://explorer.test/tx/${txHash}`) }));

import { claimGate } from "../jobgate.service";
import type { FieldHex } from "@zelyo/zk-shared";
import { env } from "../../lib/env";

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
  for (const m of [gateFindUnique, verificationFindFirst, claimFindUnique, claimCreate, issueClaimableBalance, issuePayment, issueSorobanAsset, setVerifiedFlag]) m.mockReset();
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

  it("issues a Soroban asset for a C... smart-wallet destination", async () => {
    const cAddress = `C${"A".repeat(55)}`;
    gateFindUnique.mockResolvedValue(gate("CLAIMABLE_BALANCE"));
    verificationFindFirst.mockResolvedValue({ ...verified, boundAddress: cAddress });
    claimFindUnique.mockResolvedValue(null);
    issueSorobanAsset.mockResolvedValue({ txHash: "SOROTX" });
    claimCreate.mockResolvedValue({});

    const res = await claimGate("data-engineering", NULL, cAddress, "tx1");

    expect(issueSorobanAsset).toHaveBeenCalledWith(cAddress, {
      code: "ZELYO",
      issuer: "GISSUER",
      amount: "1",
    });
    expect(issuePayment).not.toHaveBeenCalled();
    expect(issueClaimableBalance).not.toHaveBeenCalled();
    expect(claimCreate).toHaveBeenCalledWith({
      data: { jobGateId: "g1", nullifierHex: "0xnull", boundAddress: cAddress, txHash: "SOROTX" },
    });
    expect(res).toEqual({
      txHash: "SOROTX",
      explorerUrl: "https://explorer.test/tx/SOROTX",
      rewardType: "CLAIMABLE_BALANCE",
    });
  });

  it("issues a Soroban asset for native XLM when the destination is a C... wallet", async () => {
    const cAddress = `C${"A".repeat(55)}`;
    gateFindUnique.mockResolvedValue({
      ...gate("CLAIMABLE_BALANCE"),
      rewardConfig: { asset: { code: "XLM", issuer: "", amount: "10" } },
    });
    verificationFindFirst.mockResolvedValue({ ...verified, boundAddress: cAddress });
    claimFindUnique.mockResolvedValue(null);
    issueSorobanAsset.mockResolvedValue({ txHash: "SOROTX" });
    claimCreate.mockResolvedValue({});

    const res = await claimGate("data-engineering", NULL, cAddress, "tx1");

    expect(issueSorobanAsset).toHaveBeenCalledWith(cAddress, { code: "XLM", issuer: "", amount: "10" });
    expect(issuePayment).not.toHaveBeenCalled();
    expect(issueClaimableBalance).not.toHaveBeenCalled();
    expect(res.txHash).toBe("SOROTX");
  });

  it("passes sponsor option when USE_CHANNELS is enabled", async () => {
    (env as { USE_CHANNELS: boolean }).USE_CHANNELS = true;
    gateFindUnique.mockResolvedValue(gate("CLAIMABLE_BALANCE"));
    verificationFindFirst.mockResolvedValue(verified);
    claimFindUnique.mockResolvedValue(null);
    issueClaimableBalance.mockResolvedValue({ txHash: "CBTX" });
    claimCreate.mockResolvedValue({});

    const res = await claimGate("data-engineering", NULL, "GHOLDER", "tx1");

    expect(issueClaimableBalance).toHaveBeenCalledWith(
      "GHOLDER",
      { code: "ZELYO", issuer: "GISSUER", amount: "1" },
      { sponsor: "channels" },
    );
    expect(res.txHash).toBe("CBTX");
    (env as { USE_CHANNELS: boolean }).USE_CHANNELS = false;
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

  it("rejects a second claim for the same nullifier (one proof, one reward)", async () => {
    gateFindUnique.mockResolvedValue(gate("CLAIMABLE_BALANCE"));
    verificationFindFirst.mockResolvedValue(verified);
    claimFindUnique.mockResolvedValue({
      txHash: "OLDTX",
      createdAt: new Date("2026-07-01T00:00:00Z"),
    });

    await expect(claimGate("data-engineering", NULL, "GHOLDER", "tx1")).rejects.toMatchObject({
      code: "ALREADY_CLAIMED",
      httpStatus: 409,
      details: {
        txHash: "OLDTX",
        explorerUrl: "https://explorer.test/tx/OLDTX",
        claimedAt: "2026-07-01T00:00:00.000Z",
      },
    });
    expect(issueClaimableBalance).not.toHaveBeenCalled();
    expect(claimCreate).not.toHaveBeenCalled();
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
