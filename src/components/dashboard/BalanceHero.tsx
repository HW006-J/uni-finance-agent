import { Card } from "@/components/ui/Card";
import { formatMoney, formatMoneyWhole } from "@/lib/finance/format";
import type { FinancialSummary } from "@/lib/finance/engine";

function formatDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export function BalanceHero({ summary }: { summary: FinancialSummary }) {
  const { profile, safeWeeklySpend, discretionaryCash, shortfallAmount, suggestedWeeklyReduction, nextIncome, runOutEstimate, horizonSource, horizonDate } =
    summary;
  const balanceKnown = profile.balanceKnown;
  const horizonConfirmed = horizonSource !== "default";
  const gapDays = runOutEstimate && nextIncome ? nextIncome.daysAway - runOutEstimate.days : null;

  return (
    <Card className="p-8 shadow-tactile">
      <p className="text-sm font-semibold text-ink-soft">Your money runway</p>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-5xl font-extrabold tracking-tight text-ink">
            {nextIncome ? `${nextIncome.daysAway} day${nextIncome.daysAway === 1 ? "" : "s"}` : "—"}
          </p>
          <p className="mt-1 text-sm font-medium text-ink-soft">
            {nextIncome ? "until your next payment" : "No upcoming payment on record yet"}
          </p>
        </div>
        <div className="rounded-2xl bg-brand-light px-6 py-4">
          <p className="text-sm font-bold text-brand-dark">Available now</p>
          <p className="mt-1 text-3xl font-extrabold text-brand-dark">
            {balanceKnown ? formatMoney(profile.currentBalance, profile.currency) : "Not provided"}
          </p>
          {!balanceKnown ? (
            <p className="mt-2 text-xs font-medium text-brand-dark/70">Tell Runway how much you have now for an accurate plan.</p>
          ) : null}
        </div>
      </div>

      {nextIncome ? (
        <p className="mt-4 text-sm font-medium text-ink-soft">
          <span className="font-bold text-ink">Next payment:</span> {formatMoney(nextIncome.income.amount, profile.currency)}{" "}
          {nextIncome.income.source} · {formatDayMonth(nextIncome.occursOn)}
        </p>
      ) : null}

      <div className="mt-5 border-t border-border pt-5">
        {shortfallAmount !== null ? (
          <>
            <p className="text-sm font-bold text-caution-dark">Projected shortfall</p>
            <p className="mt-1 text-2xl font-extrabold text-ink">{formatMoney(shortfallAmount, profile.currency)}</p>
            {suggestedWeeklyReduction !== null ? (
              <p className="mt-1 text-sm font-medium text-ink-soft">
                Reduce spending by about{" "}
                <span className="font-bold text-ink">{formatMoneyWhole(suggestedWeeklyReduction, profile.currency)}/week</span> to
                stay on track.
              </p>
            ) : null}
            {runOutEstimate && gapDays !== null && gapDays > 0 ? (
              <p className="mt-3 text-xs font-semibold text-caution-dark">
                At your current spending, your money could run out around {formatDayMonth(runOutEstimate.date)} — a {gapDays}-day
                gap before your next payment.
              </p>
            ) : null}
          </>
        ) : balanceKnown && nextIncome ? (
          <>
            <p className="text-sm font-bold text-brand-dark">You&rsquo;re on track</p>
            <p className="mt-1 text-sm font-medium text-ink-soft">
              At your current spending, your money should last until your next payment.
            </p>
            <div className="mt-3 flex flex-wrap gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Safe to spend this week</p>
                <p className="mt-1 text-xl font-extrabold text-ink">
                  {safeWeeklySpend !== null ? formatMoney(safeWeeklySpend, profile.currency) : "—"}
                </p>
              </div>
              {discretionaryCash !== null ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Projected buffer at next payment</p>
                  <p className="mt-1 text-xl font-extrabold text-ink">{formatMoney(discretionaryCash, profile.currency)}</p>
                </div>
              ) : null}
            </div>
          </>
        ) : balanceKnown && horizonConfirmed ? (
          <>
            <p className="text-sm font-bold text-brand-dark">You&rsquo;re on track</p>
            <p className="mt-1 text-sm font-medium text-ink-soft">
              At your current spending, your money should last through {formatDayMonth(horizonDate)}.
            </p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-soft">Safe to spend this week</p>
            <p className="mt-1 text-xl font-extrabold text-ink">
              {safeWeeklySpend !== null ? formatMoney(safeWeeklySpend, profile.currency) : "—"}
            </p>
          </>
        ) : balanceKnown ? (
          <>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Safe to spend this week</p>
            <p className="mt-1 text-xl font-extrabold text-ink">
              {safeWeeklySpend !== null ? formatMoney(safeWeeklySpend, profile.currency) : "—"}
            </p>
            <p className="mt-2 text-xs font-medium text-ink-faint">Add your next payment date to see your full runway.</p>
          </>
        ) : (
          <p className="text-sm font-medium text-ink-faint">Add your current balance to see your runway.</p>
        )}
      </div>
    </Card>
  );
}
