import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RegistryCard } from "../RegistryCard";

describe("RegistryCard", () => {
  it("renders a ledger-entry label, title, and an evergreen spine when asked", () => {
    render(
      <RegistryCard label="Registry Entry No. 4,102" title="Data Engineering" spine>
        body
      </RegistryCard>,
    );
    expect(screen.getByText("Registry Entry No. 4,102").className).toContain("uppercase");
    expect(screen.getByText("Data Engineering")).toBeInTheDocument();
    const card = screen.getByText("Data Engineering").closest("article");
    expect(card?.className).toContain("border-l-2");
    // left-only spine in primary (border-l-primary); other borders stay outline-variant
    expect(card?.className).toContain("border-l-primary");
  });
});
