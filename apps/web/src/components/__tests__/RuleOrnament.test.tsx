import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RuleOrnament } from "../RuleOrnament";

describe("RuleOrnament", () => {
  it("renders a separator with a centered lozenge", () => {
    render(<RuleOrnament />);
    const sep = screen.getByRole("separator");
    expect(sep).toBeInTheDocument();
    expect(sep.textContent).toContain("◆");
  });
});
