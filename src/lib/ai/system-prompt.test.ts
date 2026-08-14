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

  it("distinguishes a total funding award from current cash and a single future payment (annual-funding bug regression)", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("record_funding_award");
    expect(prompt).toContain("NEVER current cash");
    expect(prompt).toContain("NEVER \"per term\" unless the student said per term");
    expect(prompt).toContain("Never invent");
  });

  it("instructs the model to ask a clarifying question rather than guess an ambiguous funding schedule", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("don't guess");
    expect(prompt).toContain("ask ONE short clarifying question");
  });
});
