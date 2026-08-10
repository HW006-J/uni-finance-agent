import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/finance/format";
import type { FinancialSummary } from "@/lib/finance/engine";

export function GoalsPanel({ summary }: { summary: FinancialSummary }) {
  const { goals, profile } = summary;
  if (goals.length === 0) return null;

  return (
    <Card className="p-6">
      <h2 className="text-base font-extrabold text-ink">Goals</h2>
      <ul className="mt-4 space-y-3">
        {goals.map((g) => (
          <li key={g.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-ink">🎯 {g.name}</p>
              {g.targetDate ? (
                <p className="text-xs text-ink-soft">
                  by {new Date(g.targetDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </p>
              ) : null}
            </div>
            <p className="text-sm font-bold text-ink">{formatMoney(g.targetAmount, profile.currency)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
