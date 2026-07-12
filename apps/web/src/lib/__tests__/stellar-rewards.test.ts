import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  submitTransaction,
  loadAccount,
  createClaimableBalance,
  payment,
  pathPaymentStrictSend,
  strictSendPathsCall,
  submitSponsored,
} = vi.hoisted(() => ({
  submitTransaction: vi.fn(),
  loadAccount: vi.fn(),
  createClaimableBalance: vi.fn(() => ({ __op: "cb" })),
  payment: vi.fn(() => ({ __op: "payment" })),
  pathPaymentStrictSend: vi.fn(() => ({ __op: "pathpay" })),
  strictSendPathsCall: vi.fn(),
  submitSponsored: vi.fn().mockResolvedValue({ hash: "LAUNCHHASH" }),
}));

vi.mock("../channels", () => ({
  submitSponsored,
}));

vi.mock("@stellar/stellar-sdk", () => {
  class HorizonServer {
    loadAccount = loadAccount;
    submitTransaction = submitTransaction;
    strictSendPaths = vi.fn(() => ({ call: strictSendPathsCall }));
  }
  class RpcServer {
    getAccount = vi.fn().mockResolvedValue({ accountId: () => "GISSUER" });
    prepareTransaction = vi.fn(async (tx: unknown) => tx);
    sendTransaction = vi.fn().mockResolvedValue({ hash: "RPCTX" });
  }
  return {
    Horizon: { Server: HorizonServer },
    rpc: { Server: RpcServer },
    Asset: class {
      constructor(public code: string, public issuer: string) {}
      static native() {
        return { __native: true };
      }
    },
    Claimant: class {
      static predicateUnconditional() {
        return { __pred: true };
      }
      constructor(public destination: string, public predicate: unknown) {}
    },
    Contract: class {
      constructor(public id: string) {}
      call() {
        return { __op: "call" };
      }
    },
    Address: class {
      constructor(public addr: string) {}
      toScVal() {
        return { __scval: this.addr };
      }
    },
    nativeToScVal: (v: unknown) => ({ __scval: v }),
    Operation: { createClaimableBalance, payment, pathPaymentStrictSend },
    Keypair: { fromSecret: () => ({ publicKey: () => "GISSUER" }) },
    TransactionBuilder: class {
      addOperation() {
        return this;
      }
      setTimeout() {
        return this;
      }
      build() {
        return { sign: vi.fn(), hash: () => Buffer.from("hh"), toEnvelope: () => ({ toXDR: () => "MOCKXDR" }) };
      }
    },
    BASE_FEE: "100",
    Networks: { TESTNET: "Test SDF Network ; September 2015" },
  };
});

vi.mock("../env", () => ({
  env: {
    ISSUER_SECRET: "SAAA",
    HORIZON_URL: "https://horizon.test",
    NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    SOROBAN_RPC_URL: "https://rpc.test",
    CREDENTIAL_REGISTRY_CONTRACT_ID: "CCCC",
    SDEX_RECEIVE_ASSETS: "USDC:GUSDC, EURC:GEURC",
  },
}));

import { issueClaimableBalance, issuePayment, issuePathPayment, isReceiveAssetChoice, listReceiveAssetChoices } from "../stellar";

beforeEach(() => {
  submitTransaction.mockReset();
  submitSponsored.mockClear();
  submitSponsored.mockResolvedValue({ hash: "LAUNCHHASH" });
  loadAccount.mockReset();
  createClaimableBalance.mockClear();
  payment.mockClear();
  pathPaymentStrictSend.mockClear();
  strictSendPathsCall.mockReset();
});

describe("issueClaimableBalance", () => {
  it("builds a createClaimableBalance op to boundAddress and returns the tx hash", async () => {
    loadAccount.mockResolvedValue({ accountId: () => "GISSUER" });
    submitTransaction.mockResolvedValue({ hash: "TXHASH123" });
    const res = await issueClaimableBalance("GHOLDER", {
      code: "ZELYO",
      issuer: "GISSUER",
      amount: "1",
    });
    expect(createClaimableBalance).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ txHash: "TXHASH123" });
  });

  it("uses the native asset when the reward has no issuer (XLM)", async () => {
    loadAccount.mockResolvedValue({ accountId: () => "GISSUER" });
    submitTransaction.mockResolvedValue({ hash: "NATIVETX" });
    const res = await issueClaimableBalance("GHOLDER", { code: "XLM", issuer: "", amount: "10" });
    // Native XLM must go through Asset.native(), not `new Asset("XLM", "")`.
    const calls = createClaimableBalance.mock.calls as unknown as Array<[{ asset: unknown }]>;
    expect(calls[0]?.[0]?.asset).toEqual({ __native: true });
    expect(res).toEqual({ txHash: "NATIVETX" });
  });

  it("submits via OpenZeppelin Channels when sponsor option is set", async () => {
    loadAccount.mockResolvedValue({ accountId: () => "GISSUER" });
    const res = await issueClaimableBalance("GHOLDER", { code: "ZELYO", issuer: "GISSUER", amount: "1" }, { sponsor: "channels" });
    expect(submitSponsored).toHaveBeenCalledTimes(1);
    expect(submitTransaction).not.toHaveBeenCalled();
    expect(res).toEqual({ txHash: "LAUNCHHASH" });
  });
});

