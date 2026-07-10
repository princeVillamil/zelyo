import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  submitTransaction,
  loadAccount,
  createClaimableBalance,
  payment,
  submitSponsored,
} = vi.hoisted(() => ({
  submitTransaction: vi.fn(),
  loadAccount: vi.fn(),
  createClaimableBalance: vi.fn(() => ({ __op: "cb" })),
  payment: vi.fn(() => ({ __op: "payment" })),
  submitSponsored: vi.fn().mockResolvedValue({ hash: "LAUNCHHASH" }),
}));

vi.mock("../channels", () => ({
  submitSponsored,
}));

vi.mock("@stellar/stellar-sdk", () => {
  class HorizonServer {
    loadAccount = loadAccount;
    submitTransaction = submitTransaction;
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
    Operation: { createClaimableBalance, payment },
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
  },
}));

import { issueClaimableBalance, issuePayment } from "../stellar";

beforeEach(() => {
  submitTransaction.mockReset();
  submitSponsored.mockClear();
  submitSponsored.mockResolvedValue({ hash: "LAUNCHHASH" });
  loadAccount.mockReset();
  createClaimableBalance.mockClear();
  payment.mockClear();
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
