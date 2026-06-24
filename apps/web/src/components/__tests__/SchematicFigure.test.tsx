import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SchematicFigure } from "../SchematicFigure";

describe("SchematicFigure", () => {
  it("renders a captioned figure with line-art nodes", () => {
    render(<SchematicFigure caption="Fig 1.1" nodes={["DATA", "HASH", "ROOT"]} />);
    const fig = screen.getByRole("figure");
    expect(fig).toBeInTheDocument();
    expect(screen.getByText("Fig 1.1").className).toContain("uppercase");
    expect(screen.getByText("DATA")).toBeInTheDocument();
    expect(screen.getByText("ROOT")).toBeInTheDocument();
  });
});
