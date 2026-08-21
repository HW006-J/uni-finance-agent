import { describe, expect, it } from "vitest";
import {
  calculateActualRunway,
  calculateCommittedSpend,
  calculateDiscretionaryCash,
  calculateExpectedEssentialSpend,
  calculateFinancialSummary,
  calculateHorizon,
  calculateHorizonDays,
  calculatePeriodBudgetSummary,
  calculateSafeWeeklySpend,
  calculateShortfallInsight,
  checkAffordability,
  estimateRunOutDate,
  findNextIncome,
  forecastBalance,
  round2,
  toMonthlyAmount,
  toWeeklyAmount,
} from "./engine";
import { makeExpense, makeFundingAward, makeGoal, makeIncome, makeIncomeReceipt, makeProfile, makeTransaction } from "./test-helpers";

describe("toWeeklyAmount / toMonthlyAmount", () => {
  it("passes weekly amounts through unchanged", () => {
    expect(toWeeklyAmount(50, "weekly")).toBe(50);
  });

  it("converts monthly to weekly using 52/12 weeks per month", () => {
    expect(toWeeklyAmount(650, "monthly")).toBeCloseTo(150, 6);
  });

  it("converts termly to weekly over the assumed 12-week term", () => {
    expect(toWeeklyAmount(300, "termly")).toBe(25);
  });

  it("treats one-off amounts as having no steady-state weekly rate", () => {
    expect(toWeeklyAmount(100, "one_off")).toBe(0);
  });

  it("converts weekly to monthly using 52/12 weeks per month", () => {
    expect(toMonthlyAmount(50, "weekly")).toBeCloseTo(216.67, 2);
  });
});

describe("calculateCommittedSpend", () => {
  it("sums recurring expenses across mixed frequencies and excludes one-off/inactive items", () => {
    const expenses = [
      makeExpense({ name: "Rent", amount: 650, category: "rent", frequency: "monthly" }),
      makeExpense({ name: "Food", amount: 55, category: "groceries", frequency: "weekly" }),
      makeExpense({ name: "Gym", amount: 25, category: "gym", frequency: "monthly" }),
      makeExpense({ name: "Going out", amount: 50, category: "going_out", frequency: "weekly" }),
      makeExpense({ name: "Textbook", amount: 200, category: "other", frequency: "one_off" }),
      makeExpense({ name: "Old subscription", amount: 999, category: "subscriptions", frequency: "monthly", active: false }),
    ];

    const result = calculateCommittedSpend(expenses);

    expect(result.weekly).toBeCloseTo(260.77, 2);
    expect(result.monthly).toBeCloseTo(1130.0, 1);
  });

  it("returns zero for a profile with no expenses", () => {
    expect(calculateCommittedSpend([])).toEqual({ weekly: 0, monthly: 0 });
  });
});

describe("calculateExpectedEssentialSpend", () => {
  it("only counts essential-needs categories", () => {
    const expenses = [
      makeExpense({ amount: 650, category: "rent", frequency: "monthly" }),
      makeExpense({ amount: 55, category: "groceries", frequency: "weekly" }),
      makeExpense({ amount: 25, category: "gym", frequency: "monthly" }),
      makeExpense({ amount: 50, category: "going_out", frequency: "weekly" }),
    ];

    const result = calculateExpectedEssentialSpend(expenses);

    expect(result.weekly).toBeCloseTo(205, 2);
  });
});

describe("findNextIncome", () => {
  const asOf = new Date("2026-01-01T00:00:00.000Z");

  it("finds the soonest upcoming income and its distance in days", () => {
    const incomes = [
      makeIncome({ source: "Part-time job", amount: 200, date: "2026-03-01T00:00:00.000Z", frequency: "monthly" }),
      makeIncome({ source: "Student Finance", amount: 3000, date: "2026-01-29T00:00:00.000Z", frequency: "one_off" }),
    ];

    const next = findNextIncome(incomes, asOf);

    expect(next?.income.source).toBe("Student Finance");
    expect(next?.daysAway).toBe(28);
  });

  it("rolls a recurring income forward when its stored date has already passed", () => {
    const incomes = [makeIncome({ date: "2025-12-01T00:00:00.000Z", frequency: "monthly", amount: 200 })];
    const next = findNextIncome(incomes, asOf);
    expect(next?.occursOn).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rolls a monthly income anchored on the 31st into February without skipping into March", () => {
    const incomes = [makeIncome({ date: "2026-01-31T00:00:00.000Z", frequency: "monthly", amount: 200 })];
    const next = findNextIncome(incomes, new Date("2026-02-01T00:00:00.000Z"));
    expect(next?.occursOn).toBe("2026-02-28T00:00:00.000Z");
  });

  it("excludes a one-off income whose date has already passed", () => {
    const incomes = [makeIncome({ date: "2025-01-01T00:00:00.000Z", frequency: "one_off", amount: 500 })];
    expect(findNextIncome(incomes, asOf)).toBeNull();
  });
});

