"use client";

import type { ReactNode } from "react";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { cx } from "@/lib/cx";
import { clampToSliderRange, sliderPositionFromRaw, type SliderPreset, type SliderRange } from "./sliderInputs";

const labelClass = "text-xs font-bold uppercase tracking-wide text-ink-soft";

/**
 * A synchronized slider + large display value + exact editable input, used
 * for the Loan Tracker's main projection inputs. `value`/`onChange` carry
 * the raw text of the field (same shape as the plain number inputs it
 * replaces) so the slider and the editable input always share one source of
 * truth - dragging the slider writes text, typing writes text, both re-render
 * from the same string.
 */
export function SliderField({
  label,
  hint,
  ariaLabel,
  value,
  onChange,
  range,
  displayValue,
  inputPrefix,
  inputSuffix,
  presets,
  belowSlider,
}: {
  label: string;
  hint?: string;
  ariaLabel?: string;
  value: string;
  onChange: (v: string) => void;
  range: SliderRange;
  displayValue: string;
  inputPrefix?: string;
  inputSuffix?: string;
  presets?: SliderPreset[];
  belowSlider?: ReactNode;
}) {
  const { min, max, step } = range;
  const numeric = Number.parseFloat(value);
  const sliderPosition = sliderPositionFromRaw(value, min, max);
  const effectiveLabel = ariaLabel ?? label;

  return (
    <div className="space-y-2">
      <span className={labelClass}>{label}</span>
      <p className="text-2xl font-extrabold text-ink" aria-live="polite">
        {displayValue}
      </p>

      <RangeSlider
        min={min}
        max={max}
        step={step}
        value={sliderPosition}
        onChange={(n) => onChange(String(clampToSliderRange(n, min, max)))}
        ariaLabel={effectiveLabel}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-cream px-2.5 py-1">
          {inputPrefix ? <span className="text-xs font-bold text-ink-soft">{inputPrefix}</span> : null}
          <input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`${effectiveLabel} - exact value`}
            className="w-24 bg-transparent px-1 py-1 text-sm font-bold text-ink focus:outline-none"
          />
          {inputSuffix ? <span className="text-xs font-bold text-ink-soft">{inputSuffix}</span> : null}
        </div>

        {presets && presets.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(String(preset.value))}
                className={cx(
                  "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                  numeric === preset.value ? "bg-brand text-white" : "bg-cream-dark text-ink-soft hover:bg-border",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {belowSlider}
      {hint ? <p className="text-xs font-medium text-ink-faint">{hint}</p> : null}
    </div>
  );
}
