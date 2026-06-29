import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProofBundle, FieldHex } from "@zelyo/zk-shared";

vi.mock("@/lib/stellar", () => ({
  ContractError: class ContractError extends Error {
    constructor(public contractError: string) { super(contractError); }
  },
  explorerTxUrl: (h: string) => `https://explorer.test/tx/${h}`,
  isRootValid: vi.fn(),
  isNullifierUsed: vi.fn(),
  submitVerifyAndRegister: vi.fn(),
  submitRegister: vi.fn(),
  verifyProofOffchain: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: { ZK_VERIFY_MODE: "onchain", NEXT_PUBLIC_EXPLORER_BASE: "https://explorer.test", LOG_LEVEL: "silent" } }));
vi.mock("@/lib/db", () => ({
  db: {
    nullifier: { create: vi.fn().mockResolvedValue({}) },
    verification: { create: vi.fn().mockResolvedValue({}) },
  },
}));

import { verifyAndRegister } from "./verification.service";
import * as stellar from "@/lib/stellar";
import { env } from "@/lib/env";

const bundle = {
  proof: new Uint8Array([1]),
  publicInputs: {
    root: ("0x" + "ab".repeat(32)) as FieldHex,
    scope: ("0x" + "cd".repeat(32)) as FieldHex,
    boundAddress: ("0x" + "ef".repeat(32)) as FieldHex,
    nullifier: ("0x" + "12".repeat(32)) as FieldHex,
    disclosed: ("0x" + "34".repeat(32)) as FieldHex,
  },
};
const boundStellarAddress = "GASTINUANRYSHXSWZNAGDKYNISWSP4ZCDC534OVIA7IE272OIWSSQZGJ";
const input = { ...bundle, boundStellarAddress };

beforeEach(() => vi.clearAllMocks());

describe("verifyAndRegister", () => {
  it("UNKNOWN_ROOT when root not in valid history (fast fail, no submit)", async () => {
    vi.mocked(stellar.isRootValid).mockResolvedValue(false);
    const r = await verifyAndRegister(input);
    expect(r).toMatchObject({ ok: false, result: "UNKNOWN_ROOT" });
    expect(stellar.submitVerifyAndRegister).not.toHaveBeenCalled();
    expect(stellar.submitRegister).not.toHaveBeenCalled();
  });

  it("NULLIFIER_USED on the pre-check (mirror already has it)", async () => {
    vi.mocked(stellar.isRootValid).mockResolvedValue(true);
    vi.mocked(stellar.isNullifierUsed).mockResolvedValue(true);
    const r = await verifyAndRegister(input);
    expect(r).toMatchObject({ ok: false, result: "NULLIFIER_USED" });
    expect(stellar.submitVerifyAndRegister).not.toHaveBeenCalled();
    expect(stellar.submitRegister).not.toHaveBeenCalled();
  });

  it("VERIFIED on Path A success → mirrors + returns txHash/explorerUrl", async () => {
    vi.mocked(stellar.isRootValid).mockResolvedValue(true);
    vi.mocked(stellar.isNullifierUsed).mockResolvedValue(false);
    vi.mocked(stellar.submitVerifyAndRegister).mockResolvedValue({ txHash: "TX123" });
    const r = await verifyAndRegister(input);
    expect(r).toEqual({ ok: true, result: "VERIFIED", txHash: "TX123", explorerUrl: "https://explorer.test/tx/TX123" });
  });

  it("NULLIFIER_USED when the contract reverts (Sybil block at submit)", async () => {
    vi.mocked(stellar.isRootValid).mockResolvedValue(true);
    vi.mocked(stellar.isNullifierUsed).mockResolvedValue(false);
    vi.mocked(stellar.submitVerifyAndRegister).mockRejectedValue(new stellar.ContractError("NullifierUsed"));
    const r = await verifyAndRegister(input);
    expect(r).toMatchObject({ ok: false, result: "NULLIFIER_USED" });
  });

  it("INVALID_PROOF when the contract reports an invalid proof", async () => {
    vi.mocked(stellar.isRootValid).mockResolvedValue(true);
    vi.mocked(stellar.isNullifierUsed).mockResolvedValue(false);
    vi.mocked(stellar.submitVerifyAndRegister).mockRejectedValue(new stellar.ContractError("InvalidProof"));
    const r = await verifyAndRegister(input);
    expect(r).toMatchObject({ ok: false, result: "INVALID_PROOF" });
  });

  it("Path B: verifies off-chain then registers", async () => {
    (env as { ZK_VERIFY_MODE: string }).ZK_VERIFY_MODE = "server";
    vi.mocked(stellar.isRootValid).mockResolvedValue(true);
    vi.mocked(stellar.isNullifierUsed).mockResolvedValue(false);
    vi.mocked(stellar.verifyProofOffchain).mockResolvedValue(true);
    vi.mocked(stellar.submitRegister).mockResolvedValue({ txHash: "TXB" });
    const r = await verifyAndRegister(input);
    expect(stellar.verifyProofOffchain).toHaveBeenCalledOnce();
    expect(stellar.submitRegister).toHaveBeenCalledWith(bundle.publicInputs, boundStellarAddress);
    expect(r).toMatchObject({ ok: true, result: "VERIFIED", txHash: "TXB" });
    (env as { ZK_VERIFY_MODE: string }).ZK_VERIFY_MODE = "onchain";
  });

  it("Path B: INVALID_PROOF when off-chain verify fails (no register)", async () => {
    (env as { ZK_VERIFY_MODE: string }).ZK_VERIFY_MODE = "server";
    vi.mocked(stellar.isRootValid).mockResolvedValue(true);
    vi.mocked(stellar.isNullifierUsed).mockResolvedValue(false);
    vi.mocked(stellar.verifyProofOffchain).mockResolvedValue(false);
    const r = await verifyAndRegister(input);
    expect(r).toMatchObject({ ok: false, result: "INVALID_PROOF" });
    expect(stellar.submitRegister).not.toHaveBeenCalled();
    (env as { ZK_VERIFY_MODE: string }).ZK_VERIFY_MODE = "onchain";
  });

  it("ERROR on unexpected failure", async () => {
    vi.mocked(stellar.isRootValid).mockRejectedValue(new Error("rpc down"));
    const r = await verifyAndRegister(input);
    expect(r).toMatchObject({ ok: false, result: "ERROR" });
  });
});
