/**
 * Deterministic budgeting / affordability engine.
 *
 * Every exported function here is a pure function of its inputs (plus an
 * optional `asOf` clock for testability). No network calls, no database
 * access, no LLM calls. This is the ONLY place monetary calculations
 * happen in the app — the AI layer calls these functions through the
 * tool layer and explains the results, it never computes numbers itself.
 *
 * All money values are plain numbers in the profile's currency's minor
 * unit-free form (e.g. pounds, not pence) rounded to 2dp on output.
 */

import type {
  Expense,
  FinancialState,
  FundingAward,
  Goal,
  Income,
  IncomeReceipt,
  Profile,
  RecurrenceFrequency,
  SpendCategory,
  Transaction,
} from "@/types/finance";
import {
  DEFAULT_HORIZON_DAYS,
  TERM_WEEKS,
  WEEKS_PER_MONTH,
  isEssentialCategory,
} from "./constants";

// ---------------------------------------------------------------------------
// Small numeric / date helpers
// ---------------------------------------------------------------------------

export function round2(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded; // normalize -0 to 0
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function diffDays(later: Date, earlier: Date): number {
  return Math.ceil((later.getTime() - earlier.getTime()) / 86_400_000);
}

/**
 * Adds one calendar month, clamping to the last day of the target month
 * when the anchor day doesn't exist there (e.g. Jan 31 -> Feb 28, not
 * Mar 3). Uses UTC components throughout since our date-only anchors
 * (`YYYY-MM-DD` from Postgres `date` columns) parse as UTC midnight -
 * mixing in local-timezone getters/setters would silently drift the date
 * in any timezone that isn't UTC-aligned with the browser/server clock.
 */
function addMonthClamped(date: Date): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const daysInTargetMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  const result = new Date(date);
  result.setUTCFullYear(year, month + 1, Math.min(day, daysInTargetMonth));
  return result;
}

function addPeriod(date: Date, frequency: RecurrenceFrequency): Date {
  if (frequency === "monthly") return addMonthClamped(date);
  const d = new Date(date);
  if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === "termly") d.setUTCDate(d.getUTCDate() + TERM_WEEKS * 7);
  return d;
}

/**
 * Steady-state weekly equivalent of a recurring amount. `one_off` items
 * have no steady-state rate and return 0 — use occurrence-window sums for
 * those instead (see sumExpenseContribution / sumIncomeContribution).
 */
export function toWeeklyAmount(amount: number, frequency: RecurrenceFrequency): number {
  switch (frequency) {
    case "weekly":
      return amount;
    case "monthly":
      return amount / WEEKS_PER_MONTH;
    case "termly":
      return amount / TERM_WEEKS;
    case "one_off":
    default:
      return 0;
  }
}

export function toMonthlyAmount(amount: number, frequency: RecurrenceFrequency): number {
  return toWeeklyAmount(amount, frequency) * WEEKS_PER_MONTH;
}

/**
 * Finds the next occurrence of a recurring (or one-off) date on/after `asOf`.
 * Returns null if the item has no future occurrence (a one-off item whose
 * date has already passed).
 */
export function getNextOccurrenceDate(
  dateIso: string,
  frequency: RecurrenceFrequency,
  asOf: Date,
): Date | null {
  const initial = new Date(dateIso);
  if (Number.isNaN(initial.getTime())) return null;

  if (frequency === "one_off") {
    return initial >= asOf ? initial : null;
  }

  let occurrence = initial;
  let guard = 0;
  while (occurrence < asOf && guard < 5000) {
    occurrence = addPeriod(occurrence, frequency);
    guard += 1;
  }
  return occurrence;
}

// ---------------------------------------------------------------------------
// Window-bounded contribution sums (used for horizon/forecast calculations,
// where proration would misrepresent a bill landing just inside the window)
// ---------------------------------------------------------------------------

function sumOccurrencesInWindow(
  amount: number,
  frequency: RecurrenceFrequency,
  anchorDateIso: string,
  asOf: Date,
  windowDays: number,
): number {
  const windowEnd = addDays(asOf, windowDays);
  let occurrence = getNextOccurrenceDate(anchorDateIso, frequency, asOf);
  let total = 0;
  let guard = 0;
  while (occurrence && occurrence <= windowEnd && guard < 2000) {
    total += amount;
    if (frequency === "one_off") break;
    occurrence = addPeriod(occurrence, frequency);
    guard += 1;
  }
  return total;
}