describe("calculateHorizon / calculateHorizonDays", () => {
  const asOf = new Date("2026-01-01T00:00:00.000Z");
  const profile = makeProfile();

  it("falls back to the default planning horizon when nothing is known", () => {
    const result = calculateHorizon({ profile, incomes: [] }, asOf);
    expect(result.days).toBe(30);
    expect(result.source).toBe("default");
  });

  it("prioritises an explicit budget-horizon date over everything else", () => {
    const explicitProfile = makeProfile({ budgetHorizonDate: "2026-01-20" });
    const incomes = [makeIncome({ date: "2026-01-10T00:00:00.000Z", frequency: "one_off", amount: 500 })];
    const awards = [makeFundingAward({ periodEnd: "2026-01-05" })];

    const result = calculateHorizon({ profile: explicitProfile, incomes, fundingAwards: awards }, asOf);

    expect(result.source).toBe("explicit");
    expect(result.days).toBe(19);
  });

  it("falls back to the next known income when there is no explicit horizon", () => {
    const incomes = [makeIncome({ date: "2026-01-29T00:00:00.000Z", frequency: "one_off", amount: 3000 })];
    const result = calculateHorizon({ profile, incomes }, asOf);
    expect(result.source).toBe("next_income");
    expect(result.days).toBe(28);
  });

  it("falls back to a funding award's period end when there is no explicit horizon or known income", () => {
    const awards = [makeFundingAward({ periodEnd: "2026-06-30" })];
    const result = calculateHorizon({ profile, incomes: [], fundingAwards: awards }, asOf);
    expect(result.source).toBe("funding_period_end");
    expect(result.days).toBe(180);
  });

  it("ignores a funding award period end that has already passed", () => {
    const awards = [makeFundingAward({ periodEnd: "2025-06-30" })];
    const result = calculateHorizon({ profile, incomes: [], fundingAwards: awards }, asOf);
    expect(result.source).toBe("default");
  });

  it("calculateHorizonDays returns just the day count", () => {
    expect(calculateHorizonDays({ profile, incomes: [] }, asOf)).toBe(30);
  });
});

describe("calculateDiscretionaryCash / calculateSafeWeeklySpend", () => {
  const asOf = new Date("2026-01-01T00:00:00.000Z");
  const profile = makeProfile({ currentBalance: 4500, emergencyBuffer: 500, balanceKnown: true });
  const incomes = [makeIncome({ source: "Student Finance", amount: 3000, date: "2026-01-29T00:00:00.000Z", frequency: "one_off" })];
  const expenses = [
    makeExpense({ name: "Rent", amount: 650, category: "rent", frequency: "monthly" }),
    makeExpense({ name: "Food", amount: 55, category: "groceries", frequency: "weekly" }),
    makeExpense({ name: "Gym", amount: 25, category: "gym", frequency: "monthly" }),
    makeExpense({ name: "Going out", amount: 50, category: "going_out", frequency: "weekly" }),
  ];

  it("reserves the emergency buffer and every committed bill due before the next income", () => {
    const result = calculateDiscretionaryCash({ profile, expenses, incomes, asOf });
    expect(result).toBeCloseTo(2956.92, 2);
  });

  it("spreads discretionary cash evenly across the weeks until next income", () => {
    const result = calculateSafeWeeklySpend({ profile, expenses, incomes, asOf });
    expect(result).toBeCloseTo(739.23, 2);
  });

  it("reduces discretionary cash exactly by a logged transaction's amount", () => {
    const before = calculateDiscretionaryCash({ profile, expenses, incomes, asOf });
    const profileAfterPurchase = { ...profile, currentBalance: profile.currentBalance - 180 };
    const after = calculateDiscretionaryCash({ profile: profileAfterPurchase, expenses, incomes, asOf });
    expect(before - after).toBeCloseTo(180, 2);
  });

  it("never returns a negative safe-weekly-spend even when discretionary cash is negative", () => {
    const brokeProfile = makeProfile({ currentBalance: 100, emergencyBuffer: 500, balanceKnown: true });
    const result = calculateSafeWeeklySpend({ profile: brokeProfile, expenses, incomes, asOf });
    expect(result).toBe(0);
  });

  it("treats an unset emergency buffer as zero", () => {
    const noBufferProfile = makeProfile({ currentBalance: 4500, emergencyBuffer: null, balanceKnown: true });
    const result = calculateDiscretionaryCash({ profile: noBufferProfile, expenses, incomes, asOf });
    expect(result).toBeCloseTo(3456.92, 2);
  });

  it("a funding award with no bearing on the current window does not change discretionary cash", () => {
    const awards = [makeFundingAward({ totalAmount: 20000, periodStart: "2025-09-01", periodEnd: "2026-06-30" })];
    const result = calculateDiscretionaryCash({ profile, expenses, incomes, fundingAwards: awards, asOf });
    expect(result).toBeCloseTo(2956.92, 2);
  });
});

describe("forecastBalance", () => {
  const asOf = new Date("2026-01-01T00:00:00.000Z");
  const profile = makeProfile({ currentBalance: 4500, balanceKnown: true });
  const incomes = [makeIncome({ amount: 3000, date: "2026-01-29T00:00:00.000Z", frequency: "one_off" })];
  const expenses = [
    makeExpense({ amount: 650, category: "rent", frequency: "monthly" }),
    makeExpense({ amount: 55, category: "groceries", frequency: "weekly" }),
    makeExpense({ amount: 25, category: "gym", frequency: "monthly" }),
    makeExpense({ amount: 50, category: "going_out", frequency: "weekly" }),
  ];

  it("includes income landing inside the forecast window", () => {
    const result = forecastBalance({ profile, expenses, incomes }, 28, asOf);
    expect(result).toBeCloseTo(6456.92, 2);
  });

  it("excludes income landing outside a shorter forecast window", () => {
    const result = forecastBalance({ profile, expenses, incomes }, 10, asOf);
    expect(result).toBeCloseTo(4127.47, 2);
  });

  it("prorates a weekly bill with no known due date evenly across a multi-week window", () => {
    const weeklyOnly = { profile: makeProfile({ currentBalance: 200, balanceKnown: true }), expenses: [makeExpense({ amount: 50, frequency: "weekly" })], incomes: [] };
    const result = forecastBalance(weeklyOnly, 21, asOf);
    expect(result).toBe(200 - 50 * 3);
  });

  it("counts every discrete occurrence of a dated weekly bill within the forecast window", () => {
    const datedWeekly = {
      profile: makeProfile({ currentBalance: 200, balanceKnown: true }),
      expenses: [makeExpense({ amount: 50, frequency: "weekly", nextDueDate: asOf.toISOString() })],
      incomes: [],
    };
    // Occurrences land on day 0, 7, 14 and 21 - all within an inclusive 21-day window.
    const result = forecastBalance(datedWeekly, 21, asOf);
    expect(result).toBe(200 - 50 * 4);
  });
});

