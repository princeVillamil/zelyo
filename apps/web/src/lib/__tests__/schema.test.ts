// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const schema = readFileSync(
  fileURLToPath(new URL("../../../prisma/schema.prisma", import.meta.url)),
  "utf8",
);
const prismaConfig = readFileSync(
  fileURLToPath(new URL("../../../prisma.config.ts", import.meta.url)),
  "utf8",
);

describe("prisma schema", () => {
  it("uses postgres; migration URL lives in prisma.config.ts (Prisma 7)", () => {
    expect(schema).toContain('provider = "postgresql"');
    // Prisma 7 moved connection URLs out of the schema into prisma.config.ts.
    expect(prismaConfig).toContain("DIRECT_URL");
    expect(prismaConfig).toContain("datasource");
  });
  it("declares all SPEC §9 enums and models", () => {
    for (const e of ["enum Role", "enum CredentialStatus", "enum VerificationResult"]) {
      expect(schema, e).toContain(e);
    }
    for (const m of [
      "model User",
      "model Issuer",
      "model HolderKey",
      "model MerkleTree",
      "model Leaf",
      "model RootHistory",
      "model Credential",
      "model Nullifier",
      "model Verification",
      "model JobGate",
      "model GateClaim",
      "model AuditLog",
    ]) {
      expect(schema, m).toContain(m);
    }
  });
  it("mirrors the VerificationResult contract variants", () => {
    expect(schema).toContain("VERIFIED");
    expect(schema).toContain("NULLIFIER_USED");
    expect(schema).toContain("UNKNOWN_ROOT");
    expect(schema).toContain("INVALID_PROOF");
  });
});
