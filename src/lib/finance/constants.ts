import type { RecurrenceFrequency, SpendCategory } from "@/types/finance";

/** Canonical, ordered list of spend categories - source of truth for zod enums and UI iteration. */
export const SPEND_CATEGORIES = [
  "rent",
  "utilities",
  "groceries",
  "transport",
  "subscriptions",
  "health",
  "gym",
  "going_out",
  "entertainment",
  "shopping",
  "other",
] as const satisfies readonly SpendCategory[];

export const RECURRENCE_FREQUENCIES = [
  "one_off",
  "weekly",
  "monthly",
  "termly",
] as const satisfies readonly RecurrenceFrequency[];

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  one_off: "one-off",
  weekly: "per week",
  monthly: "per month",
  termly: "per term",
};

/** Average number of weeks in a calendar month (52 / 12). */
export const WEEKS_PER_MONTH = 52 / 12;

/**
 * Assumed length of a UK university term in weeks, used to convert
 * `termly` amounts to weekly/monthly equivalents. This is a budgeting
 * estimate, not an institution-specific calendar.
 */
export const TERM_WEEKS = 12;

/** Horizon used when a profile has no known upcoming income. */
export const DEFAULT_HORIZON_DAYS = 30;

/** Categories treated as essential (needs) rather than discretionary (wants). */
export const ESSENTIAL_CATEGORIES: ReadonlySet<SpendCategory> = new Set([
  "rent",
  "utilities",
  "groceries",
  "transport",
  "subscriptions",
  "health",
]);

export function isEssentialCategory(category: SpendCategory): boolean {
  return ESSENTIAL_CATEGORIES.has(category);
}

export const CATEGORY_LABELS: Record<SpendCategory, string> = {
  rent: "Rent",
  utilities: "Utilities",
  groceries: "Groceries",
  transport: "Transport",
  subscriptions: "Subscriptions",
  health: "Health",
  gym: "Gym",
  going_out: "Going out",
  entertainment: "Entertainment",
  shopping: "Shopping",
  other: "Other",
};

/** Thresholds that drive checkAffordability's classification. Documented so the
 * judging/demo team can see these are transparent heuristics, not "AI magic". */
export const AFFORDABILITY_THRESHOLDS = {
  /** purchase / discretionaryCash below this -> "comfortable" */
  comfortable: 0.25,
  /** purchase / discretionaryCash below this -> "caution" (else "risky") */
  caution: 0.5,
};
