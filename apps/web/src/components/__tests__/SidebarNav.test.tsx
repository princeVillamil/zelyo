import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarNav } from "../SidebarNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/issuer/mint" }));

describe("SidebarNav", () => {
  it("renders nav items and marks the active route with the brand active styles", () => {
    render(
      <SidebarNav
        items={[
          { href: "/issuer", label: "Dashboard" },
          { href: "/issuer/mint", label: "Mint" },
        ]}
      />,
    );
    const active = screen.getByRole("link", { name: "Mint" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.className).toContain("border-l-2");
    expect(active.className).toContain("border-primary");
    expect(active.className).toContain("bg-secondary-container");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
