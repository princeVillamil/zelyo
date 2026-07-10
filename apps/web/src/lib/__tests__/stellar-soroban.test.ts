import { describe, it, expect, vi, beforeEach } from "vitest";

const sendTransaction = vi.fn(async () => ({ hash: "TXHASH123", status: "PENDING" }));
const getTransaction = vi.fn(async () => ({ status: "SUCCESS" }));
const prepareTransaction = vi.fn(async (tx: unknown) => tx);
const getAccount = vi.fn(async () => ({ accountId: () => "GISSUER", sequenceNumber: () => "1" }));

let lastContractCall: { method: string; args: unknown[] } | null = null;

vi.mock("@stellar/stellar-sdk", () => {
  class MockContract {
    constructor(public id: string) {}
    call(method: string, ...args: unknown[]) {
      lastContractCall = { method, args };
      return { type: "invokeContract" };
    }
  }
  class MockAddress {
    constructor(public a: string) {}
    toScVal() {
      return { address: this.a };
    }
  }
  return {
    rpc: {
      Server: class {
        getAccount = getAccount;
        prepareTransaction = prepareTransaction;
        sendTransaction = sendTransaction;
        getTransaction = getTransaction;
      },
    },
    Keypair: { fromSecret: () => ({ publicKey: () => "GISSUER", sign: vi.fn() }) },
    Contract: MockContract,
    Asset: class MockAsset {
      constructor(public code: string, public issuer?: string) {}
      static native() {
        return new MockAsset("XLM", undefined);
      }
      contractId(_networkPassphrase: string) {
        return `SAC:${this.code}:${this.issuer ?? "native"}`;
      }
    },
    TransactionBuilder: class {
      addOperation() {
        return this;
      }
      setTimeout() {
        return this;
      }
      build() {
        return { sign: vi.fn(), hash: () => Buffer.alloc(32) };
      }
    },
    BASE_FEE: "100",
    Address: MockAddress,
    nativeToScVal: (v: unknown, opts?: { type?: string }) => ({ value: v, type: opts?.type }),
  };
});

vi.mock("../env", () => ({
  env: {
    SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
    NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    ISSUER_SECRET: "SISSUERSECRET",
    ISSUER_STELLAR_ACCOUNT: "GISSUER",
    CREDENTIAL_REGISTRY_CONTRACT_ID: "CREGISTRY",
  },
}));

describe("stellar helpers", () => {
  it("detects C... contract addresses", async () => {
    const { isContractAddress } = await import("../stellar");
    expect(isContractAddress(`C${"A".repeat(55)}`)).toBe(true);
    expect(isContractAddress("GASTINUANRYSHXSWZNAGDKYNISWSP4ZCDC534OVIA7IE272OIWSSQZGJ")).toBe(false);
    expect(isContractAddress("notanaddress")).toBe(false);
  });

  it("converts amounts to stroops", async () => {
    const { toStroops } = await import("../stellar");
    expect(toStroops("1")).toBe(10_000_000n);
    expect(toStroops("0.5")).toBe(5_000_000n);
    expect(toStroops("12.3456789")).toBe(123_456_789n);
    expect(toStroops("-2.5")).toBe(-25_000_000n);
  });
});

describe("issueSorobanAsset", () => {
  beforeEach(() => {
    sendTransaction.mockClear();
    lastContractCall = null;
  });

  it("uses SAC mint for assets issued by the Zelyo issuer", async () => {
    const { issueSorobanAsset } = await import("../stellar");
    const cAddress = `C${"A".repeat(55)}`;
    await issueSorobanAsset(cAddress, { code: "ZELYO", issuer: "GISSUER", amount: "2.5" });

    expect(lastContractCall).not.toBeNull();
    expect(lastContractCall?.method).toBe("mint");
    expect(lastContractCall?.args[0]).toEqual({ address: cAddress });
    expect(lastContractCall?.args[1]).toEqual({ value: 25_000_000n, type: "i128" });
    expect(sendTransaction).toHaveBeenCalledTimes(1);
  });

  it("uses SAC transfer for non-issuer assets", async () => {
    const { issueSorobanAsset } = await import("../stellar");
    const cAddress = `C${"A".repeat(55)}`;
    await issueSorobanAsset(cAddress, { code: "USDC", issuer: "GOTHERISSUER", amount: "10" });

    expect(lastContractCall?.method).toBe("transfer");
    expect(lastContractCall?.args[0]).toEqual({ address: "GISSUER" });
    expect(lastContractCall?.args[1]).toEqual({ address: cAddress });
    expect(lastContractCall?.args[2]).toEqual({ value: 100_000_000n, type: "i128" });
  });
});
