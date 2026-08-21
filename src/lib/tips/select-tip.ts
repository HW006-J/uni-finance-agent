/**
 * Deterministic tip selection - Gemini is never involved. Contextual tips
 * (matching a real, detected situation from stored data) are surfaced
 * ahead of the general rotation, highest priority first.
 */
import type { FinancialSummary } from "@/lib/finance/engine";
import { MONEY_TIPS, type MoneyTip, type TipTrigger } from "./tips-data";

export interface TipContext {
  page: "budget" | "loan_tracker";
  summary?: FinancialSummary;
}

export function detectTriggers(context: TipContext): TipTrigger[] {
  const triggers: TipTrigger[] = [];
  if (context.page === "loan_tracker") triggers.push("loan_tracker_view");

  const summary = context.summary;
  if (summary) {
    if (summary.discretionaryCash !== null && summary.discretionaryCash < 0) {
      triggers.push("shortfall_projected");
    }
    if (summary.nextMajorPayment === null && summary.fundingAwards.length === 0) {
      triggers.push("no_income_known");
    }
    if (summary.fundingAwards.some((a) => !a.scheduleKnown)) {
      triggers.push("funding_award_schedule_unknown");
    }
  }
  return triggers;
}

/** Ordered, de-duplicated tip queue for the given context: eligible contextual tips (by priority) first, then the general rotation. */
export function buildTipQueue(context: TipContext): MoneyTip[] {
  const triggers = detectTriggers(context);
  const contextual = MONEY_TIPS.filter((t) => t.trigger && triggers.includes(t.trigger)).sort(
    (a, b) => b.priority - a.priority,
  );
  const general = MONEY_TIPS.filter((t) => !t.trigger);

  const seen = new Set<string>();
  const queue: MoneyTip[] = [];
  for (const tip of [...contextual, ...general]) {
    if (!seen.has(tip.id)) {
      seen.add(tip.id);
      queue.push(tip);
    }
  }
  return queue;
}
