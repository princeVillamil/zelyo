import { describe, it, expect, vi, beforeEach } from "vitest";

const sendTransaction = vi.fn(async () => ({ hash: "TXHASH123", status: "PENDING" }));
const getTransaction = vi.fn(async () => ({ status: "SUCCESS" }));
const prepareTransaction = vi.fn(async (tx: unknown) => tx);
const getAccount = vi.fn(async () => ({ accountId: () => "GISSUER", sequenceNumber: () => "1" }));

vi.mock("@stellar/stellar-sdk", () => {
  class Server {
    getAccount = getAccount;
    prepareTransaction = prepareTransaction;
    sendTransaction = sendTransaction;
    getTransaction = getTransaction;
  }
  return {
    rpc: { Server },
    Keypair: { fromSecret: () => ({ publicKey: () => "GISSUER", sign: vi.fn() }) },
    Contract: class { constructor(public id: string) {} call() { return {}; } },
    TransactionBuilder: class {
      addOperation() { return this; }
      setTimeout() { return this; }
      build() { return { sign: vi.fn(), hash: () => Buffer.alloc(32) }; }
    },
    BASE_FEE: "100",
    Networks: { TESTNET: "Test SDF Network ; September 2015" },
    nativeToScVal: (v: unknown) => v,
    Address: class { constructor(public a: string) {} toScVal() { return {}; } },
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

describe("stellar.publishRoot", () => {
  beforeEach(() => { sendTransaction.mockClear(); });

  it("converts a 0x root to 32 bytes", async () => {
    const { hexToBytes32 } = await import("../stellar");
    const buf = hexToBytes32(("0x" + "ab".repeat(32)) as never);
    expect(buf.length).toBe(32);
    expect(buf[0]).toBe(0xab);
  });

  it("signs and submits set_root and returns the tx hash", async () => {
    const { publishRoot } = await import("../stellar");
    const res = await publishRoot(("0x" + "01".repeat(32)) as never);
    expect(res.txHash).toBe("TXHASH123");
    expect(sendTransaction).toHaveBeenCalledTimes(1);
  });
});
