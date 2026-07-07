import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Asset,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const verificationFindFirst = vi.hoisted(() => vi.fn());
const signTransactionEnvelope = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: { verification: { findFirst: verificationFindFirst } },
}));

vi.mock("@/lib/env", () => ({
  env: {
    NETWORK_PASSPHRASE: Networks.TESTNET,
    ISSUER_STELLAR_ACCOUNT: "GC3G2JP6QNALD4SLSOMOCGTSQSXUUEPH7ZOROFVLSOP3J5IXU7QOO5QB",
    ISSUER_SECRET: "SDSW3KDBOU5VFBJEYRRGAW5PSX7BEH6GRUNI5JOM64FAPS5WZSOV3HMJ",
  },
}));

vi.mock("@/lib/stellar", () => ({
  signTransactionEnvelope,
}));

import { approveTransaction } from "@/server/sep8.service";

const ISSUER = "GC3G2JP6QNALD4SLSOMOCGTSQSXUUEPH7ZOROFVLSOP3J5IXU7QOO5QB";
const VERIFIED = "GDBQ66COQLZBID4KRUGPUJ44TRTCQT5ICW7LDRECR3C7FX3VVC6SKS54";
const UNVERIFIED = "GDDQR5JZS5HCZNP6LEK4ODJQSNTSC26WCTXDY6DAE75WRWP6FEXFUFST";
const OTHER_ISSUER = "GAGXJRYJTTRNII426YVOETKMSLQS7SS23HVN5NWEV5CUWZKWZTUB4LOS";

function makeSource(): ConstructorParameters<typeof TransactionBuilder>[0] {
  return {
    accountId: () => "GASTINUANRYSHXSWZNAGDKYNISWSP4ZCDC534OVIA7IE272OIWSSQZGJ",
    sequenceNumber: () => "0",
    incrementSequenceNumber: () => {},
  } as unknown as ConstructorParameters<typeof TransactionBuilder>[0];
}

function buildPaymentTx(destination: string, asset: Asset): string {
  const tx = new TransactionBuilder(makeSource(), {
    networkPassphrase: Networks.TESTNET,
    fee: "100",
  })
    .addOperation(Operation.payment({ destination, asset, amount: "1" }))
    .setTimeout(0)
    .build();
  return tx.toEnvelope().toXDR("base64");
}

function buildChangeTrustTx(): string {
  const tx = new TransactionBuilder(makeSource(), {
    networkPassphrase: Networks.TESTNET,
    fee: "100",
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset("ZELYO", ISSUER),
        limit: "1000",
      }),
    )
    .setTimeout(0)
    .build();
  return tx.toEnvelope().toXDR("base64");
}

function buildFeeBumpTx(): string {
  return "AAAABQAAAADHCPU5l04stf5ZFccNMJNnIWvWFO48eGAn+2jZ/ikuWgAAAAAAAAGQAAAAAgAAAAAlNDaAbHEj3lbLQGGrDUStJ/MiGLu+OqgH0E1/TkWlKAAAAGQAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAADDD3hOgvIUD4qNDPonnJxmKE+oFb6xxIKOxfLfdai9JQAAAAJaRUxZTwAAAAAAAAAAAAAAtm0l/oNAsfJLk5jhGnKEr0oR5/5dFxark5+09Ren4OcAAAAAAJiWgAAAAAAAAAAAAAAAAAAAAAA=";
}

beforeEach(() => {
  verificationFindFirst.mockReset();
  signTransactionEnvelope.mockReset();
});

describe("approveTransaction", () => {
  it("approves a regulated-asset payment to a verified address", async () => {
    const asset = new Asset("ZELYO", ISSUER);
    const tx = buildPaymentTx(VERIFIED, asset);

    verificationFindFirst.mockResolvedValue({ id: "v1", result: "VERIFIED" });
    signTransactionEnvelope.mockReturnValue("SIGNEDXDR");

    const result = await approveTransaction({ tx });

    expect(result).toEqual({ status: "approved", tx: "SIGNEDXDR" });
    expect(verificationFindFirst).toHaveBeenCalledWith({
      where: { boundStellarAddress: VERIFIED, result: "VERIFIED" },
      orderBy: { createdAt: "desc" },
    });
    expect(signTransactionEnvelope).toHaveBeenCalledWith(tx);
  });

  it("rejects a regulated-asset payment to an unverified address", async () => {
    const asset = new Asset("ZELYO", ISSUER);
    const tx = buildPaymentTx(UNVERIFIED, asset);

    verificationFindFirst.mockResolvedValue(null);

    const result = await approveTransaction({ tx });

    expect(result).toEqual({
      status: "rejected",
      error: "Destination is not Zelyo-verified.",
    });
    expect(signTransactionEnvelope).not.toHaveBeenCalled();
  });

  it("rejects a payment with a non-Zelyo-regulated asset", async () => {
    const asset = new Asset("OTHER", OTHER_ISSUER);
    const tx = buildPaymentTx(VERIFIED, asset);

    const result = await approveTransaction({ tx });

    expect(result).toEqual({
      status: "rejected",
      error: "Transaction includes a non-Zelyo-regulated asset.",
    });
    expect(verificationFindFirst).not.toHaveBeenCalled();
  });

  it("rejects when no regulated asset payment is present", async () => {
    const tx = buildPaymentTx(VERIFIED, Asset.native());

    const result = await approveTransaction({ tx });

    expect(result).toEqual({
      status: "rejected",
      error: "No regulated asset payment found.",
    });
    expect(verificationFindFirst).not.toHaveBeenCalled();
  });

  it("rejects unsupported operation types", async () => {
    const tx = buildChangeTrustTx();

    const result = await approveTransaction({ tx });

    expect(result).toEqual({
      status: "rejected",
      error: "Only payment operations are supported.",
    });
  });

  it("rejects fee-bump transactions", async () => {
    const tx = buildFeeBumpTx();

    const result = await approveTransaction({ tx });

    expect(result).toEqual({
      status: "rejected",
      error: "Fee-bump transactions are not supported for SEP-8 approval.",
    });
  });

  it("throws INVALID_INPUT for malformed XDR", async () => {
    await expect(approveTransaction({ tx: "not-valid-xdr" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});
