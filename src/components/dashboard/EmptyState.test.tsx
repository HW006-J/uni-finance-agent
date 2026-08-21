// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EMPTY_STATE_SUGGESTED_PROMPT, EmptyState } from "./EmptyState";

afterEach(() => {
  cleanup();
});

describe("EmptyState - Runway framing", () => {
  it("leads with a runway-framed heading, not a generic budget-tracker one", () => {
    render(<EmptyState />);
    expect(screen.getByText("Build your runway")).toBeInTheDocument();
  });

  it("shows the exact suggested onboarding prompt as a suggestion only", () => {
    render(<EmptyState />);
    expect(EMPTY_STATE_SUGGESTED_PROMPT).toBe(
      "I've got £3,400 available now. My next maintenance payment is £3,200 on 8 January. Rent is £650 a month, food is £55 a week and I spend around £40 a week going out.",
    );
    expect(screen.getByText(new RegExp(EMPTY_STATE_SUGGESTED_PROMPT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeInTheDocument();
  });
});
