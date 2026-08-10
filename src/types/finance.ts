/**
 * Core financial domain types shared by the persistence layer, the
 * deterministic budgeting engine, the agent tool layer and the UI.
 *
 * These types are intentionally provider-agnostic: nothing here knows
 * about Gemini, Supabase, or any specific transport.
 */

export type Currency = "GBP" | "USD" | "EUR";

/**
 * How often a recurring item happens. `termly` is a UK-university-specific
 * cadence (see TERM_WEEKS in constants.ts for the assumed term length).
 */
export type RecurrenceFrequency = "one_off" | "weekly" | "monthly" | "termly";

/**
 * Shared spending category vocabulary used by both expenses and
 * transactions so the two line up in dashboards and budget breakdowns.
 */
export type SpendCategory =
  | "rent"
  | "utilities"
  | "groceries"
  | "transport"
  | "subscriptions"
  | "health"
  | "gym"
  | "going_out"
  | "entertainment"
  | "shopping"
  | "other";

export type TransactionSource = "chat" | "voice" | "manual";

export interface Profile {
  id: string;
  currency: Currency;
  currentBalance: number;
  /** Amount the student wants to keep untouched as a safety net. Null = not set. */
  emergencyBuffer: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Income {
  id: string;
  profileId: string;
  source: string;
  amount: number;
  /** ISO date. For recurring income this is the next expected payment date. */
  date: string;
  frequency: RecurrenceFrequency;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  profileId: string;
  name: string;
  amount: number;
  category: SpendCategory;
  frequency: RecurrenceFrequency;
  /** ISO date. Optional — only set when the student mentions a concrete due date. */
  nextDueDate: string | null;
  /** Soft-delete flag so history is preserved when a student removes an expense. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  profileId: string;
  merchant: string;
  amount: number;
  category: SpendCategory;
  /** ISO datetime. */
  date: string;
  notes: string | null;
  source: TransactionSource;
  createdAt: string;
}

export interface Goal {
  id: string;
  profileId: string;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The full financial picture for a single profile, as loaded from persistence. */
export interface FinancialState {
  profile: Profile;
  incomes: Income[];
  expenses: Expense[];
  transactions: Transaction[];
  goals: Goal[];
}
