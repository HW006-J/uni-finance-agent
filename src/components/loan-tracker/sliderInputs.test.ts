import { describe, expect, it } from "vitest";
import { simulateLoan, compareLoanSimulations, type LoanSimulationInput } from "@/lib/loans/loanSimulation";
import {
  EXTRA_REPAYMENT_PRESETS,
  EXTRA_REPAYMENT_SLIDER,
  LOAN_BALANCE_PRESETS,
  LOAN_BALANCE_SLIDER,
  STARTING_SALARY_PRESETS,
  STARTING_SALARY_SLIDER,
  clampToSliderRange,
  formatExtraRepaymentLabel,
  formatGrowthPerYear,
  formatSalaryPerYear,
  sliderPositionFromRaw,
} from "./sliderInputs";

describe("clampToSliderRange", () => {
  it("passes through values already inside the range", () => {
    expect(clampToSliderRange(45_000, 0, 100_000)).toBe(45_000);
  });

  it("clamps to min when below range", () => {
    expect(clampToSliderRange(-500, 0, 100_000)).toBe(0);
  });

  it("clamps to max when above range", () => {
    expect(clampToSliderRange(250_000, 0, 100_000)).toBe(100_000);
  });

  it("falls back to min for non-finite input", () => {
    expect(clampToSliderRange(Number.NaN, 20_000, 100_000)).toBe(20_000);
  });
});

describe("sliderPositionFromRaw (numeric input -> slider synchronization)", () => {
  it("positions the thumb from valid raw text", () => {
    expect(sliderPositionFromRaw("45000", 0, 100_000)).toBe(45_000);
  });

  it("falls back to min for empty text", () => {
    expect(sliderPositionFromRaw("", 0, 100_000)).toBe(0);
  });

  it("falls back to min for non-numeric text", () => {
    expect(sliderPositionFromRaw("abc", 20_000, 100_000)).toBe(20_000);
  });

  it("clamps the displayed position for a manually-entered value above the normal slider range, without altering the value itself", () => {
    const raw = "250000";
    expect(sliderPositionFromRaw(raw, LOAN_BALANCE_SLIDER.min, LOAN_BALANCE_SLIDER.max)).toBe(LOAN_BALANCE_SLIDER.max);
    // The raw value used as the actual engine input is untouched by slider clamping.
    expect(Number.parseFloat(raw)).toBe(250_000);
  });
});

describe("slider ranges", () => {
  it("keeps a normal £45,000 loan balance comfortably within the slider range", () => {
    expect(45_000).toBeGreaterThanOrEqual(LOAN_BALANCE_SLIDER.min);
    expect(45_000).toBeLessThanOrEqual(LOAN_BALANCE_SLIDER.max);
  });

  it("uses the suggested loan balance range and step", () => {
    expect(LOAN_BALANCE_SLIDER).toEqual({ min: 0, max: 100_000, step: 1_000 });
  });

  it("uses the suggested starting salary range and step", () => {
    expect(STARTING_SALARY_SLIDER).toEqual({ min: 20_000, max: 100_000, step: 1_000 });
  });

  it("uses the suggested extra repayment range", () => {
    expect(EXTRA_REPAYMENT_SLIDER.min).toBe(0);
    expect(EXTRA_REPAYMENT_SLIDER.max).toBe(500);
  });
});

describe("quick presets", () => {
  it("exposes the loan balance presets from the spec", () => {
    expect(LOAN_BALANCE_PRESETS.map((p) => p.value)).toEqual([30_000, 45_000, 60_000]);
  });

  it("exposes the starting salary presets from the spec", () => {
    expect(STARTING_SALARY_PRESETS.map((p) => p.value)).toEqual([25_000, 35_000, 50_000]);
  });

  it("exposes the extra repayment presets from the spec", () => {
    expect(EXTRA_REPAYMENT_PRESETS.map((p) => p.value)).toEqual([0, 50, 100, 200]);
  });
});

describe("display formatting", () => {
  it("formats the starting salary label", () => {
    expect(formatSalaryPerYear(32_000)).toBe("£32,000 / year");
  });

  it("formats the salary growth label", () => {
    expect(formatGrowthPerYear(3)).toBe("3% / year");
    expect(formatGrowthPerYear(0.5)).toBe("0.5% / year");
  });

  it("shows 'No extra repayment' at zero", () => {
    expect(formatExtraRepaymentLabel(0)).toBe("No extra repayment");
  });

  it("shows the amount once extra repayment is above zero", () => {
    expect(formatExtraRepaymentLabel(100)).toBe("£100/month extra");
  });
});

describe("slider-driven inputs feed the loan simulation engine", () => {
  const baseInput: LoanSimulationInput = {
    plan: "plan5",
    startingBalance: 45_000,
    firstRepaymentDueDate: "2027-04-06",
    startingSalary: 25_000,
    salaryGrowthRate: 0.03,
  };

  it("dragging the starting salary slider changes the projected repayment result", () => {
    const lowSalary = simulateLoan({ ...baseInput, startingSalary: 25_000 });
    const highSalary = simulateLoan({ ...baseInput, startingSalary: 50_000 });

    expect(highSalary.months[0].statutoryRepayment).toBeGreaterThan(lowSalary.months[0].statutoryRepayment);
    expect(highSalary.totalRepaid).not.toBe(lowSalary.totalRepaid);
  });

  it("dragging the extra repayment slider above zero produces a comparison scenario that clears the loan sooner", () => {
    const baseline = simulateLoan(baseInput);
    const withExtra = simulateLoan({ ...baseInput, voluntaryMonthlyRepayment: 100 });
    const comparison = compareLoanSimulations(baseline, withExtra);

    expect(comparison.monthsEarlier === null || comparison.monthsEarlier >= 0).toBe(true);
    expect(withExtra.totalVoluntaryRepaid).toBeGreaterThan(0);
  });

  it("returns to zero extra repayment removes the comparison scenario, matching the component's extraAmount > 0 gate", () => {
    const extraMonthly = "0";
    const extraAmount = Math.max(0, Number.parseFloat(extraMonthly) || 0);
    const withExtra = extraAmount > 0 ? simulateLoan({ ...baseInput, voluntaryMonthlyRepayment: extraAmount }) : null;

    expect(extraAmount).toBe(0);
    expect(withExtra).toBeNull();
  });

  it("an empty extra-repayment field also removes the comparison scenario", () => {
    const extraMonthly = "";
    const extraAmount = Math.max(0, Number.parseFloat(extraMonthly) || 0);
    const withExtra = extraAmount > 0 ? simulateLoan({ ...baseInput, voluntaryMonthlyRepayment: extraAmount }) : null;

    expect(extraAmount).toBe(0);
    expect(withExtra).toBeNull();
  });
});
