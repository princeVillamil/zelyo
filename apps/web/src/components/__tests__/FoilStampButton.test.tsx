import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FoilStampButton } from "../FoilStampButton";

describe("FoilStampButton", () => {
  it("renders an uppercase label with the foil-stamp brand class", () => {
    render(<FoilStampButton>Seal &amp; Authorize</FoilStampButton>);
    const btn = screen.getByRole("button", { name: /seal & authorize/i });
    expect(btn).toHaveClass("foil-stamp");
    expect(btn.className).toContain("uppercase");
    expect(btn.className).toContain("text-on-primary");
  });
});
