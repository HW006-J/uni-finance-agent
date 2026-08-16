import { describe, expect, it } from "vitest";
import { formatMoneyCompact, formatMoneyInputPreview, getLargeAmountNotice } from "./format";

describe("formatMoneyCompact", () => {
  it("formats zero as £0", () => {
    expect(formatMoneyCompact(0)).toBe("£0");
  });

  it("formats sub-thousand amounts as whole pounds", () => {
    expect(formatMoneyCompact(450)).toBe("£450");
  });

  it("formats round thousands with a k suffix and no decimal", () => {
    expect(formatMoneyCompact(10_000)).toBe("£10k");
    expect(formatMoneyCompact(50_000)).toBe("£50k");
  });

  it("formats non-round thousands with one decimal place", () => {
    expect(formatMoneyCompact(37_753)).toBe("£37.8k");
  });
});

describe("formatMoneyInputPreview", () => {
  it("formats a plain digit string as a whole-pound preview", () => {
    expect(formatMoneyInputPreview("45000")).toBe("£45,000");
  });

  it("returns null for an empty or invalid string", () => {
    expect(formatMoneyInputPreview("")).toBeNull();
    expect(formatMoneyInputPreview("abc")).toBeNull();
  });

  it("returns null for a negative amount", () => {
    expect(formatMoneyInputPreview("-100")).toBeNull();
  });
});

describe("getLargeAmountNotice", () => {
  it("returns null for a typical student loan balance", () => {
    expect(getLargeAmountNotice(45_000)).toBeNull();
  });

  it("returns a non-blocking notice for an unusually large amount", () => {
    const notice = getLargeAmountNotice(450_000);
    expect(notice).not.toBeNull();
    expect(notice).toContain("£450,000");
  });

  it("returns null for an invalid amount rather than throwing", () => {
    expect(getLargeAmountNotice(Number.NaN)).toBeNull();
  });
});