/** How much of this expense falls due within [asOf, asOf + windowDays]. */
export function sumExpenseContribution(
  expense: Expense,
  asOf: Date,
  windowDays: number,
): number {
  if (!expense.active) return 0;

  if (expense.frequency === "one_off") {
    if (!expense.nextDueDate) return 0; // no anchor date -> can't place in a window
    return sumOccurrencesInWindow(expense.amount, "one_off", expense.nextDueDate, asOf, windowDays);
  }

  if (expense.nextDueDate) {
    return sumOccurrencesInWindow(expense.amount, expense.frequency, expense.nextDueDate, asOf, windowDays);
  }

  // No known due date: fall back to the steady-state prorated rate.
  return toWeeklyAmount(expense.amount, expense.frequency) * (windowDays / 7);
}

/** How much of this income falls due within [asOf, asOf + windowDays]. */
export function sumIncomeContribution(income: Income, asOf: Date, windowDays: number): number {
  return sumOccurrencesInWindow(income.amount, income.frequency, income.date, asOf, windowDays);
}

// ---------------------------------------------------------------------------
// Public engine functions
// ---------------------------------------------------------------------------

export interface WeeklyMonthlyAmount {
  weekly: number;
  monthly: number;
}

/** Steady-state committed spend across all active recurring expenses. */
export function calculateCommittedSpend(expenses: Expense[]): WeeklyMonthlyAmount {
  const weekly = expenses
    .filter((e) => e.active && e.frequency !== "one_off")
    .reduce((sum, e) => sum + toWeeklyAmount(e.amount, e.frequency), 0);
  return { weekly: round2(weekly), monthly: round2(weekly * WEEKS_PER_MONTH) };
}

/** Steady-state committed spend restricted to essential-needs categories. */
export function calculateExpectedEssentialSpend(expenses: Expense[]): WeeklyMonthlyAmount {
  const weekly = expenses
    .filter((e) => e.active && e.frequency !== "one_off" && isEssentialCategory(e.category))
    .reduce((sum, e) => sum + toWeeklyAmount(e.amount, e.frequency), 0);
  return { weekly: round2(weekly), monthly: round2(weekly * WEEKS_PER_MONTH) };
}

export interface NextIncome {
  income: Income;
  occursOn: string; // ISO date
  daysAway: number;
}

/** The soonest upcoming income event, or null if none is known/future. */
export function findNextIncome(incomes: Income[], asOf: Date = new Date()): NextIncome | null {
  const candidates = incomes
    .map((income) => ({ income, occursOn: getNextOccurrenceDate(income.date, income.frequency, asOf) }))
    .filter((c): c is { income: Income; occursOn: Date } => c.occursOn !== null);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.occursOn.getTime() - b.occursOn.getTime());
  const soonest = candidates[0];
  return {
    income: soonest.income,
    occursOn: soonest.occursOn.toISOString(),
    daysAway: Math.max(0, diffDays(soonest.occursOn, asOf)),
  };
}

/**
 * The budgeting horizon - "how far ahead does this plan reach" - is picked
 * by a clear priority so the AI/engine never invents a date:
 *   1. an explicit "must last until <date>" horizon the student stated;
 *   2. the next known income/maintenance-loan instalment;
 *   3. the end of a funding award period that covers the current date;
 *   4. otherwise a default planning window (informational only - the UI
 *      should make clear this wasn't confirmed by the student).
 */
export type HorizonSource = "explicit" | "next_income" | "funding_period_end" | "default";

export interface HorizonInput {
  profile: Pick<Profile, "budgetHorizonDate">;
  incomes: Income[];
  fundingAwards?: FundingAward[];
}

export interface HorizonInfo {
  days: number;
  source: HorizonSource;
  /** ISO date the horizon resolves to (today + days), for display. */
  horizonDate: string;
}