describe("checkAffordability", () => {
  const asOf = new Date("2026-01-01T00:00:00.000Z");
  const profile = makeProfile({ currentBalance: 4500, emergencyBuffer: 500, balanceKnown: true });
  const incomes = [makeIncome({ amount: 3000, date: "2026-01-29T00:00:00.000Z", frequency: "one_off" })];
  const expenses = [
    makeExpense({ amount: 650, category: "rent", frequency: "monthly" }),
    makeExpense({ amount: 55, category: "groceries", frequency: "weekly" }),
    makeExpense({ amount: 25, category: "gym", frequency: "monthly" }),
    makeExpense({ amount: 50, category: "going_out", frequency: "weekly" }),
  ];
  // discretionaryCash for this fixture is ~2956.92 (see calculateDiscretionaryCash tests above)

  it("classifies a small purchase relative to discretionary cash as comfortable", () => {
    const result = checkAffordability({ profile, expenses, incomes, purchaseAmount: 500, asOf });
    expect(result.status).toBe("comfortable");
    expect(result.remainingAfterPurchase).toBeCloseTo(2456.92, 2);
    expect(result.proportionOfDiscretionaryCash).toBeCloseTo(0.17, 2);
  });

  it("classifies a mid-sized purchase as caution", () => {
    const result = checkAffordability({ profile, expenses, incomes, purchaseAmount: 1000, asOf });
    expect(result.status).toBe("caution");
  });

  it("classifies a large purchase that still leaves cash as risky", () => {
    const result = checkAffordability({ profile, expenses, incomes, purchaseAmount: 2000, asOf });
    expect(result.status).toBe("risky");
    expect(result.remainingAfterPurchase).toBeGreaterThan(0);
  });

  it("marks a purchase that would eat into committed bills/buffer as not_recommended", () => {
    const result = checkAffordability({ profile, expenses, incomes, purchaseAmount: 3200, asOf });
    expect(result.status).toBe("not_recommended");
    expect(result.remainingAfterPurchase).toBeLessThan(0);
  });

  it("marks a purchase larger than the actual current balance as cannot_afford, regardless of proportion", () => {
    const result = checkAffordability({ profile, expenses, incomes, purchaseAmount: 5000, asOf });
    expect(result.status).toBe("cannot_afford");
  });

  it("handles a profile with no income and already-negative discretionary cash", () => {
    const brokeProfile = makeProfile({ currentBalance: 1000, emergencyBuffer: 200, balanceKnown: true });
    const heavyExpenses = [
      makeExpense({ amount: 900, category: "rent", frequency: "monthly" }),
      makeExpense({ amount: 100, category: "groceries", frequency: "weekly" }),
      makeExpense({ amount: 80, category: "going_out", frequency: "weekly" }),
    ];

    const result = checkAffordability({ profile: brokeProfile, expenses: heavyExpenses, incomes: [], purchaseAmount: 50, asOf });

    expect(result.horizonDays).toBe(30); // default horizon, no income
    expect(result.discretionaryCash).toBeLessThan(0);
    expect(result.proportionOfDiscretionaryCash).toBeNull();
    expect(result.status).toBe("not_recommended");
  });

  it("marks status as unknown_balance and nulls every balance-derived figure when the balance hasn't been provided - even with committed bills that would otherwise show a fabricated shortfall", () => {
    const unknownProfile = makeProfile({ currentBalance: 0, balanceKnown: false });
    const heavyExpenses = [makeExpense({ amount: 900, category: "rent", frequency: "monthly" })];
    const result = checkAffordability({ profile: unknownProfile, expenses: heavyExpenses, incomes: [], purchaseAmount: 20, asOf });
    expect(result.status).toBe("unknown_balance");
    expect(result.balanceKnown).toBe(false);
    expect(result.currentBalance).toBeNull();
    expect(result.discretionaryCash).toBeNull();
    expect(result.remainingAfterPurchase).toBeNull();
    expect(result.proportionOfDiscretionaryCash).toBeNull();
  });

  it("rejects a negative purchase amount as an engine invariant violation", () => {
    expect(() => checkAffordability({ profile, expenses, incomes, purchaseAmount: -10, asOf })).toThrow();
  });
});

describe("calculatePeriodBudgetSummary", () => {
  it("computes total-period affordability separately from live cash (the original annual-funding bug)", () => {
    // "My total maintenance loan is £10,000 for the academic year" + "rent is £1,000/month"
    const award = makeFundingAward({
      source: "Maintenance Loan",
      totalAmount: 20000,
      periodStart: "2025-09-01",
      periodEnd: "2026-08-31", // 12 months later - matches the worked example in AGENTS.md
    });
    const expenses = [makeExpense({ name: "Rent", amount: 1000, category: "rent", frequency: "monthly", active: true })];

    const result = calculatePeriodBudgetSummary(award, expenses);

    expect(result.totalFunding).toBe(20000);
    expect(result.needsPeriodDates).toBe(false);
    expect(result.expensesOverPeriod).toBeCloseTo(12000, -1); // ~£1000/month * 12 months
    expect(result.remainingAfterExpenses).toBeCloseTo(8000, -1);
  });

  it("flags that period dates are needed rather than guessing a schedule", () => {
    const award = makeFundingAward({ totalAmount: 20000, periodStart: null, periodEnd: null });
    const result = calculatePeriodBudgetSummary(award, []);
    expect(result.needsPeriodDates).toBe(true);
    expect(result.expensesOverPeriod).toBeNull();
    expect(result.remainingAfterExpenses).toBeNull();
    expect(result.totalFunding).toBe(20000); // the total itself is still known and shown
  });
});

