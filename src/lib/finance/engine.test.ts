import { describe, expect, it } from "vitest";
import {
  calculateCommittedSpend,
  calculateDiscretionaryCash,
  calculateExpectedEssentialSpend,
  calculateFinancialSummary,
  calculateHorizonDays,
  calculateSafeWeeklySpend,
  checkAffordability,
  findNextIncome,
  forecastBalance,
  toMonthlyAmount,
  toWeeklyAmount,
} from "./engine";
import { makeExpense, makeGoal, makeIncome, makeProfile, makeTransaction } from "./test-helpers";

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

describe("findNextIncome / calculateHorizonDays", () => {
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

  it("falls back to the default planning horizon when no income is known", () => {
    expect(calculateHorizonDays([], asOf)).toBe(30);
  });

  it("excludes a one-off income whose date has already passed", () => {
    const incomes = [makeIncome({ date: "2025-01-01T00:00:00.000Z", frequency: "one_off", amount: 500 })];
    expect(findNextIncome(incomes, asOf)).toBeNull();
  });
});

describe("calculateDiscretionaryCash / calculateSafeWeeklySpend", () => {
  const asOf = new Date("2026-01-01T00:00:00.000Z");
  const profile = makeProfile({ currentBalance: 4500, emergencyBuffer: 500 });
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
    const brokeProfile = makeProfile({ currentBalance: 100, emergencyBuffer: 500 });
    const result = calculateSafeWeeklySpend({ profile: brokeProfile, expenses, incomes, asOf });
    expect(result).toBe(0);
  });

  it("treats an unset emergency buffer as zero", () => {
    const noBufferProfile = makeProfile({ currentBalance: 4500, emergencyBuffer: null });
    const result = calculateDiscretionaryCash({ profile: noBufferProfile, expenses, incomes, asOf });
    expect(result).toBeCloseTo(3456.92, 2);
  });
});

describe("forecastBalance", () => {
  const asOf = new Date("2026-01-01T00:00:00.000Z");
  const profile = makeProfile({ currentBalance: 4500 });
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
    const weeklyOnly = { profile: makeProfile({ currentBalance: 200 }), expenses: [makeExpense({ amount: 50, frequency: "weekly" })], incomes: [] };
    const result = forecastBalance(weeklyOnly, 21, asOf);
    expect(result).toBe(200 - 50 * 3);
  });

  it("counts every discrete occurrence of a dated weekly bill within the forecast window", () => {
    const datedWeekly = {
      profile: makeProfile({ currentBalance: 200 }),
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
  const profile = makeProfile({ currentBalance: 4500, emergencyBuffer: 500 });
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
    const brokeProfile = makeProfile({ currentBalance: 1000, emergencyBuffer: 200 });
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

  it("rejects a negative purchase amount as an engine invariant violation", () => {
    expect(() => checkAffordability({ profile, expenses, incomes, purchaseAmount: -10, asOf })).toThrow();
  });
});

describe("calculateFinancialSummary", () => {
  const asOf = new Date("2026-01-01T00:00:00.000Z");

  it("assembles committed spend, upcoming commitments, budget categories and recent transactions", () => {
    const profile = makeProfile({ currentBalance: 4500, emergencyBuffer: 500 });
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

    const summary = calculateFinancialSummary({ profile, incomes, expenses, transactions, goals }, asOf);

    expect(summary.nextIncome?.income.source).toBe("Student Finance");
    expect(summary.upcomingCommitments.map((c) => c.name)).toEqual(["Textbook", "Phone contract"]);
    expect(summary.budgetCategories.find((c) => c.category === "rent")?.weeklyAmount).toBeCloseTo(150, 2);
    expect(summary.recentTransactions).toHaveLength(8);
    expect(summary.recentTransactions[0].merchant).toBe("Shop 9");
    expect(summary.goals).toHaveLength(1);
  });

  it("produces an honest empty-state summary for a brand new profile", () => {
    const profile = makeProfile({ currentBalance: 0, emergencyBuffer: null });
    const summary = calculateFinancialSummary({ profile, incomes: [], expenses: [], transactions: [], goals: [] }, asOf);

    expect(summary.discretionaryCash).toBe(0);
    expect(summary.safeWeeklySpend).toBe(0);
    expect(summary.nextIncome).toBeNull();
    expect(summary.upcomingCommitments).toEqual([]);
    expect(summary.budgetCategories).toEqual([]);
    expect(summary.recentTransactions).toEqual([]);
  });
});
