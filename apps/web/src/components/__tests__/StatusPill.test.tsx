import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "../StatusPill";

describe("StatusPill", () => {
  it("renders an uppercase status label and supports default/error/primary tones", () => {
    render(<StatusPill label="Status: Authenticated" />);
    const ok = screen.getByText("Status: Authenticated");
    expect(ok.className).toContain("uppercase");
    expect(ok.className).not.toContain("rounded-full");

    render(<StatusPill label="Nullifier Used" tone="error" />);
    expect(screen.getByText("Nullifier Used").className).toContain("text-error");

    render(<StatusPill label="Open" tone="primary" />);
    expect(screen.getByText("Open").className).toContain("text-primary");
  });
});
