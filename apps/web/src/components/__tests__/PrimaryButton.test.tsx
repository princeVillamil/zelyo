import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrimaryButton } from "../PrimaryButton";

describe("PrimaryButton", () => {
  it("renders a solid primary button", () => {
    render(<PrimaryButton>Continue</PrimaryButton>);
    const btn = screen.getByRole("button", { name: "Continue" });
    expect(btn.className).toContain("bg-primary");
    expect(btn.className).toContain("text-background");
    expect(btn.className).toContain("uppercase");
  });
});