describe("issuePayment", () => {
  it("builds a payment op to boundAddress and returns the tx hash", async () => {
    loadAccount.mockResolvedValue({ accountId: () => "GISSUER" });
    submitTransaction.mockResolvedValue({ hash: "PAYTX" });
    const res = await issuePayment("GHOLDER", { code: "XLM", issuer: "", amount: "10" });
    expect(payment).toHaveBeenCalledTimes(1);
    const calls = payment.mock.calls as unknown as Array<[{ destination: string; amount: string; asset: unknown }]>;
    expect(calls[0]?.[0]?.destination).toBe("GHOLDER");
    expect(calls[0]?.[0]?.amount).toBe("10");
    expect(calls[0]?.[0]?.asset).toEqual({ __native: true });
    expect(res).toEqual({ txHash: "PAYTX" });
  });

  it("submits via OpenZeppelin Channels when sponsor option is set", async () => {
    loadAccount.mockResolvedValue({ accountId: () => "GISSUER" });
    const res = await issuePayment("GHOLDER", { code: "XLM", issuer: "", amount: "10" }, { sponsor: "channels" });
    expect(submitSponsored).toHaveBeenCalledTimes(1);
    expect(submitTransaction).not.toHaveBeenCalled();
    expect(res).toEqual({ txHash: "LAUNCHHASH" });
  });
});

describe("issuePathPayment", () => {
  it("builds a strict-send path payment with a 1% slippage floor from the best path", async () => {
    loadAccount.mockResolvedValue({ accountId: () => "GISSUER" });
    strictSendPathsCall.mockResolvedValue({
      records: [
        {
          destination_amount: "9.5000000",
          path: [{ asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GUSDC" }],
        },
      ],
    });
    submitTransaction.mockResolvedValue({ hash: "PATHTX" });

    const res = await issuePathPayment(
      "GHOLDER",
      { code: "XLM", issuer: "", amount: "10" },
      { code: "USDC", issuer: "GUSDC" },
    );

    expect(pathPaymentStrictSend).toHaveBeenCalledTimes(1);
    const calls = pathPaymentStrictSend.mock.calls as unknown as Array<
      [{ destination: string; sendAmount: string; destMin: string; sendAsset: unknown; path: unknown[] }]
    >;
    expect(calls[0]?.[0]?.destination).toBe("GHOLDER");
    expect(calls[0]?.[0]?.sendAmount).toBe("10");
    expect(calls[0]?.[0]?.destMin).toBe("9.4050000"); // 9.5 × 0.99
    expect(calls[0]?.[0]?.sendAsset).toEqual({ __native: true });
    expect(calls[0]?.[0]?.path).toHaveLength(1);
    expect(res).toEqual({ txHash: "PATHTX" });
  });

  it("throws when the SDEX has no path for the pair", async () => {
    loadAccount.mockResolvedValue({ accountId: () => "GISSUER" });
    strictSendPathsCall.mockResolvedValue({ records: [] });

    await expect(
      issuePathPayment("GHOLDER", { code: "XLM", issuer: "", amount: "10" }, { code: "USDC", issuer: "GUSDC" }),
    ).rejects.toThrow(/no sdex path/i);
    expect(submitTransaction).not.toHaveBeenCalled();
  });
});

describe("receive-asset whitelist", () => {
  it("parses SDEX_RECEIVE_ASSETS into choices and validates membership", () => {
    expect(listReceiveAssetChoices()).toEqual([
      { code: "USDC", issuer: "GUSDC" },
      { code: "EURC", issuer: "GEURC" },
    ]);
    expect(isReceiveAssetChoice({ code: "USDC", issuer: "GUSDC" })).toBe(true);
    expect(isReceiveAssetChoice({ code: "USDC", issuer: "GWRONG" })).toBe(false);
    expect(isReceiveAssetChoice({ code: "SCAM", issuer: "GUSDC" })).toBe(false);
  });
});
