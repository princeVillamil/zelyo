import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RevealNarrative } from "../RevealNarrative";

describe("RevealNarrative", () => {
  it("renders the three reveals", () => {
    render(<RevealNarrative />);
    expect(screen.getByText(/nothing personal on-chain/i)).toBeInTheDocument();
    expect(screen.getByText(/one credential, one registration/i)).toBeInTheDocument();
    expect(screen.getByText(/selective disclosure/i)).toBeInTheDocument();
  });

  it("links to the three roles", () => {
    render(<RevealNarrative />);
    expect(screen.getByRole("link", { name: /issue a credential/i })).toHaveAttribute("href", "/issuer");
    expect(screen.getByRole("link", { name: /open your wallet/i })).toHaveAttribute("href", "/wallet");
    expect(screen.getByRole("link", { name: /browse the gates/i })).toHaveAttribute("href", "/jobs");
  });
});
