import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "../StatusPill";

describe("StatusPill", () => {
  it("renders an uppercase status label and an error tone", () => {
    render(<StatusPill label="Status: Authenticated" />);
    const ok = screen.getByText("Status: Authenticated");
    expect(ok.className).toContain("uppercase");

    render(<StatusPill label="Nullifier Used" tone="error" />);
    expect(screen.getByText("Nullifier Used").className).toContain("text-error");
  });
});
