import { describe, it, expect } from "vitest";
import { buildLeaf, type Attributes, type FieldHex } from "@zelyo/zk-shared";
import { isCredentialOrphaned } from "./orphan";

const commitment = ("0x" + "11".repeat(32)) as FieldHex;
const other = ("0x" + "22".repeat(32)) as FieldHex;
const attributes: Attributes = {
  courseName: "Distributed Systems",
  track: "Data Engineering",
  issueDate: "2026-01-01",
  grade: "A",
  learnerName: "Ada",
};

describe("isCredentialOrphaned", () => {
  it("is false when the leaf matches the current commitment", () => {
    const leafHex = buildLeaf(commitment, attributes);
    expect(
      isCredentialOrphaned({ currentCommitment: commitment, status: "ACTIVE", attributes, leafHex }),
    ).toBe(false);
  });

  it("is true when the leaf was built from a different (previous) commitment", () => {
    const leafHex = buildLeaf(other, attributes);
    expect(
      isCredentialOrphaned({ currentCommitment: commitment, status: "ACTIVE", attributes, leafHex }),
    ).toBe(true);
  });

  it("never flags revoked credentials (their leaves are zeroed)", () => {
    expect(
      isCredentialOrphaned({
        currentCommitment: commitment,
        status: "REVOKED",
        attributes,
        leafHex: "0x" + "0".repeat(64),
      }),
    ).toBe(false);
  });

  it("is false when there is no current commitment yet", () => {
    const leafHex = buildLeaf(commitment, attributes);
    expect(
      isCredentialOrphaned({ currentCommitment: null, status: "ACTIVE", attributes, leafHex }),
    ).toBe(false);
  });

  it("treats unbuildable leaves (malformed attributes) as orphaned", () => {
    expect(
      isCredentialOrphaned({
        currentCommitment: commitment,
        status: "ACTIVE",
        attributes: null,
        leafHex: "0x" + "ab".repeat(32),
      }),
    ).toBe(true);
  });
});
