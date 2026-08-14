import { describe, expect, it } from "vitest";
import { buildTipQueue, detectTriggers } from "./select-tip";
import { MONEY_TIPS } from "./tips-data";
import { calculateFinancialSummary } from "@/lib/finance/engine";
import { makeFundingAward, makeProfile } from "@/lib/finance/test-helpers";

function summaryWith(overrides: Parameters<typeof makeProfile>[0] = {}, extra: Partial<Parameters<typeof calculateFinancialSummary>[0]> = {}) {
  return calculateFinancialSummary({
    profile: makeProfile(overrides),
    incomes: [],
    expenses: [],
    transactions: [],
    goals: [],
    fundingAwards: [],
    incomeReceipts: [],
    ...extra,
  });
}

describe("MONEY_TIPS", () => {
  it("every tip cites an official source and has a real https url", () => {
    for (const tip of MONEY_TIPS) {
      expect(tip.sourceUrl.startsWith("https://")).toBe(true);
      expect(tip.sourceLabel.length).toBeGreaterThan(0);
      expect(["gov.uk", "moneyhelper.org.uk"].some((domain) => tip.sourceUrl.includes(domain))).toBe(true);
    }
  });

  it("has unique ids", () => {
    const ids = MONEY_TIPS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("detectTriggers", () => {
  it("detects the loan tracker context regardless of financial data", () => {
    expect(detectTriggers({ page: "loan_tracker" })).toContain("loan_tracker_view");
  });

  it("detects a shortfall from a negative discretionary cash figure", () => {
    const summary = summaryWith(
      { currentBalance: 10, balanceKnown: true },
      { expenses: [{ id: "e1", profileId: "p1", name: "Rent", amount: 900, category: "rent", frequency: "monthly", nextDueDate: null, active: true, createdAt: "", updatedAt: "" }] },
    );
    expect(detectTriggers({ page: "budget", summary })).toContain("shortfall_projected");
  });

  it("detects no known income/funding when the profile is completely empty", () => {
    const summary = summaryWith();
    expect(detectTriggers({ page: "budget", summary })).toContain("no_income_known");
  });

  it("detects an unscheduled funding award", () => {
    const summary = summaryWith({}, { fundingAwards: [makeFundingAward({ scheduleKnown: false })] });
    expect(detectTriggers({ page: "budget", summary })).toContain("funding_award_schedule_unknown");
  });
});

describe("buildTipQueue", () => {
  it("puts the highest-priority eligible contextual tip first", () => {
    const queue = buildTipQueue({ page: "loan_tracker" });
    expect(queue[0].trigger).toBe("loan_tracker_view");
    expect(queue[0].id).toBe("repayments-income-contingent"); // priority 10, highest among loan_tracker_view tips
  });

  it("falls back to the general rotation with no contextual match", () => {
    const summary = summaryWith({ currentBalance: 500, balanceKnown: true }, { incomes: [{ id: "i1", profileId: "p1", source: "Wages", amount: 100, date: "2026-01-05T00:00:00.000Z", frequency: "weekly", createdAt: "", updatedAt: "" }] });
    const queue = buildTipQueue({ page: "budget", summary });
    expect(queue.every((t) => !t.trigger)).toBe(true);
  });

  it("never returns duplicate tips", () => {
    const queue = buildTipQueue({ page: "loan_tracker" });
    expect(new Set(queue.map((t) => t.id)).size).toBe(queue.length);
  });
});
