import { Card } from "@/components/ui/Card";
import { formatMoney, formatMoneyWhole } from "@/lib/finance/format";
import { FREQUENCY_LABELS } from "@/lib/finance/constants";
import { cx } from "@/lib/cx";
import type { FinancialSummary } from "@/lib/finance/engine";

function formatDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

/**
 * The hero's central concept is a comparison, not a single number: how long
 * the money ACTUALLY lasts at the current rate (`actualRunway`) vs. how
 * long it NEEDS to last (`horizonDays`, unchanged - the confirmed next
 * major payment/explicit date/funding period end). Everything else -
 * safe extra spend, on-track/short status, next payment, balance - is
 * secondary detail in service of that one comparison. See the product
 * brief's "3-second read" requirement: runway vs. target, then status,
 * then supporting numbers.
 */
export function BalanceHero({ summary }: { summary: FinancialSummary }) {
  const {
    profile,
    safeWeeklySpend,
    suggestedWeeklyReduction,
    nextMajorPayment,
    recurringIncomes,
    actualRunway,
    horizonDays,
    horizonSource,
  } = summary;
  const balanceKnown = profile.balanceKnown;
  const horizonConfirmed = horizonSource !== "default";
  const offTrack = actualRunway !== null && !actualRunway.meetsTarget;
  const onTrack = actualRunway !== null && actualRunway.meetsTarget;

  return (
    <Card className="p-8 shadow-tactile">
      <p className="text-sm font-semibold text-ink-soft">Your money runway</p>

      <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <p
            className={cx(
              "text-4xl font-extrabold tracking-tight",
              offTrack ? "text-warn-dark" : onTrack ? "text-brand-dark" : "text-ink",
            )}
          >
            {actualRunway ? (actualRunway.meetsTarget ? `${horizonDays}+` : actualRunway.days) : "—"}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Your runway</p>
        </div>
        <div>
          <p className="text-3xl font-extrabold tracking-tight text-ink">{horizonConfirmed ? horizonDays : "—"}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Needs to last</p>
        </div>
        <div>
          <p className="text-3xl font-extrabold tracking-tight text-brand-dark">
            {safeWeeklySpend !== null ? formatMoney(safeWeeklySpend, profile.currency) : "—"}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Safe extra spend this week <span className="font-medium normal-case text-ink-faint">· after your planned costs</span>
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-5">
        {offTrack ? (
          <>
            <p className="flex items-center gap-2 text-sm font-bold text-warn-dark">
              <span className="h-2 w-2 rounded-full bg-warn" aria-hidden="true" />
              {actualRunway!.daysShort} days short
            </p>
            {suggestedWeeklyReduction !== null ? (
              <p className="mt-1 text-sm font-medium text-ink-soft">
                Cut about <span className="font-bold text-ink">{formatMoneyWhole(suggestedWeeklyReduction, profile.currency)}/week</span>{" "}
                {nextMajorPayment ? "to make it to your next payment." : "to stay on track."}
              </p>
            ) : null}
            {actualRunway!.runOutDate ? (
              <p className="mt-2 text-xs font-medium text-ink-faint">
                At this rate, your money could run out around {formatDayMonth(actualRunway!.runOutDate)}.
              </p>
            ) : null}
          </>
        ) : onTrack ? (
          <>
            <p className="flex items-center gap-2 text-sm font-bold text-brand-dark">
              <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
              On track
            </p>
            <p className="mt-1 text-sm font-medium text-ink-soft">
              {nextMajorPayment ? `Covered until your next ${nextMajorPayment.income.source.toLowerCase()} payment.` : "Covered until your target date."}
            </p>
          </>
        ) : balanceKnown ? (
          <p className="text-xs font-medium text-ink-faint">Add your next payment date to see your full runway.</p>
        ) : (
          <p className="text-sm font-medium text-ink-faint">Add your current balance to see your runway.</p>
        )}
      </div>

      {nextMajorPayment || recurringIncomes.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-4 text-sm font-medium text-ink-soft">
          {nextMajorPayment ? (
            <p>
              <span className="font-bold text-ink">Next major payment:</span> {formatMoney(nextMajorPayment.income.amount, profile.currency)}{" "}
              {nextMajorPayment.income.source} · {formatDayMonth(nextMajorPayment.occursOn)}
            </p>
          ) : null}
          {recurringIncomes.map((income) => (
            <span key={income.id} className="rounded-full bg-brand-light px-3 py-1 text-xs font-bold text-brand-dark">
              +{formatMoneyWhole(income.amount, profile.currency)} {FREQUENCY_LABELS[income.frequency]} · {income.source}
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-xs font-medium text-ink-faint">
        {balanceKnown ? formatMoney(profile.currentBalance, profile.currency) : "Not provided"}{" "}
        <span className="normal-case">available now</span>
      </p>
    </Card>
  );
}
