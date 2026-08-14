import { describe, expect, it } from "vitest";
import {
  STUDENT_LOAN_RULES,
  getStudentLoanRules,
  resolveAnnualInterestRate,
  resolvePlan2AnnualInterestRate,
  type Plan2InterestModel,
} from "./studentLoanRules";

describe("STUDENT_LOAN_RULES", () => {
  it("matches the current official Plan 2 threshold, rate and write-off term", () => {
    const plan2 = getStudentLoanRules("plan2");
    expect(plan2.annualRepaymentThreshold).toBe(29_385);
    expect(plan2.repaymentRate).toBe(0.09);
    expect(plan2.writeOffYearsAfterFirstDue).toBe(30);
  });

  it("matches the current official Plan 5 threshold, rate and write-off term", () => {
    const plan5 = getStudentLoanRules("plan5");
    expect(plan5.annualRepaymentThreshold).toBe(25_000);
    expect(plan5.repaymentRate).toBe(0.09);
    expect(plan5.writeOffYearsAfterFirstDue).toBe(40);
  });

  it("every rule set cites at least one official gov.uk source and a last-verified date", () => {
    for (const rules of Object.values(STUDENT_LOAN_RULES)) {
      expect(rules.sources.length).toBeGreaterThan(0);
      for (const source of rules.sources) {
        expect(source.url).toMatch(/^https:\/\/www\.gov\.uk\//);
      }
      expect(rules.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("Plan 5 uses a flat RPI-only interest rate with no income-linked margin", () => {
    const plan5 = getStudentLoanRules("plan5");
    expect(plan5.interest.kind).toBe("flat");
    expect(resolveAnnualInterestRate(plan5, 100_000)).toBe(resolveAnnualInterestRate(plan5, 10_000));
  });
});

describe("resolvePlan2AnnualInterestRate", () => {
  const model: Plan2InterestModel = {
    kind: "income_linked",
    baseRate: 0.04,
    topRate: 0.07,
    lowerIncomeThreshold: 30_000,
    upperIncomeThreshold: 50_000,
    cappedAt: 0.06,
    whileStudyingRate: 0.06,
  };

  it("uses the base (RPI) rate at or below the lower income threshold", () => {
    expect(resolvePlan2AnnualInterestRate(model, 20_000)).toBe(0.04);
    expect(resolvePlan2AnnualInterestRate(model, 30_000)).toBe(0.04);
  });

  it("uses the while-studying rate when salary is unknown", () => {
    expect(resolvePlan2AnnualInterestRate(model, null)).toBe(0.06);
  });

  it("ramps linearly between the thresholds", () => {
    // Halfway between 30,000 and 50,000 -> halfway between 0.04 and 0.07, i.e. 0.055
    expect(resolvePlan2AnnualInterestRate(model, 40_000)).toBeCloseTo(0.055, 6);
  });

  it("clamps the uncapped top rate to the current published cap at/above the upper threshold", () => {
    // topRate (0.07) exceeds cappedAt (0.06), so the cap wins.
    expect(resolvePlan2AnnualInterestRate(model, 60_000)).toBe(0.06);
  });

  it("never exceeds the cap anywhere in the ramp", () => {
    for (let salary = 30_000; salary <= 60_000; salary += 1_000) {
      expect(resolvePlan2AnnualInterestRate(model, salary)).toBeLessThanOrEqual(0.06);
    }
  });

  it("returns the same result for identical inputs (deterministic)", () => {
    expect(resolvePlan2AnnualInterestRate(model, 35_000)).toBe(resolvePlan2AnnualInterestRate(model, 35_000));
  });
});
