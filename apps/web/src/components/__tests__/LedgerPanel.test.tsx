import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LedgerPanel } from "../LedgerPanel";

describe("LedgerPanel", () => {
  it("wraps children in a ledger-line background", () => {
    render(<LedgerPanel>content</LedgerPanel>);
    const panel = screen.getByText("content").closest("div");
    expect(panel?.className).toContain("ledger-line");
  });
});
