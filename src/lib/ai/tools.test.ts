import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const repoMocks = vi.hoisted(() => ({
  getFinancialState: vi.fn(),
  getProfileCurrency: vi.fn().mockResolvedValue("GBP"),
  setCurrentBalance: vi.fn(),
  setEmergencyBuffer: vi.fn(),
  addOrUpdateIncome: vi.fn(),
  addOrUpdateExpense: vi.fn(),
  logTransaction: vi.fn(),
  createOrUpdateGoal: vi.fn(),
  recordFundingAward: vi.fn(),
  recordIncomeReceived: vi.fn(),
  setBudgetHorizon: vi.fn(),
}));

vi.mock("@/lib/supabase/repository", () => repoMocks);

import { executeTool, ToolValidationError, TOOLS } from "./tools";
import { makeExpense, makeFundingAward, makeProfile } from "@/lib/finance/test-helpers";

function emptyState(overrides: Record<string, unknown> = {}) {
  return {
    profile: makeProfile(),
    incomes: [],
    expenses: [],
    transactions: [],
    goals: [],
    fundingAwards: [],
    incomeReceipts: [],
    ...overrides,
  };
}

describe("executeTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes exactly the documented set of tools", () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual(
      [
        "get_financial_summary",
        "set_current_balance",
        "set_emergency_buffer",
        "add_income",
        "record_funding_award",
        "record_income_received",
        "set_budget_horizon",
        "get_period_budget_summary",
        "add_or_update_expense",
        "log_transaction",
        "create_or_update_goal",
        "check_affordability",
        "get_safe_weekly_spend",
        "forecast_balance",
      ].sort(),
    );
  });

  it("rejects an unknown tool name without touching the repository", async () => {
    await expect(executeTool("delete_everything", {}, { profileId: "p1" })).rejects.toThrow(/Unknown tool/);
  });

  it("validates arguments before calling the repository, e.g. rejects a negative balance", async () => {
    await expect(executeTool("set_current_balance", { amount: -5 }, { profileId: "p1" })).rejects.toBeInstanceOf(
      ToolValidationError,
    );
    expect(repoMocks.setCurrentBalance).not.toHaveBeenCalled();
  });

  it("log_transaction calls the repository and reports the new balance in its action message", async () => {
    repoMocks.logTransaction.mockResolvedValue({
      transaction: {
        id: "t1",
        profileId: "p1",
        merchant: "Tesco",
        amount: 42,
        category: "groceries",
        date: "2026-01-01T00:00:00.000Z",
        notes: null,
        source: "chat",
      },
      profile: makeProfile({ currentBalance: 958 }),
    });

    const result = await executeTool(
      "log_transaction",
      { merchant: "Tesco", amount: 42, category: "groceries" },
      { profileId: "p1" },
    );

    expect(repoMocks.logTransaction).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ merchant: "Tesco", amount: 42, category: "groceries", source: "chat" }),
    );
    expect(result.message).toContain("Tesco");
    expect(result.message).toContain("958");
  });

  it("check_affordability loads live state and runs it through the deterministic engine, not the model", async () => {
    repoMocks.getFinancialState.mockResolvedValue(
      emptyState({ profile: makeProfile({ currentBalance: 1000, emergencyBuffer: 0, balanceKnown: true }) }),
    );

    const result = await executeTool("check_affordability", { purchaseAmount: 100 }, { profileId: "p1" });

    expect(result.data.result).toMatchObject({ purchaseAmount: 100, status: "comfortable" });
  });

  it("check_affordability never invents an affordability verdict when the balance isn't known", async () => {
    repoMocks.getFinancialState.mockResolvedValue(emptyState());

    const result = await executeTool("check_affordability", { purchaseAmount: 20 }, { profileId: "p1" });

    expect(result.data.result).toMatchObject({ status: "unknown_balance", balanceKnown: false });
  });

  it("add_or_update_expense forwards fields through to the repository upsert", async () => {
    repoMocks.addOrUpdateExpense.mockResolvedValue(makeExpense({ name: "Rent", amount: 700, category: "rent", frequency: "monthly" }));

    const result = await executeTool(
      "add_or_update_expense",
      { name: "Rent", amount: 700, category: "rent", frequency: "monthly" },
      { profileId: "p1" },
    );

    expect(repoMocks.addOrUpdateExpense).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ name: "Rent", amount: 700, category: "rent", frequency: "monthly" }),
    );
    expect(result.message).toContain("Rent");
    expect(result.message).toContain("700");
  });

  it("rejects an out-of-range category so the model can't write arbitrary values", async () => {
    await expect(
      executeTool("add_or_update_expense", { name: "Rent", amount: 700, category: "yacht", frequency: "monthly" }, { profileId: "p1" }),
    ).rejects.toBeInstanceOf(ToolValidationError);
  });

  it("rejects a nonsensical date year, guarding against pathological recurrence math", async () => {
    await expect(
      executeTool(
        "add_income",
        { source: "Loan", amount: 100, date: "0026-01-01", frequency: "monthly" },
        { profileId: "p1" },
      ),
    ).rejects.toBeInstanceOf(ToolValidationError);
    expect(repoMocks.addOrUpdateIncome).not.toHaveBeenCalled();
  });

  it("formats add_income and create_or_update_goal confirmations in the profile's actual currency, not a hardcoded default", async () => {
    repoMocks.getProfileCurrency.mockResolvedValueOnce("USD");
    repoMocks.addOrUpdateIncome.mockResolvedValue({ source: "Wages", amount: 100, frequency: "weekly" });

    const result = await executeTool(
      "add_income",
      { source: "Wages", amount: 100, date: "2026-01-01", frequency: "weekly" },
      { profileId: "p1" },
    );

    expect(result.message).toContain("$100.00");
    expect(result.message).not.toContain("£");
  });

  // ---------------------------------------------------------------------
  // V2: annual-funding bug regression tests, at the tool-boundary level.
  // The tool layer must keep record_funding_award, record_income_received
  // and add_income structurally distinct - none of them can be used to
  // fake the others' effect (no invented dates/schedules/balances).
  // ---------------------------------------------------------------------

  it("record_funding_award stores a period total without touching current balance or incomes", async () => {
    repoMocks.recordFundingAward.mockResolvedValue(
      makeFundingAward({ source: "Maintenance Loan", totalAmount: 20000, periodStart: null, periodEnd: null, scheduleKnown: false }),
    );

    const result = await executeTool(
      "record_funding_award",
      { source: "Maintenance Loan", totalAmount: 20000 },
      { profileId: "p1" },
    );

    expect(repoMocks.recordFundingAward).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ source: "Maintenance Loan", totalAmount: 20000 }),
    );
    expect(repoMocks.setCurrentBalance).not.toHaveBeenCalled();
    expect(repoMocks.addOrUpdateIncome).not.toHaveBeenCalled();
    expect(result.message).toContain("20,000");
  });

  it("record_funding_award does not require or invent period dates", async () => {
    repoMocks.recordFundingAward.mockResolvedValue(
      makeFundingAward({ source: "Student Finance", totalAmount: 12000, periodStart: null, periodEnd: null }),
    );

    await executeTool("record_funding_award", { source: "Student Finance", totalAmount: 12000 }, { profileId: "p1" });

    const callArgs = repoMocks.recordFundingAward.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs.periodStart).toBeUndefined();
    expect(callArgs.periodEnd).toBeUndefined();
  });

  it("record_income_received reports when the balance is still unknown rather than inventing a total", async () => {
    repoMocks.recordIncomeReceived.mockResolvedValue({
      receipt: { id: "r1", profileId: "p1", source: "Student Finance", amount: 3200, occurredOn: "2026-01-08", notes: null, appliedToBalance: false, createdAt: "2026-01-08T00:00:00.000Z" },
      profile: makeProfile({ balanceKnown: false, currentBalance: 0 }),
    });

    const result = await executeTool(
      "record_income_received",
      { source: "Student Finance", amount: 3200 },
      { profileId: "p1" },
    );

    expect(result.message).toContain("still not known");
    expect((result.data.profile as { balanceKnown: boolean }).balanceKnown).toBe(false);
  });

  it("record_income_received folds the receipt into current balance once the balance is already known", async () => {
    repoMocks.recordIncomeReceived.mockResolvedValue({
      receipt: { id: "r1", profileId: "p1", source: "Student Finance", amount: 3200, occurredOn: "2026-01-08", notes: null, appliedToBalance: true, createdAt: "2026-01-08T00:00:00.000Z" },
      profile: makeProfile({ balanceKnown: true, currentBalance: 7700 }),
    });

    const result = await executeTool(
      "record_income_received",
      { source: "Student Finance", amount: 3200 },
      { profileId: "p1" },
    );

    expect(result.message).toContain("7,700");
  });

  it("set_budget_horizon persists an explicit horizon date", async () => {
    repoMocks.setBudgetHorizon.mockResolvedValue(makeProfile({ budgetHorizonDate: "2026-01-08" }));

    const result = await executeTool("set_budget_horizon", { date: "2026-01-08" }, { profileId: "p1" });

    expect(repoMocks.setBudgetHorizon).toHaveBeenCalledWith("p1", "2026-01-08", null);
    expect(result.message).toContain("2026-01-08");
  });

  it("forecast_balance never fabricates a projection when the balance isn't known", async () => {
    repoMocks.getFinancialState.mockResolvedValue(emptyState());

    const result = await executeTool("forecast_balance", { daysAhead: 30 }, { profileId: "p1" });

    expect(result.data.forecastedBalance).toBeNull();
    expect(result.data.balanceKnown).toBe(false);
    expect(result.message).toContain("isn't known");
  });

  it("forecast_balance computes a real projection once the balance is known", async () => {
    repoMocks.getFinancialState.mockResolvedValue(
      emptyState({ profile: makeProfile({ currentBalance: 500, balanceKnown: true }) }),
    );

    const result = await executeTool("forecast_balance", { daysAhead: 30 }, { profileId: "p1" });

    expect(result.data.forecastedBalance).toBe(500);
    expect(result.data.balanceKnown).toBe(true);
  });

  it("set_budget_horizon can clear a previously-set horizon with date: null", async () => {
    repoMocks.setBudgetHorizon.mockResolvedValue(makeProfile({ budgetHorizonDate: null }));

    const result = await executeTool("set_budget_horizon", { date: null }, { profileId: "p1" });

    expect(repoMocks.setBudgetHorizon).toHaveBeenCalledWith("p1", null, null);
    expect(result.message).toContain("cleared");
  });

  it("get_period_budget_summary never reports a funding award as live cash", async () => {
    repoMocks.getFinancialState.mockResolvedValue(
      emptyState({
        fundingAwards: [makeFundingAward({ source: "Maintenance Loan", totalAmount: 20000, periodStart: "2025-09-01", periodEnd: "2026-08-31" })],
        expenses: [makeExpense({ name: "Rent", amount: 1000, category: "rent", frequency: "monthly" })],
      }),
    );

    const result = await executeTool("get_period_budget_summary", {}, { profileId: "p1" });

    const periodBudgets = result.data.periodBudgets as Array<{ totalFunding: number; remainingAfterExpenses: number | null }>;
    expect(periodBudgets).toHaveLength(1);
    expect(periodBudgets[0].totalFunding).toBe(20000);
    expect(periodBudgets[0].remainingAfterExpenses).toBeCloseTo(8000, -1);
  });
});