/** Resolves the budgeting horizon per the priority above. Never invents a date the student didn't (directly or via a stored award/income) provide. */
export function calculateHorizon(input: HorizonInput, asOf: Date = new Date()): HorizonInfo {
  const explicit = input.profile.budgetHorizonDate ? new Date(input.profile.budgetHorizonDate) : null;
  if (explicit && !Number.isNaN(explicit.getTime()) && explicit > asOf) {
    return { days: Math.max(1, diffDays(explicit, asOf)), source: "explicit", horizonDate: explicit.toISOString() };
  }

  const next = findNextIncome(input.incomes, asOf);
  if (next) {
    const occursOn = new Date(next.occursOn);
    return { days: Math.max(1, diffDays(occursOn, asOf)), source: "next_income", horizonDate: next.occursOn };
  }

  const periodEnds = (input.fundingAwards ?? [])
    .map((a) => (a.periodEnd ? new Date(a.periodEnd) : null))
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()) && d > asOf)
    .sort((a, b) => a.getTime() - b.getTime());
  if (periodEnds.length > 0) {
    return {
      days: Math.max(1, diffDays(periodEnds[0], asOf)),
      source: "funding_period_end",
      horizonDate: periodEnds[0].toISOString(),
    };
  }

  return {
    days: DEFAULT_HORIZON_DAYS,
    source: "default",
    horizonDate: addDays(asOf, DEFAULT_HORIZON_DAYS).toISOString(),
  };
}

/** Convenience wrapper over `calculateHorizon` for callers that only need the day count. */
export function calculateHorizonDays(input: HorizonInput, asOf: Date = new Date()): number {
  return calculateHorizon(input, asOf).days;
}

export interface DiscretionaryCashInput {
  profile: Profile;
  expenses: Expense[];
  incomes: Income[];
  fundingAwards?: FundingAward[];
  asOf?: Date;
}

/**
 * Cash genuinely free to spend on optional/unplanned purchases before the
 * next known income arrives, after reserving the emergency buffer and every
 * committed bill (essential or not) expected to fall due in that window.
 * Returns 0 (with the caller expected to check `profile.balanceKnown`)
 * rather than a misleading negative/zero figure when balance isn't known.
 */
export function calculateDiscretionaryCash(input: DiscretionaryCashInput): number {
  const asOf = input.asOf ?? new Date();
  const horizonDays = calculateHorizonDays(input, asOf);
  const committedOverHorizon = input.expenses.reduce(
    (sum, e) => sum + sumExpenseContribution(e, asOf, horizonDays),
    0,
  );
  const buffer = input.profile.emergencyBuffer ?? 0;
  return round2(input.profile.currentBalance - buffer - committedOverHorizon);
}

/** Discretionary cash spread evenly across the weeks until the next income. */
export function calculateSafeWeeklySpend(input: DiscretionaryCashInput): number {
  const asOf = input.asOf ?? new Date();
  const discretionary = calculateDiscretionaryCash(input);
  const horizonDays = calculateHorizonDays(input, asOf);
  const weeks = Math.max(1, horizonDays / 7);
  return round2(Math.max(0, discretionary / weeks));
}

export interface ForecastInput {
  profile: Profile;
  expenses: Expense[];
  incomes: Income[];
}

/** Projected balance `daysAhead` from `asOf`, accounting for known bills and income due in that window. */
export function forecastBalance(input: ForecastInput, daysAhead: number, asOf: Date = new Date()): number {
  const spend = input.expenses.reduce((sum, e) => sum + sumExpenseContribution(e, asOf, daysAhead), 0);
  const income = input.incomes.reduce((sum, i) => sum + sumIncomeContribution(i, asOf, daysAhead), 0);
  return round2(input.profile.currentBalance - spend + income);
}

export type AffordabilityStatus =
  | "comfortable"
  | "caution"
  | "risky"
  | "not_recommended"
  | "cannot_afford"
  | "unknown_balance";

export interface AffordabilityResult {
  purchaseAmount: number;
  /** Null when balanceKnown is false - there is no real balance to report. */
  currentBalance: number | null;
  /** False when the student hasn't told us their balance yet - every balance-derived figure below is null and status is always "unknown_balance". */
  balanceKnown: boolean;
  discretionaryCash: number | null;
  remainingAfterPurchase: number | null;
  /** purchaseAmount / discretionaryCash, or null when discretionaryCash <= 0 or the balance isn't known (ratio is not meaningful). */
  proportionOfDiscretionaryCash: number | null;
  status: AffordabilityStatus;
  horizonDays: number;
  asOf: string;
}

export interface CheckAffordabilityInput {
  profile: Profile;
  expenses: Expense[];
  incomes: Income[];
  fundingAwards?: FundingAward[];
  purchaseAmount: number;
  asOf?: Date;
}

