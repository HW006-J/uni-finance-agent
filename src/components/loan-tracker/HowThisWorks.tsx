"use client";

import { useState, type ReactNode } from "react";

/**
 * A small, subtle "How this works"-style disclosure. Closed by default so
 * the page reads in a few seconds; opens an inline panel with the detail a
 * curious student can dig into, without making anyone read it to understand
 * the headline numbers.
 */
export function HowThisWorks({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-xs font-bold text-accent-dark underline underline-offset-2 hover:text-accent-dark/80"
      >
        {label}
      </button>
      {open ? (
        <div className="mt-2 max-w-sm rounded-2xl border border-border bg-cream-dark p-4 text-xs font-medium text-ink-soft shadow-tactile-sm">
          <p className="text-xs font-extrabold text-ink">{title}</p>
          <div className="mt-1.5 space-y-1.5">{children}</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 text-xs font-bold text-ink-faint underline underline-offset-2 hover:text-ink-soft"
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
