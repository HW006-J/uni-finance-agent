import type { Expense, FundingAward, Goal, Income, IncomeReceipt, Profile, Transaction } from "@/types/finance";

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: nextId("profile"),
    currency: "GBP",
    currentBalance: 0,
    emergencyBuffer: null,
    balanceKnown: false,
    balanceUpdatedAt: null,
    budgetHorizonDate: null,
    budgetHorizonNote: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeFundingAward(overrides: Partial<FundingAward> = {}): FundingAward {
  return {
    id: nextId("award"),
    profileId: "profile-1",
    source: "Maintenance Loan",
    totalAmount: 0,
    periodStart: null,
    periodEnd: null,
    scheduleKnown: false,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeIncomeReceipt(overrides: Partial<IncomeReceipt> = {}): IncomeReceipt {
  return {
    id: nextId("receipt"),
    profileId: "profile-1",
    source: "Student Finance",
    amount: 0,
    occurredOn: "2026-01-01",
    notes: null,
    appliedToBalance: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: nextId("expense"),
    profileId: "profile-1",
    name: "Expense",
    amount: 0,
    category: "other",
    frequency: "monthly",
    nextDueDate: null,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeIncome(overrides: Partial<Income> = {}): Income {
  return {
    id: nextId("income"),
    profileId: "profile-1",
    source: "Income",
    amount: 0,
    date: "2026-01-01T00:00:00.000Z",
    frequency: "one_off",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: nextId("txn"),
    profileId: "profile-1",
    merchant: "Merchant",
    amount: 0,
    category: "other",
    date: "2026-01-01T00:00:00.000Z",
    notes: null,
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: nextId("goal"),
    profileId: "profile-1",
    name: "Goal",
    targetAmount: 0,
    targetDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
