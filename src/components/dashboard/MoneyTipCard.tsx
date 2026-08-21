"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { buildTipQueue, type TipContext } from "@/lib/tips/select-tip";
import type { TipCategory } from "@/lib/tips/tips-data";

const CATEGORY_EMOJI: Record<TipCategory, string> = {
  student_finance: "💡",
  budgeting: "💡",
  borrowing: "⚠️",
  loan_repayment: "🎓",
};

export function MoneyTipCard({ context }: { context: TipContext }) {
  const queue = useMemo(() => buildTipQueue(context), [context]);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || queue.length === 0) return null;

  const tip = queue[index % queue.length];
  const isWarning = tip.category === "borrowing";

  return (
    <Card
      className={
        isWarning
          ? "animate-pop-in border-warn/30 bg-warn-light p-4"
          : "animate-pop-in border-accent/30 bg-accent-light p-4"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`text-xs font-bold uppercase tracking-wide ${isWarning ? "text-warn-dark" : "text-accent-dark"}`}>
          {CATEGORY_EMOJI[tip.category]} {isWarning ? "Before borrowing" : "Money tip"}
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss tip"
          className={`text-xs font-bold ${isWarning ? "text-warn-dark/60 hover:text-warn-dark" : "text-accent-dark/60 hover:text-accent-dark"}`}
        >
          ✕
        </button>
      </div>

      <p className={`mt-1.5 text-sm font-bold ${isWarning ? "text-warn-dark" : "text-ink"}`}>{tip.title}</p>
      <p className="mt-0.5 text-sm font-medium text-ink-soft">{tip.body}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <a
          href={tip.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs font-bold underline underline-offset-2 ${isWarning ? "text-warn-dark" : "text-accent-dark"}`}
        >
          {tip.sourceLabel} →
        </a>
        {queue.length > 1 ? (
          <Button variant="ghost" className="!px-3 !py-1 text-xs" onClick={() => setIndex((i) => (i + 1) % queue.length)}>
            Next tip
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
