import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CredentialCard } from "./CredentialCard";

describe("CredentialCard", () => {
  const credential = {
    id: "c1",
    status: "ACTIVE" as const,
    issuerName: "Institute of Distributed Systems",
    attributes: { courseName: "Distributed Systems", track: "Data Engineering", issueDate: "2026-01-01", grade: "A", learnerName: "Ada" },
    leafIndex: 882,
  };

  it("renders course, issuer, date, status, and a truncated signature hash; hides grade/name", () => {
    render(<CredentialCard credential={credential} signatureHash={"0x" + "ab".repeat(32)} />);
    expect(screen.getByRole("heading", { name: "Distributed Systems" })).toBeInTheDocument();
    expect(screen.getByText(/Institute of Distributed Systems/)).toBeInTheDocument();
    expect(screen.getByText(/2026-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/ACTIVE/i)).toBeInTheDocument();
    expect(screen.getByText(/Identity Folio No\. 882/)).toBeInTheDocument();
    // signature hash is shown truncated (machine voice)
    expect(screen.getByText(/0xabababab/)).toBeInTheDocument();
    // PII is NOT rendered on the card
    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(screen.queryByText("Ada")).not.toBeInTheDocument();
  });

  it("links to the credential detail and the prove flow", () => {
    render(<CredentialCard credential={credential} signatureHash={"0x" + "ab".repeat(32)} />);
    expect(screen.getByRole("link", { name: /view/i })).toHaveAttribute("href", "/wallet/credentials/c1");
    expect(screen.getByRole("link", { name: /prove/i })).toHaveAttribute("href", "/wallet/prove/c1");
  });

  it("flags an orphaned credential and disables Prove", () => {
    render(<CredentialCard credential={credential} signatureHash={"0x" + "ab".repeat(32)} orphaned />);
    expect(screen.getByText(/previous identity/i)).toBeInTheDocument();
    // Prove is no longer a navigable link.
    expect(screen.queryByRole("link", { name: /prove/i })).not.toBeInTheDocument();
    expect(screen.getByText(/^Prove$/)).toHaveAttribute("aria-disabled", "true");
  });
});
