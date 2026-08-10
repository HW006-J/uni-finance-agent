import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./system-prompt";

describe("buildSystemPrompt", () => {
  it("grounds the prompt in the given date so the model can resolve relative dates", () => {
    const prompt = buildSystemPrompt(new Date("2026-08-10T12:00:00.000Z"));
    expect(prompt).toContain("Today's date is 2026-08-10");
    expect(prompt).toContain("never a date that has already passed");
  });

  it("defaults to the current date when none is given", () => {
    const prompt = buildSystemPrompt();
    const today = new Date().toISOString().slice(0, 10);
    expect(prompt).toContain(`Today's date is ${today}`);
  });
});
