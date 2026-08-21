// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const usePathnameMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

import { IntegrationsShell } from "./IntegrationsShell";
import { CONCEPT_INTEGRATIONS, RESOURCE_INTEGRATIONS } from "@/lib/integrations/integrations-data";

afterEach(() => {
  cleanup();
});

const FORBIDDEN_STATUS_WORDS = /^(connected|live|active|powered by)$/i;

describe("IntegrationsShell", () => {
  it("renders the page heading and positioning copy", () => {
    usePathnameMock.mockReturnValue("/integrations");
    render(<IntegrationsShell />);
    expect(screen.getByRole("heading", { name: "Integrations" })).toBeInTheDocument();
    expect(screen.getByText("Runway works better when it’s connected.")).toBeInTheDocument();
  });

  it("renders every Concept card labelled 'Concept', never a false 'Connected'/'Live'/'Active' state", () => {
    usePathnameMock.mockReturnValue("/integrations");
    render(<IntegrationsShell />);

    for (const item of CONCEPT_INTEGRATIONS) {
      expect(screen.getByText(item.name)).toBeInTheDocument();
      expect(screen.getByText(item.purpose)).toBeInTheDocument();
    }
    const badges = screen.getAllByTestId("status-badge");
    const conceptBadges = badges.filter((b) => b.textContent === "Concept");
    expect(conceptBadges.length).toBe(CONCEPT_INTEGRATIONS.length);
  });

  it("every status badge reads exactly 'Concept' or 'Resource' - never a false Connected/Live/Active/Powered-by claim", () => {
    usePathnameMock.mockReturnValue("/integrations");
    render(<IntegrationsShell />);
    const badges = screen.getAllByTestId("status-badge");
    expect(badges.length).toBe(CONCEPT_INTEGRATIONS.length + RESOURCE_INTEGRATIONS.length);
    for (const badge of badges) {
      expect(["Concept", "Resource"]).toContain(badge.textContent);
      expect(badge.textContent).not.toMatch(FORBIDDEN_STATUS_WORDS);
    }
  });

  it("renders every Resource card labelled 'Resource' with a working external https link", () => {
    usePathnameMock.mockReturnValue("/integrations");
    render(<IntegrationsShell />);

    for (const item of RESOURCE_INTEGRATIONS) {
      expect(screen.getByText(item.name)).toBeInTheDocument();
    }
    const resourceBadges = screen.getAllByTestId("status-badge").filter((b) => b.textContent === "Resource");
    expect(resourceBadges.length).toBe(RESOURCE_INTEGRATIONS.length);

    for (const item of RESOURCE_INTEGRATIONS) {
      const matchingLink = screen.getAllByRole("link").find((a) => a.getAttribute("href") === item.url);
      expect(matchingLink).toBeDefined();
      expect(matchingLink).toHaveAttribute("target", "_blank");
      expect(matchingLink).toHaveAttribute("rel", expect.stringContaining("noopener"));
      expect(item.url.startsWith("https://")).toBe(true);
    }
  });

  it("explains the Concept vs Resource status legend", () => {
    usePathnameMock.mockReturnValue("/integrations");
    render(<IntegrationsShell />);
    expect(screen.getByText(/an integration Runway could support in the future/)).toBeInTheDocument();
    expect(screen.getByText(/an external service or resource students can use today/)).toBeInTheDocument();
  });

  it("never fabricates a NatWest/payabl./ipushpull partnership claim - descriptions stay conceptual", () => {
    usePathnameMock.mockReturnValue("/integrations");
    const { container } = render(<IntegrationsShell />);
    expect(container.textContent).not.toMatch(/partners? with|official (natwest|payabl|ipushpull) integration/i);
  });
});
