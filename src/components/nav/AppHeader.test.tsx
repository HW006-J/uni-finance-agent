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
  it("links to all three routes with the current one marked active", () => {
    usePathnameMock.mockReturnValue("/budget");
    render(<AppHeader />);

    const budgetLink = screen.getByRole("link", { name: "Budget" });
    const loanLink = screen.getByRole("link", { name: "Loan Tracker" });
    const integrationsLink = screen.getByRole("link", { name: "Integrations" });
    expect(budgetLink).toHaveAttribute("href", "/budget");
    expect(loanLink).toHaveAttribute("href", "/loan-tracker");
    expect(integrationsLink).toHaveAttribute("href", "/integrations");
    expect(budgetLink.className).toContain("text-brand-dark");
    expect(loanLink.className).not.toContain("text-brand-dark");
    expect(integrationsLink.className).not.toContain("text-brand-dark");
  });

  it("marks the Loan Tracker route active when on that page - the shared header works identically on every route", () => {
    usePathnameMock.mockReturnValue("/loan-tracker");
    render(<AppHeader />);

    expect(screen.getByRole("link", { name: "Loan Tracker" }).className).toContain("text-brand-dark");
    expect(screen.getByRole("link", { name: "Budget" }).className).not.toContain("text-brand-dark");
    expect(screen.getByRole("link", { name: "Integrations" }).className).not.toContain("text-brand-dark");
  });

  it("marks the Integrations route active when on that page", () => {
    usePathnameMock.mockReturnValue("/integrations");
    render(<AppHeader />);

    expect(screen.getByRole("link", { name: "Integrations" }).className).toContain("text-brand-dark");
    expect(screen.getByRole("link", { name: "Budget" }).className).not.toContain("text-brand-dark");
    expect(screen.getByRole("link", { name: "Loan Tracker" }).className).not.toContain("text-brand-dark");
  });

  it("is positioned sticky at the top so it stays reachable while the page scrolls, with all three tabs in a horizontally-scrollable row", () => {
    usePathnameMock.mockReturnValue("/budget");
    render(<AppHeader />);
    const header = screen.getByRole("banner");
    expect(header.className).toContain("sticky");
    expect(header.className).toContain("top-0");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.className).toContain("overflow-x-auto");
    expect(nav.querySelectorAll("a")).toHaveLength(3);
  });

  it("renders any passed actions", () => {
    usePathnameMock.mockReturnValue("/budget");
    render(<AppHeader actions={<button type="button">Reset demo data</button>} />);
    expect(screen.getByRole("button", { name: "Reset demo data" })).toBeInTheDocument();
  });
});