describe("calculateFinancialSummary", () => {
  const asOf = new Date("2026-01-01T00:00:00.000Z");

  it("assembles committed spend, upcoming commitments, budget categories and recent transactions", () => {
    const profile = makeProfile({ currentBalance: 4500, emergencyBuffer: 500, balanceKnown: true });
    const incomes = [makeIncome({ source: "Student Finance", amount: 3000, date: "2026-01-29T00:00:00.000Z", frequency: "one_off" })];
    const expenses = [
      makeExpense({ name: "Rent", amount: 650, category: "rent", frequency: "monthly" }),
      makeExpense({ name: "Phone contract", amount: 20, category: "subscriptions", frequency: "monthly", nextDueDate: "2026-01-15T00:00:00.000Z" }),
      makeExpense({ name: "Textbook", amount: 40, category: "other", frequency: "one_off", nextDueDate: "2026-01-05T00:00:00.000Z" }),
    ];
    const transactions = Array.from({ length: 10 }, (_, i) =>
      makeTransaction({ merchant: `Shop ${i}`, amount: 10, date: new Date(2026, 0, i + 1).toISOString() }),
    );
    const goals = [makeGoal({ name: "Summer buffer", targetAmount: 600 })];

    const summary = calculateFinancialSummary(
      { profile, incomes, expenses, transactions, goals, fundingAwards: [], incomeReceipts: [] },
      asOf,
    );

    expect(summary.nextMajorPayment?.income.source).toBe("Student Finance");
    expect(summary.upcomingCommitments.map((c) => c.name)).toEqual(["Textbook", "Phone contract"]);
    expect(summary.budgetCategories.find((c) => c.category === "rent")?.weeklyAmount).toBeCloseTo(150, 2);
    expect(summary.recentTransactions).toHaveLength(8);
    expect(summary.recentTransactions[0].merchant).toBe("Shop 9");
    expect(summary.goals).toHaveLength(1);
    expect(summary.horizonSource).toBe("next_income");
    expect(summary.discretionaryCash).not.toBeNull();
  });

  it("produces an honest empty-state summary for a brand new profile, never claiming a known £0 balance", () => {
    const profile = makeProfile({ currentBalance: 0, emergencyBuffer: null, balanceKnown: false });
    const summary = calculateFinancialSummary(
      { profile, incomes: [], expenses: [], transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );

    expect(summary.discretionaryCash).toBeNull();
    expect(summary.safeWeeklySpend).toBeNull();
    expect(summary.forecast30d).toBeNull();
    expect(summary.nextMajorPayment).toBeNull();
    expect(summary.upcomingCommitments).toEqual([]);
    expect(summary.budgetCategories).toEqual([]);
    expect(summary.recentTransactions).toEqual([]);
  });

  it("keeps a total funding award out of live discretionary cash - the original annual-funding bug, at the summary level", () => {
    const profile = makeProfile({ currentBalance: 500, balanceKnown: true });
    const fundingAwards = [
      makeFundingAward({ source: "Maintenance Loan", totalAmount: 20000, periodStart: "2025-09-01", periodEnd: "2026-06-30", scheduleKnown: false }),
    ];
    const summary = calculateFinancialSummary(
      { profile, incomes: [], expenses: [], transactions: [], goals: [], fundingAwards, incomeReceipts: [] },
      asOf,
    );

    // The £20,000 award must never leak into live cash figures.
    expect(summary.discretionaryCash).toBeCloseTo(500, 2);
    expect(summary.fundingAwards).toHaveLength(1);
    expect(summary.periodBudgets[0].totalFunding).toBe(20000);
    // With no other income known, the horizon falls back to the award's period end, not a made-up instalment date.
    expect(summary.horizonSource).toBe("funding_period_end");
  });

  it("surfaces recent income receipts without folding them into the summary's balance figure twice", () => {
    const profile = makeProfile({ currentBalance: 3200, balanceKnown: true });
    const incomeReceipts = [makeIncomeReceipt({ source: "Student Finance", amount: 3200, occurredOn: "2026-01-01", appliedToBalance: true })];
    const summary = calculateFinancialSummary(
      { profile, incomes: [], expenses: [], transactions: [], goals: [], fundingAwards: [], incomeReceipts },
      asOf,
    );
    expect(summary.recentIncomeReceipts).toHaveLength(1);
    expect(summary.profile.currentBalance).toBe(3200);
  });

  it("surfaces a shortfall and a suggested weekly reduction when spending outpaces the balance before the next income", () => {
    const profile = makeProfile({ currentBalance: 100, balanceKnown: true });
    const incomes = [makeIncome({ source: "Wages", amount: 50, date: "2026-01-08T00:00:00.000Z", frequency: "one_off" })];
    const expenses = [makeExpense({ name: "Rent", amount: 700, category: "rent", frequency: "monthly", nextDueDate: "2026-01-03T00:00:00.000Z" })];
    const summary = calculateFinancialSummary(
      { profile, incomes, expenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );

    expect(summary.discretionaryCash).toBeLessThan(0);
    expect(summary.shortfallAmount).toBe(-summary.discretionaryCash!);
    expect(summary.suggestedWeeklyReduction).toBeGreaterThan(0);
    // A shortfall implies real recurring spending, a known balance and a confirmed horizon - exactly estimateRunOutDate's own gating - so a run-out projection should be present too.
    expect(summary.runOutEstimate).not.toBeNull();
  });

  it("reports no shortfall for a healthy budget", () => {
    const profile = makeProfile({ currentBalance: 2000, balanceKnown: true });
    const incomes = [makeIncome({ source: "Wages", amount: 500, date: "2026-01-08T00:00:00.000Z", frequency: "one_off" })];
    const summary = calculateFinancialSummary(
      { profile, incomes, expenses: [], transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );

    expect(summary.shortfallAmount).toBeNull();
    expect(summary.suggestedWeeklyReduction).toBeNull();
    // No recurring expenses on record -> no committed-spend rate to project against.
    expect(summary.runOutEstimate).toBeNull();
  });

  it("never fabricates a runOutEstimate when the balance isn't known, even with heavy recurring spending on record", () => {
    const profile = makeProfile({ currentBalance: 0, balanceKnown: false });
    const incomes = [makeIncome({ source: "Wages", amount: 500, date: "2026-01-08T00:00:00.000Z", frequency: "one_off" })];
    const expenses = [makeExpense({ name: "Rent", amount: 900, category: "rent", frequency: "monthly" })];
    const summary = calculateFinancialSummary(
      { profile, incomes, expenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );

    expect(summary.runOutEstimate).toBeNull();
  });

  it("never fabricates a runOutEstimate against the unconfirmed default horizon", () => {
    const profile = makeProfile({ currentBalance: 500, balanceKnown: true });
    const expenses = [makeExpense({ name: "Rent", amount: 900, category: "rent", frequency: "monthly" })];
    // No incomes, no funding awards, no explicit horizon -> horizonSource is "default".
    const summary = calculateFinancialSummary(
      { profile, incomes: [], expenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );

    expect(summary.horizonSource).toBe("default");
    expect(summary.runOutEstimate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Regression: a recurring weekly job income must never collapse the runway
// horizon down to its own next occurrence, and must reduce (not replace)
// the net burn rate over the real horizon. This is the exact canonical
// scenario from manual testing that exposed the bug: before the fix, adding
// "I make £200 every week from a weekly job" to the £3,400/8-January
// scenario changed the hero to "7 days until your next payment" and
// implied ~£3,155 was safe to spend that week.
// ---------------------------------------------------------------------------
describe("calculateFinancialSummary - recurring income vs the runway horizon (canonical bug scenario)", () => {
  const asOf = new Date("2026-01-01T00:00:00.000Z");
  // Jan 1 -> May 21 is exactly 140 days (both UTC midnights).
  const maintenanceLoan = makeIncome({
    source: "Maintenance Loan",
    amount: 3200,
    date: "2026-05-21T00:00:00.000Z",
    frequency: "one_off",
  });
  const canonicalExpenses = [
    makeExpense({ name: "Rent", amount: 650, category: "rent", frequency: "monthly" }),
    makeExpense({ name: "Food", amount: 55, category: "groceries", frequency: "weekly" }),
    makeExpense({ name: "Going out", amount: 40, category: "going_out", frequency: "weekly" }),
  ];

  it("before any recurring income: 140-day horizon, £1,500 shortfall, £75/week cut, £0 safe spend", () => {
    const profile = makeProfile({ currentBalance: 3400, balanceKnown: true });
    const summary = calculateFinancialSummary(
      { profile, incomes: [maintenanceLoan], expenses: canonicalExpenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );

    expect(summary.horizonSource).toBe("next_income");
    expect(summary.horizonDays).toBe(140);
    expect(summary.nextMajorPayment?.income.source).toBe("Maintenance Loan");
    expect(summary.shortfallAmount).toBe(1500);
    expect(summary.suggestedWeeklyReduction).toBe(75);
    expect(summary.safeWeeklySpend).toBe(0);
  });

  it("after adding a £200/week job: horizon stays 140 days anchored to the Maintenance Loan, not 7 days", () => {
    const profile = makeProfile({ currentBalance: 3400, balanceKnown: true });
    const job = makeIncome({ source: "Job", amount: 200, date: "2026-01-08T00:00:00.000Z", frequency: "weekly" });
    const summary = calculateFinancialSummary(
      {
        profile,
        incomes: [maintenanceLoan, job],
        expenses: canonicalExpenses,
        transactions: [],
        goals: [],
        fundingAwards: [],
        incomeReceipts: [],
      },
      asOf,
    );

    // The regression: this must stay anchored to the Maintenance Loan, never collapse to the job's 7-day next occurrence.
    expect(summary.horizonSource).toBe("next_income");
    expect(summary.horizonDays).toBe(140);
    expect(summary.nextMajorPayment?.income.source).toBe("Maintenance Loan");
    expect(summary.nextMajorPayment?.daysAway).toBe(140);
  });

  it("after adding the job: recurring income is listed separately and offsets the burn rate to a sensible, non-fabricated figure", () => {
    const profile = makeProfile({ currentBalance: 3400, balanceKnown: true });
    const job = makeIncome({ source: "Job", amount: 200, date: "2026-01-08T00:00:00.000Z", frequency: "weekly" });
    const summary = calculateFinancialSummary(
      {
        profile,
        incomes: [maintenanceLoan, job],
        expenses: canonicalExpenses,
        transactions: [],
        goals: [],
        fundingAwards: [],
        incomeReceipts: [],
      },
      asOf,
    );

    expect(summary.recurringIncomes).toHaveLength(1);
    expect(summary.recurringIncomes[0].source).toBe("Job");

    // £245/week burn - £200/week job = £45/week net, over 20 weeks = £900; 3400 - 900 = 2500.
    expect(summary.discretionaryCash).toBe(2500);
    expect(summary.safeWeeklySpend).toBe(125);
    // The shortfall clears entirely - the £200/week job comfortably covers most of the £245/week burn.
    expect(summary.shortfallAmount).toBeNull();
    expect(summary.suggestedWeeklyReduction).toBeNull();

    // Defensive guard: never imply anywhere near the whole balance is safe to spend in a single week.
    expect(summary.safeWeeklySpend!).toBeLessThan(profile.currentBalance * 0.5);
  });
});

// ---------------------------------------------------------------------------
// calculateActualRunway - the hero's central "how long does my money
// ACTUALLY last" figure, compared against the target/"needs to last"
// horizon (`calculateHorizon`, unchanged). All scenarios below reuse the
// canonical £3,400 / Maintenance Loan-8-January / £245-per-week fixture
// above so the actual-runway numbers are checked against the exact same
// discretionaryCash/shortfall figures already pinned by the regression
// suite: £245/week burn over the 140-day horizon means the balance drains
// at a clean £35/day, so "3400 - 35*day < 0" first happens on day 98
// (day 97 leaves £5, day 98 goes to -£30).
// ---------------------------------------------------------------------------
describe("calculateActualRunway", () => {
  const asOf = new Date("2026-01-01T00:00:00.000Z");
  const maintenanceLoan = makeIncome({ source: "Maintenance Loan", amount: 3200, date: "2026-05-21T00:00:00.000Z", frequency: "one_off" });
  const canonicalExpenses = [
    makeExpense({ name: "Rent", amount: 650, category: "rent", frequency: "monthly" }),
    makeExpense({ name: "Food", amount: 55, category: "groceries", frequency: "weekly" }),
    makeExpense({ name: "Going out", amount: 40, category: "going_out", frequency: "weekly" }),
  ];

  it("no balance -> no fabricated runway", () => {
    const profile = makeProfile({ currentBalance: 0, balanceKnown: false });
    const result = calculateActualRunway(profile, canonicalExpenses, [maintenanceLoan], null, 140, "next_income", asOf);
    expect(result).toBeNull();
  });

  it("never fabricates a runway against the unconfirmed default horizon", () => {
    const profile = makeProfile({ currentBalance: 3400, balanceKnown: true });
    const result = calculateActualRunway(profile, canonicalExpenses, [], -500, 30, "default", asOf);
    expect(result).toBeNull();
  });

  it("actual runway shorter than target: £3,400 against a £245/week burn over 140 days runs dry on day 98, 42 days short", () => {
    const profile = makeProfile({ currentBalance: 3400, balanceKnown: true });
    const discretionaryCash = calculateDiscretionaryCash({ profile, expenses: canonicalExpenses, incomes: [maintenanceLoan], asOf });
    const result = calculateActualRunway(profile, canonicalExpenses, [maintenanceLoan], discretionaryCash, 140, "next_income", asOf);
    expect(result).toEqual({
      days: 98,
      meetsTarget: false,
      runOutDate: new Date(Date.UTC(2026, 3, 9)).toISOString(),
      daysShort: 42,
    });
  });

  it("actual runway exactly reaches target -> meetsTarget true at the exact boundary (discretionaryCash === 0)", () => {
    const profile = makeProfile({ currentBalance: 4900, balanceKnown: true }); // 4900 - 4900 committed = exactly 0
    const discretionaryCash = calculateDiscretionaryCash({ profile, expenses: canonicalExpenses, incomes: [maintenanceLoan], asOf });
    expect(discretionaryCash).toBe(0);
    const result = calculateActualRunway(profile, canonicalExpenses, [maintenanceLoan], discretionaryCash, 140, "next_income", asOf);
    expect(result).toEqual({ days: 140, meetsTarget: true, runOutDate: null, daysShort: null });
  });

  it("actual runway exceeds target -> reports target+ rather than inventing a further precise figure", () => {
    const profile = makeProfile({ currentBalance: 10000, balanceKnown: true });
    const discretionaryCash = calculateDiscretionaryCash({ profile, expenses: canonicalExpenses, incomes: [maintenanceLoan], asOf });
    expect(discretionaryCash).toBeGreaterThan(0);
    const result = calculateActualRunway(profile, canonicalExpenses, [maintenanceLoan], discretionaryCash, 140, "next_income", asOf);
    expect(result).toEqual({ days: 140, meetsTarget: true, runOutDate: null, daysShort: null });
  });

  it("recurring weekly income extends runway (still short of target, but less short)", () => {
    const profile = makeProfile({ currentBalance: 3400, balanceKnown: true });
    const job = makeIncome({ source: "Job", amount: 50, date: "2026-01-08T00:00:00.000Z", frequency: "weekly" });
    const incomes = [maintenanceLoan, job];
    const discretionaryCash = calculateDiscretionaryCash({ profile, expenses: canonicalExpenses, incomes, asOf });
    const result = calculateActualRunway(profile, canonicalExpenses, incomes, discretionaryCash, 140, "next_income", asOf);
    expect(result!.meetsTarget).toBe(false);
    expect(result!.days).toBeGreaterThan(98); // longer than the no-job baseline
    expect(result!.days).toBeLessThan(140); // still short of target
    expect(result!.daysShort).toBeLessThan(42); // baseline shortfall was 42 days
  });

  it("recurring monthly income extends runway (still short of target, but less short)", () => {
    const profile = makeProfile({ currentBalance: 3400, balanceKnown: true });
    const monthlyTopUp = makeIncome({ source: "Allowance", amount: 150, date: "2026-01-15T00:00:00.000Z", frequency: "monthly" });
    const incomes = [maintenanceLoan, monthlyTopUp];
    const discretionaryCash = calculateDiscretionaryCash({ profile, expenses: canonicalExpenses, incomes, asOf });
    const result = calculateActualRunway(profile, canonicalExpenses, incomes, discretionaryCash, 140, "next_income", asOf);
    expect(result!.meetsTarget).toBe(false);
    expect(result!.days).toBeGreaterThan(98);
    expect(result!.days).toBeLessThan(140);
  });

  it("recurring income can move red -> green (the £200/week job from the canonical regression scenario)", () => {
    const profile = makeProfile({ currentBalance: 3400, balanceKnown: true });
    const job = makeIncome({ source: "Job", amount: 200, date: "2026-01-08T00:00:00.000Z", frequency: "weekly" });
    const incomes = [maintenanceLoan, job];
    const discretionaryCash = calculateDiscretionaryCash({ profile, expenses: canonicalExpenses, incomes, asOf });
    expect(discretionaryCash).toBe(2500); // pinned by the existing canonical regression suite
    const result = calculateActualRunway(profile, canonicalExpenses, incomes, discretionaryCash, 140, "next_income", asOf);
    expect(result).toEqual({ days: 140, meetsTarget: true, runOutDate: null, daysShort: null });
  });

  it("major horizon does not change because recurring income arrives sooner - only actualRunway.days moves, targetDays stays anchored to the Maintenance Loan", () => {
    const profile = makeProfile({ currentBalance: 3400, balanceKnown: true });
    const job = makeIncome({ source: "Job", amount: 200, date: "2026-01-08T00:00:00.000Z", frequency: "weekly" });
    const summaryBefore = calculateFinancialSummary(
      { profile, incomes: [maintenanceLoan], expenses: canonicalExpenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );
    const summaryAfter = calculateFinancialSummary(
      { profile, incomes: [maintenanceLoan, job], expenses: canonicalExpenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );
    expect(summaryBefore.horizonDays).toBe(140);
    expect(summaryAfter.horizonDays).toBe(140); // the job's 7-day-away next occurrence never redefines the target
    expect(summaryBefore.actualRunway!.meetsTarget).toBe(false);
    expect(summaryAfter.actualRunway!.meetsTarget).toBe(true);
  });

  it("a completed transaction (reflected in currentBalance) shortens the runway", () => {
    const profileBefore = makeProfile({ currentBalance: 3400, balanceKnown: true });
    const profileAfter = makeProfile({ currentBalance: 3400 - 1500, balanceKnown: true }); // "I just spent £1,500 on a laptop"
    const dBefore = calculateDiscretionaryCash({ profile: profileBefore, expenses: canonicalExpenses, incomes: [maintenanceLoan], asOf });
    const dAfter = calculateDiscretionaryCash({ profile: profileAfter, expenses: canonicalExpenses, incomes: [maintenanceLoan], asOf });
    const before = calculateActualRunway(profileBefore, canonicalExpenses, [maintenanceLoan], dBefore, 140, "next_income", asOf);
    const after = calculateActualRunway(profileAfter, canonicalExpenses, [maintenanceLoan], dAfter, 140, "next_income", asOf);
    expect(after!.days).toBeLessThan(before!.days);
    expect(after!.days).toBe(55); // (3400-1500)=1900 available / £35-a-day burn -> first negative on day 55
    expect(after!.daysShort).toBeGreaterThan(before!.daysShort!);
  });

  it("no spending -> sensible, non-fabricated result (survives the whole window, no run-out date invented)", () => {
    const profile = makeProfile({ currentBalance: 500, balanceKnown: true });
    const discretionaryCash = calculateDiscretionaryCash({ profile, expenses: [], incomes: [maintenanceLoan], asOf });
    const result = calculateActualRunway(profile, [], [maintenanceLoan], discretionaryCash, 140, "next_income", asOf);
    expect(result).toEqual({ days: 140, meetsTarget: true, runOutDate: null, daysShort: null });
  });

  it("safe weekly spend remains internally consistent with the actual-runway green/red state", () => {
    const profile = makeProfile({ currentBalance: 3400, balanceKnown: true });
    const summary = calculateFinancialSummary(
      { profile, incomes: [maintenanceLoan], expenses: canonicalExpenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );
    // Red state (shortfall) -> safe weekly spend must be clamped to 0, never negative.
    expect(summary.actualRunway!.meetsTarget).toBe(false);
    expect(summary.safeWeeklySpend).toBe(0);

    const job = makeIncome({ source: "Job", amount: 200, date: "2026-01-08T00:00:00.000Z", frequency: "weekly" });
    const summaryGreen = calculateFinancialSummary(
      { profile, incomes: [maintenanceLoan, job], expenses: canonicalExpenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );
    // Green state -> safe weekly spend is exactly discretionaryCash spread over the target window.
    expect(summaryGreen.actualRunway!.meetsTarget).toBe(true);
    expect(summaryGreen.safeWeeklySpend).toBeCloseTo(round2(summaryGreen.discretionaryCash! / (summaryGreen.horizonDays / 7)), 2);
  });
});

describe("estimateRunOutDate", () => {
  const asOf = new Date("2026-01-01T00:00:00.000Z");

  it("returns null when the balance isn't known", () => {
    const profile = makeProfile({ currentBalance: 1000, balanceKnown: false });
    const expenses = [makeExpense({ amount: 100, frequency: "weekly" })];
    expect(estimateRunOutDate(profile, expenses, [], "next_income", asOf)).toBeNull();
  });

  it("returns null against the unconfirmed default horizon", () => {
    const profile = makeProfile({ currentBalance: 1000, balanceKnown: true });
    const expenses = [makeExpense({ amount: 100, frequency: "weekly" })];
    expect(estimateRunOutDate(profile, expenses, [], "default", asOf)).toBeNull();
  });

  it("returns null when there's no recurring spending to project a rate from", () => {
    const profile = makeProfile({ currentBalance: 1000, balanceKnown: true });
    expect(estimateRunOutDate(profile, [], [], "next_income", asOf)).toBeNull();
  });

  it("projects a run-out date from the buffer-adjusted balance at the current weekly committed-spend rate", () => {
    const profile = makeProfile({ currentBalance: 1000, emergencyBuffer: 100, balanceKnown: true });
    const expenses = [makeExpense({ amount: 90, frequency: "weekly" })];
    // (1000 - 100) available / 90 per week * 7 days = 70 days.
    const result = estimateRunOutDate(profile, expenses, [], "next_income", asOf);
    expect(result).not.toBeNull();
    expect(result!.days).toBe(70);
    expect(new Date(result!.date).getTime()).toBeGreaterThan(asOf.getTime());
  });

  it("reports zero days when the buffer already exceeds the current balance", () => {
    const profile = makeProfile({ currentBalance: 50, emergencyBuffer: 100, balanceKnown: true });
    const expenses = [makeExpense({ amount: 90, frequency: "weekly" })];
    const result = estimateRunOutDate(profile, expenses, [], "next_income", asOf);
    expect(result).toEqual({ days: 0, date: asOf.toISOString() });
  });

  it("treats an unset emergency buffer as zero", () => {
    const profile = makeProfile({ currentBalance: 700, emergencyBuffer: null, balanceKnown: true });
    const expenses = [makeExpense({ amount: 700, frequency: "weekly" })];
    // 700 available / 700 per week * 7 days = 7 days.
    const result = estimateRunOutDate(profile, expenses, [], "next_income", asOf);
    expect(result!.days).toBe(7);
  });

  it("nets recurring income off the burn rate before projecting a run-out date", () => {
    const profile = makeProfile({ currentBalance: 1000, balanceKnown: true });
    const expenses = [makeExpense({ amount: 100, frequency: "weekly" })];
    const incomes = [makeIncome({ source: "Job", amount: 40, date: "2026-01-08T00:00:00.000Z", frequency: "weekly" })];
    // Net burn is 100 - 40 = 60/week -> 1000 / 60 * 7 = ~117 days, not 70.
    const result = estimateRunOutDate(profile, expenses, incomes, "next_income", asOf);
    expect(result!.days).toBe(Math.round((1000 / 60) * 7));
  });

  it("returns null (nothing to project) when recurring income covers or exceeds the burn rate", () => {
    const profile = makeProfile({ currentBalance: 1000, balanceKnown: true });
    const expenses = [makeExpense({ amount: 100, frequency: "weekly" })];
    const incomes = [makeIncome({ source: "Job", amount: 100, date: "2026-01-08T00:00:00.000Z", frequency: "weekly" })];
    expect(estimateRunOutDate(profile, expenses, incomes, "next_income", asOf)).toBeNull();
  });

  it("ignores a MAJOR income when netting off the burn rate - only recurring income counts", () => {
    const profile = makeProfile({ currentBalance: 1000, emergencyBuffer: 100, balanceKnown: true });
    const expenses = [makeExpense({ amount: 90, frequency: "weekly" })];
    const majorIncome = [makeIncome({ source: "Maintenance Loan", amount: 3200, date: "2026-06-01T00:00:00.000Z", frequency: "one_off" })];
    // Same 70-day result as the plain committed-spend-only test above - the major income must not net off the rate.
    const result = estimateRunOutDate(profile, expenses, majorIncome, "next_income", asOf);
    expect(result!.days).toBe(70);
  });
});

describe("calculateShortfallInsight", () => {
  it("returns no shortfall when the balance (discretionary cash) is unknown", () => {
    expect(calculateShortfallInsight(null, 14, "next_income")).toEqual({
      isShortfall: false,
      shortfallAmount: null,
      suggestedWeeklyReduction: null,
    });
  });

  it("returns no shortfall when discretionary cash is zero or positive", () => {
    expect(calculateShortfallInsight(0, 14, "next_income").isShortfall).toBe(false);
    expect(calculateShortfallInsight(120, 14, "next_income").isShortfall).toBe(false);
  });

  it("returns no shortfall when the horizon is only the unconfirmed default window", () => {
    const result = calculateShortfallInsight(-200, 30, "default");
    expect(result).toEqual({ isShortfall: false, shortfallAmount: null, suggestedWeeklyReduction: null });
  });

  it("computes a positive shortfall amount and a weekly reduction to close it by the horizon", () => {
    // £1,675 short over ~20.7 weeks (145 days) -> about £81/week, matching the PR's manual test scenario.
    const result = calculateShortfallInsight(-1675, 145, "next_income");
    expect(result.isShortfall).toBe(true);
    expect(result.shortfallAmount).toBe(1675);
    expect(result.suggestedWeeklyReduction).toBeCloseTo(80.86, 1);
  });

  it("never returns a negative shortfall amount or reduction", () => {
    const result = calculateShortfallInsight(-42.5, 7, "explicit");
    expect(result.shortfallAmount).toBeGreaterThan(0);
    expect(result.suggestedWeeklyReduction).toBeGreaterThan(0);
  });

  it("is deterministic for identical inputs", () => {
    const a = calculateShortfallInsight(-500, 21, "explicit");
    const b = calculateShortfallInsight(-500, 21, "explicit");
    expect(a).toEqual(b);
  });
});
