import { describe, it, expect, vi } from "vitest";

vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));
vi.mock("@prisma/client", () => {
  return { PrismaClient: class { $queryRaw = vi.fn(); $disconnect = vi.fn(); } };
});

describe("db singleton", () => {
  it("returns the same PrismaClient instance across imports", async () => {
    const a = (await import("../db")).db;
    const b = (await import("../db")).db;
    expect(a).toBe(b);
  });
});
