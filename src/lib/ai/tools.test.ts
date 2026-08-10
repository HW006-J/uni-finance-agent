import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const repoMocks = vi.hoisted(() => ({
  getFinancialState: vi.fn(),
  getProfileCurrency: vi.fn().mockResolvedValue("GBP"),
  setCurrentBalance: vi.fn(),
  setEmergencyBuffer: vi.fn(),
  addIncome: vi.fn(),
  addOrUpdateExpense: vi.fn(),
  logTransaction: vi.fn(),
  createOrUpdateGoal: vi.fn(),
}));

vi.mock("@/lib/supabase/repository", () => repoMocks);

import { executeTool, ToolValidationError, TOOLS } from "./tools";
import { makeExpense, makeProfile } from "@/lib/finance/test-helpers";

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
    repoMocks.getFinancialState.mockResolvedValue({
      profile: makeProfile({ currentBalance: 1000, emergencyBuffer: 0 }),
      incomes: [],
      expenses: [],
      transactions: [],
      goals: [],
    });

    const result = await executeTool("check_affordability", { purchaseAmount: 100 }, { profileId: "p1" });

    expect(result.data.result).toMatchObject({ purchaseAmount: 100, status: "comfortable" });
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
    expect(repoMocks.addIncome).not.toHaveBeenCalled();
  });

  it("formats add_income and create_or_update_goal confirmations in the profile's actual currency, not a hardcoded default", async () => {
    repoMocks.getProfileCurrency.mockResolvedValueOnce("USD");
    repoMocks.addIncome.mockResolvedValue({ source: "Wages", amount: 100, frequency: "weekly" });

    const result = await executeTool(
      "add_income",
      { source: "Wages", amount: 100, date: "2026-01-01", frequency: "weekly" },
      { profileId: "p1" },
    );

    expect(result.message).toContain("$100.00");
    expect(result.message).not.toContain("£");
  });
});
