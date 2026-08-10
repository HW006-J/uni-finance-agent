import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type BadgeTone = "brand" | "accent" | "warn" | "caution" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  brand: "bg-brand-light text-brand-dark",
  accent: "bg-accent-light text-accent-dark",
  warn: "bg-warn-light text-warn-dark",
  caution: "bg-caution-light text-caution-dark",
  neutral: "bg-cream-dark text-ink-soft",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}
