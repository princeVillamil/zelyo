import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TypewriterLog } from "../TypewriterLog";

describe("TypewriterLog", () => {
  it("renders timestamped lines in a monospace log region", () => {
    render(
      <TypewriterLog
        lines={[{ time: "12:00:01", event: "LEAF INSERTED", status: "OK" }]}
      />,
    );
    const log = screen.getByRole("log");
    expect(log.className).toContain("typewriter");
    expect(screen.getByText(/12:00:01/)).toBeInTheDocument();
    expect(screen.getByText(/leaf inserted/i)).toBeInTheDocument();
    expect(screen.getByText(/OK/)).toBeInTheDocument();
  });
});
