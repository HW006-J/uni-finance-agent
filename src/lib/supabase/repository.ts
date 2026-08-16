import "server-only";
import type {
  Currency,
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
  TransactionSource,
} from "@/types/finance";
import { getSupabaseClient } from "./client";

// ---------------------------------------------------------------------------
// Row <-> domain type mapping (snake_case DB rows -> camelCase domain types)
// ---------------------------------------------------------------------------

interface ProfileRow {
  id: string;
  currency: Currency;
  current_balance: string | number;
  emergency_buffer: string | number | null;
  balance_known: boolean;
  balance_updated_at: string | null;
  budget_horizon_date: string | null;
  budget_horizon_note: string | null;
  created_at: string;
  updated_at: string;
}

interface FundingAwardRow {
  id: string;
  profile_id: string;
  source: string;
  total_amount: string | number;
  period_start: string | null;
  period_end: string | null;
  schedule_known: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface IncomeReceiptRow {
  id: string;
  profile_id: string;
  source: string;
  amount: string | number;
  occurred_on: string;
  notes: string | null;
  applied_to_balance: boolean;
  created_at: string;
}

interface IncomeRow {
  id: string;
  profile_id: string;
  source: string;
  amount: string | number;
  date: string;
  frequency: RecurrenceFrequency;
  created_at: string;
  updated_at: string;
}

interface ExpenseRow {
  id: string;
  profile_id: string;
  name: string;
  amount: string | number;
  category: SpendCategory;
  frequency: RecurrenceFrequency;
  next_due_date: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface TransactionRow {
  id: string;
  profile_id: string;
  merchant: string;
  amount: string | number;
  category: SpendCategory;
  date: string;
  notes: string | null;
  source: TransactionSource;
  created_at: string;
}

interface GoalRow {
  id: string;
  profile_id: string;
  name: string;
  target_amount: string | number;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

const num = (v: string | number): number => (typeof v === "number" ? v : Number.parseFloat(v));

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    currency: row.currency,
    currentBalance: num(row.current_balance),
    emergencyBuffer: row.emergency_buffer === null ? null : num(row.emergency_buffer),
    balanceKnown: row.balance_known,
    balanceUpdatedAt: row.balance_updated_at,
    budgetHorizonDate: row.budget_horizon_date,
    budgetHorizonNote: row.budget_horizon_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFundingAward(row: FundingAwardRow): FundingAward {
  return {
    id: row.id,
    profileId: row.profile_id,
    source: row.source,
    totalAmount: num(row.total_amount),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    scheduleKnown: row.schedule_known,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toIncomeReceipt(row: IncomeReceiptRow): IncomeReceipt {
  return {
    id: row.id,
    profileId: row.profile_id,
    source: row.source,
    amount: num(row.amount),
    occurredOn: row.occurred_on,
    notes: row.notes,
    appliedToBalance: row.applied_to_balance,
    createdAt: row.created_at,
  };
}

function toIncome(row: IncomeRow): Income {
  return {
    id: row.id,
    profileId: row.profile_id,
    source: row.source,
    amount: num(row.amount),
    date: row.date,
    frequency: row.frequency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    amount: num(row.amount),
    category: row.category,
    frequency: row.frequency,
    nextDueDate: row.next_due_date,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    profileId: row.profile_id,
    merchant: row.merchant,
    amount: num(row.amount),
    category: row.category,
    date: row.date,
    notes: row.notes,
    source: row.source,
    createdAt: row.created_at,
  };
}

function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    targetAmount: num(row.target_amount),
    targetDate: row.target_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function raise(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown Supabase error"}`);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getFinancialState(profileId: string): Promise<FinancialState> {
  const supabase = getSupabaseClient();

  const [profileRes, incomesRes, expensesRes, transactionsRes, goalsRes, fundingAwardsRes, incomeReceiptsRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", profileId).single(),
      supabase.from("incomes").select("*").eq("profile_id", profileId).order("date", { ascending: true }),
      supabase.from("expenses").select("*").eq("profile_id", profileId).eq("active", true).order("created_at", { ascending: true }),
      supabase.from("transactions").select("*").eq("profile_id", profileId).order("date", { ascending: false }).limit(50),
      supabase.from("goals").select("*").eq("profile_id", profileId).order("created_at", { ascending: true }),
      supabase.from("funding_awards").select("*").eq("profile_id", profileId).order("created_at", { ascending: true }),
      supabase
        .from("income_receipts")
        .select("*")
        .eq("profile_id", profileId)
        .order("occurred_on", { ascending: false })
        .limit(50),
    ]);

  if (profileRes.error) raise("Failed to load profile", profileRes.error);
  if (incomesRes.error) raise("Failed to load incomes", incomesRes.error);
  if (expensesRes.error) raise("Failed to load expenses", expensesRes.error);
  if (transactionsRes.error) raise("Failed to load transactions", transactionsRes.error);
  if (goalsRes.error) raise("Failed to load goals", goalsRes.error);
  if (fundingAwardsRes.error) raise("Failed to load funding awards", fundingAwardsRes.error);
  if (incomeReceiptsRes.error) raise("Failed to load income receipts", incomeReceiptsRes.error);

  return {
    profile: toProfile(profileRes.data as ProfileRow),
    incomes: (incomesRes.data as IncomeRow[]).map(toIncome),
    expenses: (expensesRes.data as ExpenseRow[]).map(toExpense),
    transactions: (transactionsRes.data as TransactionRow[]).map(toTransaction),
    goals: (goalsRes.data as GoalRow[]).map(toGoal),
    fundingAwards: (fundingAwardsRes.data as FundingAwardRow[]).map(toFundingAward),
    incomeReceipts: (incomeReceiptsRes.data as IncomeReceiptRow[]).map(toIncomeReceipt),
  };
}

/** Lightweight lookup used by tools that need to format money but don't otherwise load the profile. */
export async function getProfileCurrency(profileId: string): Promise<Currency> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("currency").eq("id", profileId).single();
  if (error) raise("Failed to load profile currency", error);
  return (data as { currency: Currency }).currency;
}

// ---------------------------------------------------------------------------
// Writes - every mutation the agent tool layer is allowed to perform.
// Nothing outside this file issues a raw insert/update/delete against
// these tables, so the AI can never touch the database directly.
// ---------------------------------------------------------------------------

export async function setCurrentBalance(profileId: string, amount: number): Promise<Profile> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ current_balance: amount, balance_known: true, balance_updated_at: new Date().toISOString() })
    .eq("id", profileId)
    .select("*")
    .single();
  if (error) raise("Failed to update balance", error);
  return toProfile(data as ProfileRow);
}

