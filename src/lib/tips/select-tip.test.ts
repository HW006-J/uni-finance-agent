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

// Official domains this library is allowed to cite - GOV.UK/MoneyHelper for
// the general library, plus each partner's own official domain for the
// partner-sourced tips added alongside the Integrations page. No blog, no
// aggregator, no third-party summary site.
const OFFICIAL_TIP_DOMAINS = [
  "gov.uk",
  "moneyhelper.org.uk",
  "thehgfoundation.com",
  "lfbf.org.uk",
  "harringtonstarr.com",
];

describe("MONEY_TIPS", () => {
  it("every tip cites an official source and has a real https url", () => {
    for (const tip of MONEY_TIPS) {
      expect(tip.sourceUrl.startsWith("https://")).toBe(true);
      expect(tip.sourceLabel.length).toBeGreaterThan(0);
      expect(OFFICIAL_TIP_DOMAINS.some((domain) => tip.sourceUrl.includes(domain))).toBe(true);
    }
  });

  it("has unique ids", () => {
    const ids = MONEY_TIPS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("partner-sourced tips carry full source metadata pointing at the partner's own official domain", () => {
    const partnerTips = MONEY_TIPS.filter((t) =>
      ["hg-foundation-tech-pathways", "lfbf-young-persons-money-index", "harrington-starr-fintech-careers"].includes(t.id),
    );
    expect(partnerTips).toHaveLength(3);
    for (const tip of partnerTips) {
      expect(tip.id.length).toBeGreaterThan(0);
      expect(tip.title.length).toBeGreaterThan(0);
      expect(tip.body.length).toBeGreaterThan(0);
      expect(tip.category.length).toBeGreaterThan(0);
      expect(tip.sourceLabel.length).toBeGreaterThan(0);
      expect(tip.sourceUrl.startsWith("https://")).toBe(true);
    }
    expect(partnerTips.find((t) => t.id === "hg-foundation-tech-pathways")?.sourceUrl).toContain("thehgfoundation.com");
    expect(partnerTips.find((t) => t.id === "lfbf-young-persons-money-index")?.sourceUrl).toContain("lfbf.org.uk");
    const harringtonStarrTip = partnerTips.find((t) => t.id === "harrington-starr-fintech-careers");
    expect(harringtonStarrTip?.sourceUrl).toContain("harringtonstarr.com");
    // Contextual: eligible during a projected shortfall, same trigger as the existing GOV.UK job-search tip.
    expect(harringtonStarrTip?.trigger).toBe("shortfall_projected");
  });

  it("never claims a partner organisation personally recommends/endorses anything (no 'X recommends' phrasing)", () => {
    const partnerTips = MONEY_TIPS.filter((t) =>
      ["hg-foundation-tech-pathways", "lfbf-young-persons-money-index", "harrington-starr-fintech-careers"].includes(t.id),
    );
    for (const tip of partnerTips) {
      expect(tip.body.toLowerCase()).not.toMatch(/recommends?|advises?|endorses?/);
    }
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
    expect(queue[0].id).toBe("loan-not-like-bank-loan"); // priority 10, highest among loan_tracker_view tips
  });

  it("falls back to the general rotation with no contextual match", () => {
    // A known MAJOR payment (not just a recurring wage) is required to avoid the "no major income known" trigger - see findNextMajorIncome.
    const summary = summaryWith(
      { currentBalance: 500, balanceKnown: true },
      { incomes: [{ id: "i1", profileId: "p1", source: "Maintenance Loan", amount: 3000, date: "2099-06-01T00:00:00.000Z", frequency: "one_off", createdAt: "", updatedAt: "" }] },
    );
    const queue = buildTipQueue({ page: "budget", summary });
    expect(queue.every((t) => !t.trigger)).toBe(true);
  });

  it("still surfaces the 'no major income known' tip when only a recurring wage is on record", () => {
    const summary = summaryWith(
      { currentBalance: 500, balanceKnown: true },
      { incomes: [{ id: "i1", profileId: "p1", source: "Wages", amount: 100, date: "2026-01-05T00:00:00.000Z", frequency: "weekly", createdAt: "", updatedAt: "" }] },
    );
    expect(detectTriggers({ page: "budget", summary })).toContain("no_income_known");
  });

  it("never returns duplicate tips", () => {
    const queue = buildTipQueue({ page: "loan_tracker" });
    expect(new Set(queue.map((t) => t.id)).size).toBe(queue.length);
  });

  it("surfaces the jobs, university-support and borrowing-caution tips ahead of the general rotation during a shortfall", () => {
    const summary = summaryWith(
      { currentBalance: 10, balanceKnown: true },
      { expenses: [{ id: "e1", profileId: "p1", name: "Rent", amount: 900, category: "rent", frequency: "monthly", nextDueDate: null, active: true, createdAt: "", updatedAt: "" }] },
    );
    const queue = buildTipQueue({ page: "budget", summary });
    const contextualIds = queue.filter((t) => t.trigger === "shortfall_projected").map((t) => t.id);
    expect(contextualIds).toEqual(expect.arrayContaining(["find-student-work", "university-support", "high-cost-borrowing"]));
    // Contextual tips come first, so none of them should be preceded by a general (untriggered) tip.
    const firstGeneralIndex = queue.findIndex((t) => !t.trigger);
    const lastContextualIndex = Math.max(...contextualIds.map((id) => queue.findIndex((t) => t.id === id)));
    expect(lastContextualIndex).toBeLessThan(firstGeneralIndex);
  });

  it("surfaces the Harrington Starr careers tip during a shortfall alongside (not instead of) the existing GOV.UK job-search tip", () => {
    const summary = summaryWith(
      { currentBalance: 10, balanceKnown: true },
      { expenses: [{ id: "e1", profileId: "p1", name: "Rent", amount: 900, category: "rent", frequency: "monthly", nextDueDate: null, active: true, createdAt: "", updatedAt: "" }] },
    );
    const queue = buildTipQueue({ page: "budget", summary });
    const contextualIds = queue.filter((t) => t.trigger === "shortfall_projected").map((t) => t.id);
    expect(contextualIds).toContain("harrington-starr-fintech-careers");
    expect(contextualIds).toContain("find-student-work"); // the GOV.UK job route must remain, not be replaced
    // The established GOV.UK/MoneyHelper tips (priority 8-10) outrank the partner tip (priority 6).
    const govUkJobIndex = queue.findIndex((t) => t.id === "find-student-work");
    const harringtonStarrIndex = queue.findIndex((t) => t.id === "harrington-starr-fintech-careers");
    expect(govUkJobIndex).toBeLessThan(harringtonStarrIndex);
  });

  it("has enough eligible tips in every context for 'Next tip' to genuinely rotate rather than repeat", () => {
    const shortfallSummary = summaryWith(
      { currentBalance: 10, balanceKnown: true },
      { expenses: [{ id: "e1", profileId: "p1", name: "Rent", amount: 900, category: "rent", frequency: "monthly", nextDueDate: null, active: true, createdAt: "", updatedAt: "" }] },
    );
    expect(buildTipQueue({ page: "budget", summary: shortfallSummary }).length).toBeGreaterThan(3);
    expect(buildTipQueue({ page: "loan_tracker" }).length).toBeGreaterThan(3);
    expect(buildTipQueue({ page: "budget" }).length).toBeGreaterThan(3);
  });
});
