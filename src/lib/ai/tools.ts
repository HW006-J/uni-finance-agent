/**
 * Agent tool/action layer.
 *
 * This is the ONLY way any AI provider can touch a student's financial
 * data. Every tool validates its arguments with zod before doing anything,
 * every mutation goes through the Supabase repository (never a raw
 * query), and every monetary calculation goes through the deterministic
 * engine in `@/lib/finance/engine`. Nothing here is Gemini-specific -
 * `src/lib/ai/gemini-provider.ts` adapts this list to Gemini's function
 * calling format, and a future provider would adapt the same list.
 */
import { z } from "zod";
import {
  calculateDiscretionaryCash,
  calculateFinancialSummary,
  calculateHorizonDays,
  calculateSafeWeeklySpend,
  checkAffordability,
  forecastBalance,
} from "@/lib/finance/engine";
import { formatMoney } from "@/lib/finance/format";
import { FREQUENCY_LABELS, RECURRENCE_FREQUENCIES, SPEND_CATEGORIES } from "@/lib/finance/constants";
import {
  addIncome,
  addOrUpdateExpense,
  createOrUpdateGoal,
  getFinancialState,
  getProfileCurrency,
  logTransaction,
  setCurrentBalance,
  setEmergencyBuffer,
} from "@/lib/supabase/repository";

export interface ToolContext {
  profileId: string;
}

export interface ToolResult {
  /** Short, past-tense action-feed message shown in the UI, e.g. "✓ £43 Tesco added". */
  message: string;
  /** Structured payload the model must ground its explanation in - never invent numbers outside this. */
  data: Record<string, unknown>;
}

export class ToolValidationError extends Error {
  constructor(
    public toolName: string,
    public issues: z.ZodIssue[],
  ) {
    super(`Invalid arguments for tool "${toolName}": ${issues.map((i) => i.message).join("; ")}`);
    this.name = "ToolValidationError";
  }
}

export interface ToolDefinition<Args = unknown> {
  name: string;
  description: string;
  schema: z.ZodType<Args>;
  execute: (args: Args, ctx: ToolContext) => Promise<ToolResult>;
}

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const money = z.number().finite().min(0).max(1_000_000);
const isoDate = z
  .string()
  .refine(
    (v) => {
      const parsed = Date.parse(v);
      if (Number.isNaN(parsed)) return false;
      const year = new Date(parsed).getUTCFullYear();
      return year >= 2000 && year <= 2100;
    },
    { message: "must be a valid date between the years 2000 and 2100" },
  )
  .describe("ISO 8601 date, e.g. 2026-01-31");
const category = z.enum(SPEND_CATEGORIES).describe("Best-fit spending category for this item");
const frequency = z.enum(RECURRENCE_FREQUENCIES).describe("How often this recurs");

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const getFinancialSummary: ToolDefinition<Record<string, never>> = {
  name: "get_financial_summary",
  description:
    "Get the student's full current financial picture: balance, committed spend, discretionary cash, safe weekly spend, next income, upcoming bills, budget categories and recent transactions. Call this whenever you need context before answering a question.",
  schema: z.object({}),
  execute: async (_args, ctx) => {
    const state = await getFinancialState(ctx.profileId);
    const summary = calculateFinancialSummary(state);
    return { message: "Checked your budget", data: { summary } };
  },
};

const setCurrentBalanceTool: ToolDefinition<{ amount: number }> = {
  name: "set_current_balance",
  description:
    "Set the student's current account balance directly. Use this when they state their balance as a fact (e.g. 'I've got £4,500 left'), not for individual purchases - use log_transaction for those.",
  schema: z.object({ amount: money.describe("The new current balance") }),
  execute: async (args, ctx) => {
    const profile = await setCurrentBalance(ctx.profileId, args.amount);
    return {
      message: `✓ Balance set to ${formatMoney(profile.currentBalance, profile.currency)}`,
      data: { profile },
    };
  },
};

