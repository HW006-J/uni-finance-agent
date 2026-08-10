import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark active:bg-brand-dark",
  secondary: "bg-cream-dark text-ink hover:bg-border active:bg-border",
  ghost: "bg-transparent text-ink-soft hover:bg-cream-dark hover:text-ink",
  danger: "bg-warn text-white hover:bg-warn-dark active:bg-warn-dark",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all",
        "active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
