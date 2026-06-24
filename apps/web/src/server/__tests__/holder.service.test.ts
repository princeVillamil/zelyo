import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("../../lib/db", () => ({ db: { user: { create } } }));
vi.mock("@node-rs/argon2", () => ({ hash: vi.fn(async () => "$argon2id$h"), Algorithm: { Argon2id: 2 } }));

describe("registerHolder", () => {
  beforeEach(() => create.mockReset());

  it("creates a HOLDER with a hashed password (never plaintext)", async () => {
    create.mockResolvedValueOnce({ id: "u9", username: "alice" });
    const { registerHolder } = await import("../holder.service");
    const res = await registerHolder({ username: "alice", password: "supersecret" });
    expect(res).toEqual({ id: "u9", username: "alice" });
    const arg = create.mock.calls[0]![0].data;
    expect(arg.role).toBe("HOLDER");
    expect(arg.passwordHash).toBe("$argon2id$h");
    expect(JSON.stringify(arg)).not.toContain("supersecret");
  });

  it("maps a unique-violation to USERNAME_TAKEN 409", async () => {
    create.mockRejectedValueOnce({ code: "P2002" });
    const { registerHolder } = await import("../holder.service");
    await expect(registerHolder({ username: "bob", password: "supersecret" })).rejects.toMatchObject({
      code: "USERNAME_TAKEN",
      httpStatus: 409,
    });
  });
});
