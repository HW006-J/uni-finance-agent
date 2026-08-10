import { Card } from "@/components/ui/Card";
import { CATEGORY_LABELS } from "@/lib/finance/constants";
import { CATEGORY_ICONS } from "@/lib/finance/category-icons";
import { formatMoney } from "@/lib/finance/format";
import type { FinancialSummary } from "@/lib/finance/engine";

export function BudgetCategories({ summary }: { summary: FinancialSummary }) {
  const { budgetCategories, profile } = summary;

  return (
    <Card className="p-6">
      <h2 className="text-base font-extrabold text-ink">Budget categories</h2>
      {budgetCategories.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          No recurring expenses yet — tell the assistant about your rent, food or subscriptions to see them here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {budgetCategories.map((c) => (
            <li key={c.category} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="text-xl" aria-hidden>
                  {CATEGORY_ICONS[c.category]}
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">{CATEGORY_LABELS[c.category]}</p>
                  <p className="text-xs text-ink-soft">{c.essential ? "Essential" : "Discretionary"}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-ink">{formatMoney(c.weeklyAmount, profile.currency)}/wk</p>
                <p className="text-xs text-ink-soft">{formatMoney(c.monthlyAmount, profile.currency)}/mo</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
