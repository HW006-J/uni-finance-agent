/**
 * Pure helpers for the Loan Tracker's slider + editable-value inputs:
 * slider ranges/presets, and the raw-text <-> slider-position <-> display
 * label conversions. Kept side-effect free and separate from
 * LoanTrackerShell so the "slider value -> engine input" wiring can be unit
 * tested without rendering React.
 */

import { formatMoneyWhole } from "@/lib/finance/format";

export interface SliderRange {
  min: number;
  max: number;
  step: number;
}

export interface SliderPreset {
  label: string;
  value: number;
}

export const LOAN_BALANCE_SLIDER: SliderRange = { min: 0, max: 100_000, step: 1_000 };
export const STARTING_SALARY_SLIDER: SliderRange = { min: 20_000, max: 100_000, step: 1_000 };
export const SALARY_GROWTH_SLIDER: SliderRange = { min: 0, max: 10, step: 0.5 };
export const EXTRA_REPAYMENT_SLIDER: SliderRange = { min: 0, max: 500, step: 25 };

export const LOAN_BALANCE_PRESETS: SliderPreset[] = [
  { label: "£30k", value: 30_000 },
  { label: "£45k", value: 45_000 },
  { label: "£60k", value: 60_000 },
];

export const STARTING_SALARY_PRESETS: SliderPreset[] = [
  { label: "£25k", value: 25_000 },
  { label: "£35k", value: 35_000 },
  { label: "£50k", value: 50_000 },
];

export const EXTRA_REPAYMENT_PRESETS: SliderPreset[] = [
  { label: "£0", value: 0 },
  { label: "£50", value: 50 },
  { label: "£100", value: 100 },
  { label: "£200", value: 200 },
];

/**
 * Clamps a value into a slider's [min, max] range, for positioning the
 * thumb only - never used to limit the actual value sent to the engine, so
 * manually-entered values above `max` (e.g. an unusually large loan
 * balance) remain fully supported.
 */
export function clampToSliderRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * The numeric position a slider thumb should sit at given the raw text of
 * its paired editable input. Empty/invalid text falls back to `min`; values
 * above `max` (valid manual entries) are clamped for display purposes only.
 */
export function sliderPositionFromRaw(raw: string, min: number, max: number): number {
  return clampToSliderRange(Number.parseFloat(raw), min, max);
}

export function formatSalaryPerYear(amount: number): string {
  return `${formatMoneyWhole(amount)} / year`;
}

export function formatGrowthPerYear(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded}% / year`;
}

export function formatExtraRepaymentLabel(amount: number): string {
  return amount > 0 ? `${formatMoneyWhole(amount)}/month extra` : "No extra repayment";
}
