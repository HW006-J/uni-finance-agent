/**
 * Pure helpers for the Custom Loan calculator's slider + editable-value
 * inputs: slider ranges/presets and display-label formatting. Mirrors
 * `sliderInputs.ts` (the Student Loan tracker's equivalent) so the two
 * calculators share one visual/interaction language.
 */
import { formatMoneyWhole } from "@/lib/finance/format";
import type { SliderPreset, SliderRange } from "./sliderInputs";

export const CUSTOM_LOAN_BALANCE_SLIDER: SliderRange = { min: 0, max: 20_000, step: 100 };
export const CUSTOM_LOAN_APR_SLIDER: SliderRange = { min: 0, max: 50, step: 0.5 };
export const CUSTOM_LOAN_REPAYMENT_SLIDER: SliderRange = { min: 0, max: 1_000, step: 10 };

export const CUSTOM_LOAN_BALANCE_PRESETS: SliderPreset[] = [
  { label: "£500", value: 500 },
  { label: "£1,500", value: 1_500 },
  { label: "£5,000", value: 5_000 },
];

export const CUSTOM_LOAN_APR_PRESETS: SliderPreset[] = [
  { label: "0%", value: 0 },
  { label: "9.9%", value: 9.9 },
  { label: "24.9%", value: 24.9 },
  { label: "39.9%", value: 39.9 },
];

export const CUSTOM_LOAN_REPAYMENT_PRESETS: SliderPreset[] = [
  { label: "£25", value: 25 },
  { label: "£50", value: 50 },
  { label: "£100", value: 100 },
  { label: "£200", value: 200 },
];

export function formatCustomLoanAprLabel(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded}% APR`;
}

export function formatCustomLoanRepaymentLabel(amount: number): string {
  return `${formatMoneyWhole(amount)}/month`;
}
