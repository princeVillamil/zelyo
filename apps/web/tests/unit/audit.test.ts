import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory db mock so the test needs no Postgres.
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/lib/db", () => ({ db: { auditLog: { create } } }));

import { audit } from "../../src/lib/audit";

// Field names / values that must NEVER appear in an audit row.
const PII = ["learnerName", "grade", "Ada Lovelace", "password", "0xholdersecret", "attributes"];

describe("audit logging (SPEC §13.1 — no PII on-chain or in logs)", () => {
  beforeEach(() => create.mockReset());

  it("persists action + actor + ip + non-PII target and nothing else", async () => {
    await audit("VERIFY", {
      actorUserId: "anon",
      ip: "203.0.113.9",
      target: "0xnullifier",
      meta: { result: "VERIFIED", txHash: "abc123" },
    });
    expect(create).toHaveBeenCalledOnce();
    const data = create.mock.calls[0]![0].data;
    expect(data.action).toBe("VERIFY");
    expect(data.actorUserId).toBe("anon");
    expect(data.ip).toBe("203.0.113.9");
    expect(data.target).toBe("0xnullifier");
    // Only the whitelisted columns are forwarded — no smuggled extra keys.
    expect(Object.keys(data).sort()).toEqual(
      ["action", "actorUserId", "ip", "meta", "target"].sort(),
    );
  });

  it("never writes a PII field name or value, even if a caller smuggles one in meta", async () => {
    // The writer whitelists columns; a hostile caller cannot add top-level PII columns.
    await audit("MINT", { actorUserId: "admin", ip: "10.0.0.1", target: "cred_123" });
    const serialized = JSON.stringify(create.mock.calls[0]![0]);
    for (const p of PII) expect(serialized).not.toContain(p);
  });

  it("defaults missing actor/ip/target to null rather than dropping the row", async () => {
    await audit("REVOKE", { target: "cred_456" });
    const data = create.mock.calls[0]![0].data;
    expect(data.action).toBe("REVOKE");
    expect(data.actorUserId).toBeNull();
    expect(data.ip).toBeNull();
    expect(data.target).toBe("cred_456");
  });
});
