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
    // card keeps the dark foil-stamp surface with manuscript glow
    const card = screen.getByText(/Identity Folio No\. 882/).closest("article");
    expect(card?.className).toContain("foil-stamp");
    expect(card?.className).toContain("manuscript-glow");
    expect(card?.className).not.toContain("rounded-full");
  });

  it("links to the credential detail and the prove flow", () => {
    render(<CredentialCard credential={credential} signatureHash={"0x" + "ab".repeat(32)} />);
    expect(screen.getByRole("link", { name: /details/i })).toHaveAttribute("href", "/wallet/credentials/c1");
    expect(screen.getByRole("link", { name: /prove/i })).toHaveAttribute("href", "/wallet/prove/c1");
  });

  it("flags an orphaned credential and disables Prove", () => {
    render(<CredentialCard credential={credential} signatureHash={"0x" + "ab".repeat(32)} orphaned />);
    expect(screen.getByText(/previous identity/i)).toBeInTheDocument();
    // Prove is no longer a navigable link.
    expect(screen.queryByRole("link", { name: /prove/i })).not.toBeInTheDocument();
    expect(screen.getByText(/^Prove$/)).toHaveAttribute("aria-disabled", "true");
  });

  it("shows a proven badge, a receipt link, and relabels Prove to Re-prove", () => {
    render(
      <CredentialCard
        credential={credential}
        signatureHash={"0x" + "ab".repeat(32)}
        proof={{ txHash: "tx123", disclosed: ["track"], provenAt: new Date("2026-06-30T00:00:00Z") }}
      />,
    );
    expect(screen.getByText(/Proven ✓/)).toBeInTheDocument();
    expect(screen.getByText(/revealed track/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view proof/i })).toHaveAttribute("href", "/verify/result/tx123");
    expect(screen.getByRole("link", { name: /^Re-prove$/ })).toHaveAttribute("href", "/wallet/prove/c1");
  });

  it("offers a one-click claim when an existing proof satisfies the gate", () => {
    render(
      <CredentialCard
        credential={credential}
        signatureHash={"0x" + "ab".repeat(32)}
        gate="data-engineering"
        proof={{ txHash: "tx123", disclosed: ["track"], provenAt: new Date("2026-06-30T00:00:00Z") }}
        claimHref="/jobs/data-engineering?txHash=tx123&nullifier=0xabc&address=GAAA"
      />,
    );
    // Primary CTA reuses the proof instead of re-proving.
    expect(screen.getByRole("link", { name: /use this proof to claim/i })).toHaveAttribute(
      "href",
      "/jobs/data-engineering?txHash=tx123&nullifier=0xabc&address=GAAA",
    );
    // Re-prove is still available as a secondary fallback (carries the gate context).
    expect(screen.getByRole("link", { name: /^Re-prove$/ })).toHaveAttribute(
      "href",
      "/wallet/prove/c1?gate=data-engineering",
    );
  });
});
