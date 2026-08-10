import { Card } from "@/components/ui/Card";
import { CATEGORY_ICONS } from "@/lib/finance/category-icons";
import { formatMoney } from "@/lib/finance/format";
import type { FinancialSummary } from "@/lib/finance/engine";

export function RecentTransactions({ summary }: { summary: FinancialSummary }) {
  const { recentTransactions, profile } = summary;

  return (
    <Card className="p-6">
      <h2 className="text-base font-extrabold text-ink">Recent transactions</h2>
      {recentTransactions.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          Nothing logged yet — tell the assistant about a purchase, like &ldquo;I spent £15 at Greggs&rdquo;.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {recentTransactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg" aria-hidden>
                  {CATEGORY_ICONS[t.category]}
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">{t.merchant}</p>
                  <p className="text-xs text-ink-soft">
                    {new Date(t.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
              <p className="text-sm font-bold text-ink">-{formatMoney(t.amount, profile.currency)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
