import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  submitTransaction,
  loadAccount,
  createClaimableBalance,
} = vi.hoisted(() => ({
  submitTransaction: vi.fn(),
  loadAccount: vi.fn(),
  createClaimableBalance: vi.fn(() => ({ __op: "cb" })),
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
    Operation: { createClaimableBalance },
    Keypair: { fromSecret: () => ({ publicKey: () => "GISSUER" }) },
    TransactionBuilder: class {
      addOperation() {
        return this;
      }
      setTimeout() {
        return this;
      }
      build() {
        return { sign: vi.fn(), hash: () => Buffer.from("hh") };
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

import { issueClaimableBalance } from "../stellar";

beforeEach(() => {
  submitTransaction.mockReset();
  loadAccount.mockReset();
  createClaimableBalance.mockClear();
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
});
