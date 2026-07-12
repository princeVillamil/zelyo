import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GateCard } from "../GateCard";

describe("GateCard", () => {
  it("renders title, predicate, status, and a link to the gate detail", () => {
    render(
      <GateCard
        gate={{
          slug: "data-engineering",
          title: "Senior Data Engineer",
          description: "Prove your Data Engineering credential.",
          requiredPredicates: [{ attribute: "track", equals: "Data Engineering" }],
          rewardType: "CLAIMABLE_BALANCE",
          expiresAt: null,
        }}
      />,
    );
    expect(screen.getByText("Senior Data Engineer")).toBeInTheDocument();
    expect(screen.getAllByText(/Data Engineering/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/jobs/data-engineering");
    const badge = screen.getByText("Open");
    expect(badge.className).toContain("text-primary");
    expect(badge.className).not.toContain("rounded-full");
  });
});
