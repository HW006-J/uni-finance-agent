import { Card } from "@/components/ui/Card";

export const EMPTY_STATE_SUGGESTED_PROMPT =
  "I've got £3,400 available now. My next maintenance payment is £3,200 on 8 January. Rent is £650 a month, food is £55 a week and I spend around £40 a week going out.";

export function EmptyState() {
  return (
    <Card className="p-10 text-center shadow-tactile">
      <p className="text-4xl">🛫</p>
      <h2 className="mt-3 text-2xl font-extrabold text-ink">Build your runway</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
        Tell us what you have now, when you&rsquo;re next getting paid, and your regular costs.
      </p>
      <div className="mx-auto mt-5 max-w-lg rounded-2xl bg-cream-dark px-5 py-4 text-left text-sm font-medium text-ink-soft">
        &ldquo;{EMPTY_STATE_SUGGESTED_PROMPT}&rdquo;
      </div>
    </Card>
  );
}