/**
 * Structured affordability check. Returns numbers and a transparent status
 * classification only — no natural-language explanation. The AI layer turns
 * this into a sentence; it must not invent numbers that aren't here.
 */
export function checkAffordability(input: CheckAffordabilityInput): AffordabilityResult {
  if (input.purchaseAmount < 0) {
    throw new Error("purchaseAmount must be >= 0");
  }
  const asOf = input.asOf ?? new Date();
  const horizonDays = calculateHorizonDays(input, asOf);
  const balanceKnown = input.profile.balanceKnown;

  if (!balanceKnown) {
    return {
      purchaseAmount: round2(input.purchaseAmount),
      currentBalance: null,
      balanceKnown: false,
      discretionaryCash: null,
      remainingAfterPurchase: null,
      proportionOfDiscretionaryCash: null,
      status: "unknown_balance",
      horizonDays,
      asOf: asOf.toISOString(),
    };
  }

  const discretionaryCash = calculateDiscretionaryCash({ ...input, asOf });
  const remainingAfterPurchase = round2(discretionaryCash - input.purchaseAmount);

  const proportionOfDiscretionaryCash =
    discretionaryCash > 0 ? round2(input.purchaseAmount / discretionaryCash) : null;

  let status: AffordabilityStatus;
  if (input.purchaseAmount > input.profile.currentBalance) {
    status = "cannot_afford";
  } else if (discretionaryCash <= 0 || remainingAfterPurchase < 0) {
    status = "not_recommended";
  } else if (proportionOfDiscretionaryCash !== null && proportionOfDiscretionaryCash <= 0.25) {
    status = "comfortable";
  } else if (proportionOfDiscretionaryCash !== null && proportionOfDiscretionaryCash <= 0.5) {
    status = "caution";
  } else {
    status = "risky";
  }

  return {
    purchaseAmount: round2(input.purchaseAmount),
    currentBalance: round2(input.profile.currentBalance),
    balanceKnown: true,
    discretionaryCash,
    remainingAfterPurchase,
    proportionOfDiscretionaryCash,
    status,
    horizonDays,
    asOf: asOf.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Period budgeting - total funding across a period vs. the committed spend
// across that SAME period. Deliberately kept separate from live cashflow
// (calculateDiscretionaryCash etc.), which only ever reasons about cash
// actually available now/soon - see FundingAward doc comment.
// ---------------------------------------------------------------------------

export interface PeriodBudgetSummary {
  award: FundingAward;
  totalFunding: number;
  periodStart: string | null;
  periodEnd: string | null;
  periodDays: number | null;
  /** Steady-state committed spend (all active recurring expenses) projected across the full period length. Null if the period length isn't known. */
  expensesOverPeriod: number | null;
  remainingAfterExpenses: number | null;
  remainingWeekly: number | null;
  remainingMonthly: number | null;
  /** True when period_start/period_end aren't both known, so a rate-based remaining budget can't be computed. */
  needsPeriodDates: boolean;
}

/** Total-period affordability for one funding award: total funding minus known recurring costs projected across the whole period. Never mixed with live cash-on-hand. */
export function calculatePeriodBudgetSummary(award: FundingAward, expenses: Expense[]): PeriodBudgetSummary {
  const totalFunding = round2(award.totalAmount);

  if (!award.periodStart || !award.periodEnd) {
    return {
      award,
      totalFunding,
      periodStart: award.periodStart,
      periodEnd: award.periodEnd,
      periodDays: null,
      expensesOverPeriod: null,
      remainingAfterExpenses: null,
      remainingWeekly: null,
      remainingMonthly: null,
      needsPeriodDates: true,
    };
  }

  const periodDays = Math.max(1, diffDays(new Date(award.periodEnd), new Date(award.periodStart)));
  const periodWeeks = periodDays / 7;

  const weeklyRate = expenses
    .filter((e) => e.active && e.frequency !== "one_off")
    .reduce((sum, e) => sum + toWeeklyAmount(e.amount, e.frequency), 0);
  const expensesOverPeriod = round2(weeklyRate * periodWeeks);
  const remainingAfterExpenses = round2(totalFunding - expensesOverPeriod);

  return {
    award,
    totalFunding,
    periodStart: award.periodStart,
    periodEnd: award.periodEnd,
    periodDays,
    expensesOverPeriod,
    remainingAfterExpenses,
    remainingWeekly: round2(remainingAfterExpenses / periodWeeks),
    remainingMonthly: round2((remainingAfterExpenses / periodWeeks) * WEEKS_PER_MONTH),
    needsPeriodDates: false,
  };
}

// ---------------------------------------------------------------------------
// Dashboard-facing aggregate summary
// ---------------------------------------------------------------------------

export interface UpcomingCommitment {
  expenseId: string;
  name: string;
  amount: number;
  category: SpendCategory;
  dueDate: string;
}

export interface BudgetCategoryBreakdown {
  category: SpendCategory;
  weeklyAmount: number;
  monthlyAmount: number;
  essential: boolean;
}

export interface FinancialSummary {
  profile: Profile;
  committedSpend: WeeklyMonthlyAmount;
  essentialSpend: WeeklyMonthlyAmount;
  /** Null when profile.balanceKnown is false - the student hasn't told us a balance yet, so a live cashflow figure would be misleading. */
  discretionaryCash: number | null;
  safeWeeklySpend: number | null;
  horizonDays: number;
  horizonSource: HorizonSource;
  horizonDate: string;
  nextIncome: NextIncome | null;
  upcomingCommitments: UpcomingCommitment[];
  budgetCategories: BudgetCategoryBreakdown[];
  recentTransactions: Transaction[];
  goals: Goal[];
  fundingAwards: FundingAward[];
  periodBudgets: PeriodBudgetSummary[];
  recentIncomeReceipts: IncomeReceipt[];
  forecast30d: number | null;
  asOf: string;
}

const UPCOMING_COMMITMENTS_WINDOW_DAYS = 60;
const RECENT_TRANSACTIONS_LIMIT = 8;

export function calculateFinancialSummary(state: FinancialState, asOf: Date = new Date()): FinancialSummary {
  const { profile, expenses, incomes, transactions, goals, fundingAwards, incomeReceipts } = state;

  const activeExpenses = expenses.filter((e) => e.active);

  const upcomingCommitments: UpcomingCommitment[] = activeExpenses
    .filter((e) => e.nextDueDate)
    .map((e) => {
      const occursOn = getNextOccurrenceDate(e.nextDueDate as string, e.frequency, asOf);
      return occursOn ? { expenseId: e.id, name: e.name, amount: e.amount, category: e.category, dueDate: occursOn.toISOString() } : null;
    })
    .filter((c): c is UpcomingCommitment => c !== null && diffDays(new Date(c.dueDate), asOf) <= UPCOMING_COMMITMENTS_WINDOW_DAYS)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const categoryTotals = new Map<SpendCategory, number>();
  for (const e of activeExpenses.filter((e) => e.frequency !== "one_off")) {
    categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + toWeeklyAmount(e.amount, e.frequency));
  }
  const budgetCategories: BudgetCategoryBreakdown[] = Array.from(categoryTotals.entries())
    .map(([category, weekly]) => ({
      category,
      weeklyAmount: round2(weekly),
      monthlyAmount: round2(weekly * WEEKS_PER_MONTH),
      essential: isEssentialCategory(category),
    }))
    .sort((a, b) => b.weeklyAmount - a.weeklyAmount);

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, RECENT_TRANSACTIONS_LIMIT);

  const engineInput = { profile, expenses, incomes, fundingAwards, asOf };
  const horizon = calculateHorizon(engineInput, asOf);
  const periodBudgets = fundingAwards.map((award) => calculatePeriodBudgetSummary(award, expenses));

  return {
    profile,
    committedSpend: calculateCommittedSpend(expenses),
    essentialSpend: calculateExpectedEssentialSpend(expenses),
    discretionaryCash: profile.balanceKnown ? calculateDiscretionaryCash(engineInput) : null,
    safeWeeklySpend: profile.balanceKnown ? calculateSafeWeeklySpend(engineInput) : null,
    horizonDays: horizon.days,
    horizonSource: horizon.source,
    horizonDate: horizon.horizonDate,
    nextIncome: findNextIncome(incomes, asOf),
    upcomingCommitments,
    budgetCategories,
    recentTransactions,
    goals,
    fundingAwards,
    periodBudgets,
    recentIncomeReceipts: incomeReceipts,
    forecast30d: profile.balanceKnown ? forecastBalance({ profile, expenses, incomes }, 30, asOf) : null,
    asOf: asOf.toISOString(),
  };
}
