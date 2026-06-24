import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "../Input";

describe("Input", () => {
  it("renders a bottom-rule input with an associated uppercase label", () => {
    render(<Input label="Username" name="username" />);
    const input = screen.getByLabelText("Username");
    expect(input).toHaveAttribute("name", "username");
    expect(input.className).toContain("border-b");
    expect(input.className).toContain("border-outline");
    const label = screen.getByText("Username");
    expect(label.className).toContain("uppercase");
  });
});