const setEmergencyBufferTool: ToolDefinition<{ amount: number | null }> = {
  name: "set_emergency_buffer",
  description:
    "Set (or clear, with null) the cash the student wants to keep untouched as a safety net. This is subtracted from every discretionary-cash and safe-spend calculation.",
  schema: z.object({ amount: money.nullable().describe("Buffer amount, or null to clear it") }),
  execute: async (args, ctx) => {
    const profile = await setEmergencyBuffer(ctx.profileId, args.amount);
    return {
      message:
        args.amount === null
          ? "✓ Emergency buffer cleared"
          : `✓ Emergency buffer set to ${formatMoney(args.amount, profile.currency)}`,
      data: { profile },
    };
  },
};

const addIncomeTool: ToolDefinition<{ source: string; amount: number; date: string; frequency: (typeof RECURRENCE_FREQUENCIES)[number] }> = {
  name: "add_income",
  description:
    "Record an income the student expects to receive - a student loan/maintenance payment, a job wage, a bursary, etc. For recurring income, `date` is the next expected payment date.",
  schema: z.object({
    source: z.string().min(1).max(80).describe("Where the money is from, e.g. 'Student Finance'"),
    amount: money,
    date: isoDate,
    frequency,
  }),
  execute: async (args, ctx) => {
    const [income, currency] = await Promise.all([addIncome(ctx.profileId, args), getProfileCurrency(ctx.profileId)]);
    return {
      message: `✓ ${income.source} income of ${formatMoney(income.amount, currency)} added (${FREQUENCY_LABELS[income.frequency]})`,
      data: { income },
    };
  },
};

const addOrUpdateExpenseTool: ToolDefinition<{
  name: string;
  amount: number;
  category: (typeof SPEND_CATEGORIES)[number];
  frequency: (typeof RECURRENCE_FREQUENCIES)[number];
  nextDueDate?: string | null;
}> = {
  name: "add_or_update_expense",
  description:
    "Add a new recurring or one-off committed expense (rent, food budget, gym, subscriptions, ...), or update the amount/category/frequency of an existing expense with the same name for this student (matched case-insensitively). Use this for 'my rent is going up to £700' as well as for a brand-new expense.",
  schema: z.object({
    name: z.string().min(1).max(80).describe("Short name, e.g. 'Rent', 'Food', 'Gym'"),
    amount: money,
    category,
    frequency,
    nextDueDate: isoDate.nullable().optional().describe("Only set if a concrete next due date is known"),
  }),
  execute: async (args, ctx) => {
    const [expense, currency] = await Promise.all([
      addOrUpdateExpense(ctx.profileId, args),
      getProfileCurrency(ctx.profileId),
    ]);
    return {
      message: `✓ ${expense.name} set to ${formatMoney(expense.amount, currency)} ${FREQUENCY_LABELS[expense.frequency]}`,
      data: { expense },
    };
  },
};

const logTransactionTool: ToolDefinition<{
  merchant: string;
  amount: number;
  category: (typeof SPEND_CATEGORIES)[number];
  date?: string;
  notes?: string;
}> = {
  name: "log_transaction",
  description:
    "Log a purchase the student says they already made (e.g. 'I spent £42 at Tesco', 'I bought a £180 desk'). This immediately reduces their current balance. Infer the most likely category from the merchant/description.",
  schema: z.object({
    merchant: z.string().min(1).max(80).describe("Merchant or what was bought, e.g. 'Tesco', 'Desk'"),
    amount: money,
    category,
    date: isoDate.optional().describe("Defaults to now if omitted"),
    notes: z.string().max(200).optional(),
  }),
  execute: async (args, ctx) => {
    const { transaction, profile } = await logTransaction(ctx.profileId, { ...args, source: "chat" });
    return {
      message: `✓ ${formatMoney(transaction.amount, profile.currency)} ${transaction.merchant} logged — balance now ${formatMoney(profile.currentBalance, profile.currency)}`,
      data: { transaction, profile },
    };
  },
};

