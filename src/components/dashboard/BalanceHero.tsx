import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/finance/format";
import type { FinancialSummary } from "@/lib/finance/engine";

export function BalanceHero({ summary }: { summary: FinancialSummary }) {
  const { profile, safeWeeklySpend, discretionaryCash, nextIncome } = summary;

  return (
    <Card className="p-8 shadow-tactile">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-ink-soft">Current balance</p>
          <p className="mt-1 text-5xl font-extrabold tracking-tight text-ink">
            {formatMoney(profile.currentBalance, profile.currency)}
          </p>
          {nextIncome ? (
            <p className="mt-3 text-sm font-medium text-ink-soft">
              Next up: <span className="font-bold text-ink">{nextIncome.income.source}</span>,{" "}
              {formatMoney(nextIncome.income.amount, profile.currency)} in{" "}
              <span className="font-bold text-ink">
                {nextIncome.daysAway} day{nextIncome.daysAway === 1 ? "" : "s"}
              </span>
            </p>
          ) : (
            <p className="mt-3 text-sm font-medium text-ink-soft">No upcoming income on record yet</p>
          )}
        </div>
        <div className="rounded-2xl bg-brand-light px-6 py-4">
          <p className="text-sm font-bold text-brand-dark">Safe to spend this week</p>
          <p className="mt-1 text-3xl font-extrabold text-brand-dark">
            {formatMoney(safeWeeklySpend, profile.currency)}
          </p>
          <p className="mt-2 text-xs font-medium text-brand-dark/70">
            {formatMoney(discretionaryCash, profile.currency)} discretionary before next income
          </p>
        </div>
      </div>
    </Card>
  );
}