export async function setBudgetHorizon(
  profileId: string,
  date: string | null,
  note: string | null,
): Promise<Profile> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ budget_horizon_date: date, budget_horizon_note: note })
    .eq("id", profileId)
    .select("*")
    .single();
  if (error) raise("Failed to set budget horizon", error);
  return toProfile(data as ProfileRow);
}

export async function setEmergencyBuffer(profileId: string, amount: number | null): Promise<Profile> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ emergency_buffer: amount })
    .eq("id", profileId)
    .select("*")
    .single();
  if (error) raise("Failed to update emergency buffer", error);
  return toProfile(data as ProfileRow);
}

export interface UpsertIncomeInput {
  source: string;
  amount: number;
  date: string;
  frequency: RecurrenceFrequency;
}

/**
 * Insert a new income, or update the existing income with a
 * case-insensitive matching source for this profile - so restating "my
 * next Student Finance payment is £3,000" updates the existing row rather
 * than creating a duplicate that would double-count income.
 */
export async function addOrUpdateIncome(profileId: string, input: UpsertIncomeInput): Promise<Income> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("upsert_income", {
    p_profile_id: profileId,
    p_source: input.source,
    p_amount: input.amount,
    p_date: input.date,
    p_frequency: input.frequency,
  });
  if (error) raise("Failed to add/update income", error);
  const row = (data as IncomeRow[])[0];
  return toIncome(row);
}

export interface UpsertExpenseInput {
  name: string;
  amount: number;
  category: SpendCategory;
  frequency: RecurrenceFrequency;
  nextDueDate?: string | null;
}

export async function addOrUpdateExpense(profileId: string, input: UpsertExpenseInput): Promise<Expense> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("upsert_expense", {
    p_profile_id: profileId,
    p_name: input.name,
    p_amount: input.amount,
    p_category: input.category,
    p_frequency: input.frequency,
    p_next_due_date: input.nextDueDate ?? null,
  });
  if (error) raise("Failed to add/update expense", error);
  const row = (data as ExpenseRow[])[0];
  return toExpense(row);
}

