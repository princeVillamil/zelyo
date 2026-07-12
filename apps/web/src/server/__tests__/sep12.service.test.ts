import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  sep12FindUnique,
  sep12FindMany,
  sep12Upsert,
  sep12Create,
  verificationFindUnique,
} = vi.hoisted(() => ({
  sep12FindUnique: vi.fn(),
  sep12FindMany: vi.fn(),
  sep12Upsert: vi.fn(),
  sep12Create: vi.fn(),
  verificationFindUnique: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  db: {
    sep12Customer: {
      findUnique: sep12FindUnique,
      findMany: sep12FindMany,
      upsert: sep12Upsert,
      create: sep12Create,
    },
    verification: { findUnique: verificationFindUnique },
  },
}));

import { getCustomer, putCustomer } from "../sep12.service";
import { AppError } from "@/lib/errors";

const ACCOUNT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const OTHER_ACCOUNT = "GASTINUANRYSHXSWZNAGDKYNISWSP4ZCDC534OVIA7IE272OIWSSQZGJ";

beforeEach(() => {
  for (const m of [sep12FindUnique, sep12FindMany, sep12Upsert, sep12Create, verificationFindUnique]) {
    m.mockReset();
  }
});

describe("getCustomer", () => {
  it("returns NEEDS_INFO when no customer exists", async () => {
    sep12FindMany.mockResolvedValue([]);

    const res = await getCustomer({ account: ACCOUNT });

    expect(res.status).toBe("NEEDS_INFO");
    expect(res.fields?.verification_id?.status).toBe("VERIFICATION_REQUIRED");
  });

  it("returns ACCEPTED for an accepted customer looked up by id", async () => {
    sep12FindUnique.mockResolvedValue({
      id: "c1",
      status: "ACCEPTED",
      memo: null,
      memoType: null,
    });

    const res = await getCustomer({ id: "c1" });

    expect(res.status).toBe("ACCEPTED");
    expect(res.provided_fields?.verification_id?.status).toBe("ACCEPTED");
  });

  it("returns NEEDS_INFO for a pending customer", async () => {
    sep12FindUnique.mockResolvedValue({
      id: "c1",
      status: "NEEDS_INFO",
      memo: null,
      memoType: null,
    });

    const res = await getCustomer({ id: "c1" });

    expect(res.status).toBe("NEEDS_INFO");
    expect(res.fields?.verification_id?.status).toBe("VERIFICATION_REQUIRED");
  });
});

describe("putCustomer", () => {
  it("creates an ACCEPTED customer when verification is valid and bound to the account", async () => {
    verificationFindUnique.mockResolvedValue({
      id: "v1",
      result: "VERIFIED",
      boundStellarAddress: ACCOUNT,
    });
    sep12FindMany.mockResolvedValue([]);
    sep12Upsert.mockResolvedValue({
      id: "c1",
      status: "ACCEPTED",
      stellarAccount: ACCOUNT,
      verificationId: "v1",
    });

    const res = await putCustomer({ account: ACCOUNT, verification_id: "v1" });

    expect(res.status).toBe("ACCEPTED");
    expect(sep12Upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ stellarAccount: ACCOUNT, status: "ACCEPTED" }),
      }),
    );
  });

  it("rejects when verification is not VERIFIED", async () => {
    verificationFindUnique.mockResolvedValue({
      id: "v1",
      result: "INVALID_PROOF",
      boundStellarAddress: ACCOUNT,
    });

    await expect(putCustomer({ account: ACCOUNT, verification_id: "v1" })).rejects.toThrow(AppError);
  });

  it("rejects when verification is bound to a different account", async () => {
    verificationFindUnique.mockResolvedValue({
      id: "v1",
      result: "VERIFIED",
      boundStellarAddress: OTHER_ACCOUNT,
    });

    await expect(putCustomer({ account: ACCOUNT, verification_id: "v1" })).rejects.toThrow(AppError);
  });

  it("creates NEEDS_INFO customer when no verification_id is provided", async () => {
    sep12FindMany.mockResolvedValue([]);
    sep12Create.mockResolvedValue({ id: "c1", status: "NEEDS_INFO" });

    const res = await putCustomer({ account: ACCOUNT });

    expect(res.status).toBe("NEEDS_INFO");
    expect(sep12Create).toHaveBeenCalled();
  });
});
