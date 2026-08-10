import { Card } from "@/components/ui/Card";

export function EmptyState() {
  return (
    <Card className="p-10 text-center shadow-tactile">
      <p className="text-4xl">👋</p>
      <h2 className="mt-3 text-2xl font-extrabold text-ink">Let&rsquo;s build your money picture</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
        Tell the assistant about your balance, income and regular costs in your own words — it&rsquo;ll turn that
        into a real budget right here.
      </p>
      <div className="mx-auto mt-5 max-w-lg rounded-2xl bg-cream-dark px-5 py-4 text-left text-sm font-medium text-ink-soft">
        &ldquo;I&rsquo;ve got £4,500 left from my maintenance loan. My next Student Finance payment is £3,000 in
        January. Rent is £650 a month, food is around £55 a week, my gym is £25 a month and I spend about £50 a
        week going out.&rdquo;
      </div>
    </Card>
  );
}