export interface LogTransactionInput {
  merchant: string;
  amount: number;
  category: SpendCategory;
  date?: string;
  notes?: string | null;
  source?: TransactionSource;
}

export interface LogTransactionResult {
  transaction: Transaction;
  profile: Profile;
}

export async function logTransaction(profileId: string, input: LogTransactionInput): Promise<LogTransactionResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("log_transaction", {
    p_profile_id: profileId,
    p_merchant: input.merchant,
    p_amount: input.amount,
    p_category: input.category,
    p_date: input.date ?? new Date().toISOString(),
    p_notes: input.notes ?? null,
    p_source: input.source ?? "chat",
  });
  if (error) raise("Failed to log transaction", error);
  const row = (data as TransactionRow[])[0];
  const transaction = toTransaction(row);

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();
  if (profileError) raise("Failed to reload profile after transaction", profileError);

  return { transaction, profile: toProfile(profileRow as ProfileRow) };
}

export interface UpsertFundingAwardInput {
  source: string;
  totalAmount: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  scheduleKnown?: boolean;
  notes?: string | null;
}

/**
 * Insert/update a TOTAL funding award for a period (matched by source name,
 * case-insensitive). Never touches `current_balance` or `incomes` - this is
 * purely the informational period-total record.
 */
export async function recordFundingAward(profileId: string, input: UpsertFundingAwardInput): Promise<FundingAward> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("upsert_funding_award", {
    p_profile_id: profileId,
    p_source: input.source,
    p_total_amount: input.totalAmount,
    p_period_start: input.periodStart ?? null,
    p_period_end: input.periodEnd ?? null,
    p_schedule_known: input.scheduleKnown ?? false,
    p_notes: input.notes ?? null,
  });
  if (error) raise("Failed to record funding award", error);
  const row = (data as FundingAwardRow[])[0];
  return toFundingAward(row);
}

export interface RecordIncomeReceivedInput {
  source: string;
  amount: number;
  occurredOn?: string;
  notes?: string | null;
}

export interface RecordIncomeReceivedResult {
  receipt: IncomeReceipt;
  profile: Profile;
}

/**
 * Records a payment the student says has actually arrived. Only folds it
 * into `current_balance` when the balance was already known beforehand -
 * see the migration comment on `record_income_received` for why guessing
 * the starting balance would be wrong.
 */
export async function recordIncomeReceived(
  profileId: string,
  input: RecordIncomeReceivedInput,
): Promise<RecordIncomeReceivedResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("record_income_received", {
    p_profile_id: profileId,
    p_source: input.source,
    p_amount: input.amount,
    p_occurred_on: input.occurredOn ?? new Date().toISOString().slice(0, 10),
    p_notes: input.notes ?? null,
  });
  if (error) raise("Failed to record income received", error);
  const row = (
    data as {
      receipt_id: string;
      receipt_source: string;
      receipt_amount: string | number;
      receipt_occurred_on: string;
      receipt_notes: string | null;
      receipt_applied_to_balance: boolean;
      receipt_created_at: string;
      profile_balance_known: boolean;
      profile_current_balance: string | number;
    }[]
  )[0];

  const receipt: IncomeReceipt = {
    id: row.receipt_id,
    profileId,
    source: row.receipt_source,
    amount: num(row.receipt_amount),
    occurredOn: row.receipt_occurred_on,
    notes: row.receipt_notes,
    appliedToBalance: row.receipt_applied_to_balance,
    createdAt: row.receipt_created_at,
  };

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();
  if (profileError) raise("Failed to reload profile after income receipt", profileError);

  return { receipt, profile: toProfile(profileRow as ProfileRow) };
}

export interface UpsertGoalInput {
  name: string;
  targetAmount: number;
  targetDate?: string | null;
}

export async function createOrUpdateGoal(profileId: string, input: UpsertGoalInput): Promise<Goal> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("upsert_goal", {
    p_profile_id: profileId,
    p_name: input.name,
    p_target_amount: input.targetAmount,
    p_target_date: input.targetDate ?? null,
  });
  if (error) raise("Failed to create/update goal", error);
  const row = (data as GoalRow[])[0];
  return toGoal(row);
}

/** Clears the demo profile's stored financial state back to an honest empty state. */
export async function resetDemoProfile(profileId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("reset_demo_profile", { p_profile_id: profileId });
  if (error) raise("Failed to reset demo profile", error);
}
