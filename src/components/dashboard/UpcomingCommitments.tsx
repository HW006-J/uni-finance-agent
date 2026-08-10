import { Card } from "@/components/ui/Card";
import { CATEGORY_ICONS } from "@/lib/finance/category-icons";
import { formatMoney } from "@/lib/finance/format";
import type { FinancialSummary } from "@/lib/finance/engine";

export function UpcomingCommitments({ summary }: { summary: FinancialSummary }) {
  const { upcomingCommitments, profile } = summary;

  return (
    <Card className="p-6">
      <h2 className="text-base font-extrabold text-ink">Upcoming commitments</h2>
      {upcomingCommitments.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Nothing dated in the next 60 days.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {upcomingCommitments.map((c) => (
            <li key={c.expenseId} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg" aria-hidden>
                  {CATEGORY_ICONS[c.category]}
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">{c.name}</p>
                  <p className="text-xs text-ink-soft">
                    {new Date(c.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
              <p className="text-sm font-bold text-ink">{formatMoney(c.amount, profile.currency)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
