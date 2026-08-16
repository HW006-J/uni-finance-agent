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
  /**
   * Whether the student has actually told us their current balance. `false`
   * means `currentBalance` is just the numeric default (0) and must NOT be
   * presented as a real figure - the UI should say "not provided" instead.
   */
  balanceKnown: boolean;
  /** ISO datetime the balance was last explicitly set or adjusted by a known receipt. Null if never known. */
  balanceUpdatedAt: string | null;
  /** Explicit "this money needs to last until <date>" override from the student. Highest-priority budgeting horizon input. */
  budgetHorizonDate: string | null;
  /** Optional free-text note the student gave alongside the explicit horizon (e.g. "until I move out"). */
  budgetHorizonNote: string | null;
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

/**
 * A TOTAL funding amount across a period - e.g. "£10,000 Maintenance Loan
 * for the academic year". This is informational period funding ONLY. It is
 * never current cash and never a single future payment - see
 * `record_funding_award` and `get_period_budget_summary`. Mixing this up
 * with `Income` (an expected/received payment pattern) was the original
 * annual-funding bug this type exists to prevent.
 */
export interface FundingAward {
  id: string;
  profileId: string;
  source: string;
  totalAmount: number;
  /** ISO date. Null if the period isn't known. */
  periodStart: string | null;
  /** ISO date. Null if the period isn't known. */
  periodEnd: string | null;
  /** Whether the student has told us how/when this is actually paid out. */
  scheduleKnown: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * An audit-trail record of a payment the student says has actually
 * arrived (e.g. "I was just paid £3,200"). Kept separate from `Income`
 * (which represents an expected/future payment pattern) so a received
 * payment is never confused with a future instalment or a period total.
 */
export interface IncomeReceipt {
  id: string;
  profileId: string;
  source: string;
  amount: number;
  /** ISO date the payment actually arrived. */
  occurredOn: string;
  notes: string | null;
  /**
   * Whether this receipt was folded into `Profile.currentBalance`. Only
   * true when the balance was already known at the time it was recorded -
   * see the migration/repository comments for why.
   */
  appliedToBalance: boolean;
  createdAt: string;
}

/** The full financial picture for a single profile, as loaded from persistence. */
export interface FinancialState {
  profile: Profile;
  incomes: Income[];
  expenses: Expense[];
  transactions: Transaction[];
  goals: Goal[];
  fundingAwards: FundingAward[];
  incomeReceipts: IncomeReceipt[];
}
