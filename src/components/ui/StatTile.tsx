import type { ReactNode } from "react";
import { Card } from "./Card";
import { cx } from "@/lib/cx";

export function StatTile({
  label,
  value,
  sublabel,
  icon,
  emphasis = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <Card className={cx("p-5", emphasis && "border-brand/30 bg-brand-light/40")}>
      <div className="flex items-center gap-2 text-ink-soft">
        {icon}
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className={cx("mt-2 text-3xl font-extrabold tracking-tight", emphasis ? "text-brand-dark" : "text-ink")}>
        {value}
      </p>
      {sublabel ? <p className="mt-1 text-xs font-medium text-ink-soft">{sublabel}</p> : null}
    </Card>
  );
}
