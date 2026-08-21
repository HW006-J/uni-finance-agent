// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const usePathnameMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

import { AppHeader } from "./AppHeader";

afterEach(() => {
  cleanup();
});

describe("AppHeader - sticky nav", () => {
  it("links to both routes with the current one marked active", () => {
    usePathnameMock.mockReturnValue("/budget");
    render(<AppHeader />);

    const budgetLink = screen.getByRole("link", { name: "Budget" });
    const loanLink = screen.getByRole("link", { name: "Loan Tracker" });
    expect(budgetLink).toHaveAttribute("href", "/budget");
    expect(loanLink).toHaveAttribute("href", "/loan-tracker");
    expect(budgetLink.className).toContain("text-brand-dark");
    expect(loanLink.className).not.toContain("text-brand-dark");
  });

  it("marks the Loan Tracker route active when on that page - the shared header works identically on both routes", () => {
    usePathnameMock.mockReturnValue("/loan-tracker");
    render(<AppHeader />);

    expect(screen.getByRole("link", { name: "Loan Tracker" }).className).toContain("text-brand-dark");
    expect(screen.getByRole("link", { name: "Budget" }).className).not.toContain("text-brand-dark");
  });

  it("is positioned sticky at the top so it stays reachable while the page scrolls", () => {
    usePathnameMock.mockReturnValue("/budget");
    render(<AppHeader />);
    const header = screen.getByRole("banner");
    expect(header.className).toContain("sticky");
    expect(header.className).toContain("top-0");
  });

  it("renders any passed actions", () => {
    usePathnameMock.mockReturnValue("/budget");
    render(<AppHeader actions={<button type="button">Reset demo data</button>} />);
    expect(screen.getByRole("button", { name: "Reset demo data" })).toBeInTheDocument();
  });
});