const createOrUpdateGoalTool: ToolDefinition<{ name: string; targetAmount: number; targetDate?: string | null }> = {
  name: "create_or_update_goal",
  description:
    "Create or update a savings goal (e.g. 'I want to have £600 left for summer'). Matched by name, case-insensitively, per student.",
  schema: z.object({
    name: z.string().min(1).max(80).describe("Short goal name, e.g. 'Summer buffer'"),
    targetAmount: money,
    targetDate: isoDate.nullable().optional(),
  }),
  execute: async (args, ctx) => {
    const [goal, currency] = await Promise.all([
      createOrUpdateGoal(ctx.profileId, args),
      getProfileCurrency(ctx.profileId),
    ]);
    return {
      message: `✓ Goal "${goal.name}" set to ${formatMoney(goal.targetAmount, currency)}${goal.targetDate ? ` by ${goal.targetDate.slice(0, 10)}` : ""}`,
      data: { goal },
    };
  },
};

const checkAffordabilityTool: ToolDefinition<{ purchaseAmount: number; description?: string }> = {
  name: "check_affordability",
  description:
    "Deterministically check whether the student can afford a purchase, given their current balance, committed bills and buffer. Always call this before answering an affordability question - never estimate affordability yourself.",
  schema: z.object({
    purchaseAmount: money,
    description: z.string().max(120).optional().describe("What they want to buy, for your own reference"),
  }),
  execute: async (args, ctx) => {
    const state = await getFinancialState(ctx.profileId);
    const result = checkAffordability({
      profile: state.profile,
      expenses: state.expenses,
      incomes: state.incomes,
      purchaseAmount: args.purchaseAmount,
    });
    return {
      message: `Checked affordability for ${formatMoney(args.purchaseAmount, state.profile.currency)}`,
      data: { result, description: args.description ?? null },
    };
  },
};

const getSafeWeeklySpendTool: ToolDefinition<Record<string, never>> = {
  name: "get_safe_weekly_spend",
  description:
    "Deterministically recalculate how much the student can safely spend this week, given committed bills, buffer and time until next income.",
  schema: z.object({}),
  execute: async (_args, ctx) => {
    const state = await getFinancialState(ctx.profileId);
    const engineInput = { profile: state.profile, expenses: state.expenses, incomes: state.incomes };
    const safeWeeklySpend = calculateSafeWeeklySpend(engineInput);
    const discretionaryCash = calculateDiscretionaryCash(engineInput);
    const horizonDays = calculateHorizonDays(state.incomes);
    return {
      message: "Safe weekly spend recalculated",
      data: { safeWeeklySpend, discretionaryCash, horizonDays },
    };
  },
};

const forecastBalanceTool: ToolDefinition<{ daysAhead: number }> = {
  name: "forecast_balance",
  description: "Deterministically project the student's balance a number of days into the future, accounting for known bills and income.",
  schema: z.object({ daysAhead: z.number().int().min(1).max(365) }),
  execute: async (args, ctx) => {
    const state = await getFinancialState(ctx.profileId);
    const forecastedBalance = forecastBalance(
      { profile: state.profile, expenses: state.expenses, incomes: state.incomes },
      args.daysAhead,
    );
    return {
      message: `Forecasted balance ${args.daysAhead} days ahead`,
      data: { daysAhead: args.daysAhead, forecastedBalance, currentBalance: state.profile.currentBalance },
    };
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOLS: ToolDefinition<any>[] = [
  getFinancialSummary,
  setCurrentBalanceTool,
  setEmergencyBufferTool,
  addIncomeTool,
  addOrUpdateExpenseTool,
  logTransactionTool,
  createOrUpdateGoalTool,
  checkAffordabilityTool,
  getSafeWeeklySpendTool,
  forecastBalanceTool,
];

export async function executeTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  const parsed = tool.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    throw new ToolValidationError(name, parsed.error.issues);
  }
  return tool.execute(parsed.data, ctx);
}
