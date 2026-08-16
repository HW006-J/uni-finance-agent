"use client";

import { cx } from "@/lib/cx";

/**
 * A chunky, tactile range input. Thumb/track look is defined by the
 * `.slider-chunky` rule in globals.css (native range inputs can't be styled
 * with utility classes alone). The filled portion left of the thumb is a
 * gradient computed from the current position, redrawn on every change.
 */
export function RangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  className?: string;
}) {
  const clamped = Math.min(Math.max(value, min), max);
  const percent = max > min ? ((clamped - min) / (max - min)) * 100 : 0;

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={clamped}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={ariaLabel}
      className={cx("slider-chunky", className)}
      style={{
        background: `linear-gradient(to right, var(--color-brand) 0%, var(--color-brand) ${percent}%, var(--color-cream-dark) ${percent}%, var(--color-cream-dark) 100%)`,
      }}
    />
  );
}
