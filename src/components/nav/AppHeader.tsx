"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";
import { cx } from "@/lib/cx";

const TABS = [
  { href: "/budget", label: "Budget" },
  { href: "/loan-tracker", label: "Loan Tracker" },
] as const;

export function AppHeader({ actions }: { actions?: ReactNode }) {
  const pathname = usePathname();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">{PRODUCT_NAME}</h1>
        <p className="text-sm text-ink-soft">{PRODUCT_TAGLINE}</p>
      </div>

      <nav className="flex items-center gap-1 rounded-2xl bg-cream-dark p-1" aria-label="Main">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(
                "rounded-xl px-4 py-2 text-sm font-bold transition-colors",
                active ? "bg-surface text-brand-dark shadow-tactile-sm" : "text-ink-soft hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">{actions}</div>
    </header>
  );
}
