/**
 * Centralized UK student loan repayment rules for the plans this MVP
 * supports: Plan 2 and Plan 5 (English undergraduate loans). Every
 * threshold, rate and write-off term here is sourced from an official
 * GOV.UK page - see `sources` on each rule set - and stamped with the date
 * it was last checked against the live page (`lastVerified`).
 *
 * These figures are NOT guaranteed to hold for the life of a 30-40 year
 * projection - interest rates in particular are reviewed periodically.
 * The Loan Tracker UI must present projections as illustrative estimates
 * under the CURRENT rules, never as guaranteed future amounts. If you're
 * updating this file because the current official numbers changed, bump
 * `lastVerified` and update `sources`.
 *
 * This app deliberately does NOT support Plan 1, Plan 3 (Postgraduate) or
 * Plan 4 (Scotland) - the UI must say so rather than silently mis-modelling
 * a plan it doesn't actually implement.
 */

export type LoanPlan = "plan2" | "plan5";

export const SUPPORTED_LOAN_PLANS: readonly LoanPlan[] = ["plan2", "plan5"] as const;

export interface RuleSource {
  label: string;
  url: string;
}

/**
 * Plan 2 interest after leaving the course is income-linked: RPI at/below
 * the lower income threshold, ramping linearly up to RPI+3% at/above the
 * upper income threshold, currently subject to a published cap. While
 * studying (or when income isn't known), the flat `whileStudyingRate`
 * applies - itself the same current cap, since RPI+3% while studying
 * exceeds it under the 2026/27 rules.
 */
export interface Plan2InterestModel {
  kind: "income_linked";
  baseRate: number;
  topRate: number;
  lowerIncomeThreshold: number;
  upperIncomeThreshold: number;
  /** Current published cap on the resulting rate for the effective period below. Null if no cap is currently in force. */
  cappedAt: number | null;
  whileStudyingRate: number;
}

/** Plan 5 interest is a single published rate (RPI, no income-linked margin). */
export interface FlatInterestModel {
  kind: "flat";
  rate: number;
}

export interface StudentLoanRuleSet {
  plan: LoanPlan;
  label: string;
  /** UK tax year these repayment-threshold figures apply to. */
  effectiveTaxYear: string;
  annualRepaymentThreshold: number;
  repaymentRate: number;
  writeOffYearsAfterFirstDue: number;
  interest: Plan2InterestModel | FlatInterestModel;
  /** Date range the published interest figures cover. */
  interestEffectiveFrom: string;
  interestEffectiveTo: string;
  sources: RuleSource[];
  lastVerified: string;
}

const GOV_UK_REPAYMENT_THRESHOLDS: RuleSource = {
  label: "GOV.UK — Repaying your student loan: what you pay",
  url: "https://www.gov.uk/repaying-your-student-loan/what-you-pay",
};

const GOV_UK_INTEREST_ANNOUNCEMENT: RuleSource = {
  label: "GOV.UK — Student loans interest rates and repayment threshold announcement",
  url: "https://www.gov.uk/government/news/student-loans-interest-rates-and-repayment-threshold-announcement--7",
};

const GOV_UK_WRITE_OFF: RuleSource = {
  label: "GOV.UK — Student loans: a guide to terms and conditions",
  url: "https://www.gov.uk/government/publications/student-loans-a-guide-to-terms-and-conditions/student-loans-a-guide-to-terms-and-conditions-2026-to-2027",
};

export const STUDENT_LOAN_RULES: Record<LoanPlan, StudentLoanRuleSet> = {
  plan2: {
    plan: "plan2",
    label: "Plan 2",
    effectiveTaxYear: "2026/27",
    annualRepaymentThreshold: 29_385,
    repaymentRate: 0.09,
    writeOffYearsAfterFirstDue: 30,
    interest: {
      kind: "income_linked",
      baseRate: 0.041, // RPI
      topRate: 0.071, // RPI + 3%
      lowerIncomeThreshold: 29_385,
      upperIncomeThreshold: 52_885,
      cappedAt: 0.06, // Government cap announced for this period
      whileStudyingRate: 0.06, // RPI+3% (7.1%) while studying also falls under the same cap
    },
    interestEffectiveFrom: "2026-09-01",
    interestEffectiveTo: "2027-08-31",
    sources: [GOV_UK_REPAYMENT_THRESHOLDS, GOV_UK_INTEREST_ANNOUNCEMENT, GOV_UK_WRITE_OFF],
    lastVerified: "2026-08-14",
  },
  plan5: {
    plan: "plan5",
    label: "Plan 5",
    effectiveTaxYear: "2026/27",
    annualRepaymentThreshold: 25_000,
    repaymentRate: 0.09,
    writeOffYearsAfterFirstDue: 40,
    interest: {
      kind: "flat",
      rate: 0.041, // RPI, no additional margin
    },
    interestEffectiveFrom: "2026-09-01",
    interestEffectiveTo: "2027-08-31",
    sources: [GOV_UK_REPAYMENT_THRESHOLDS, GOV_UK_INTEREST_ANNOUNCEMENT, GOV_UK_WRITE_OFF],
    lastVerified: "2026-08-14",
  },
};

export function getStudentLoanRules(plan: LoanPlan): StudentLoanRuleSet {
  return STUDENT_LOAN_RULES[plan];
}

/**
 * Resolves the Plan 2 income-linked annual interest rate for a given
 * annual salary, ramping linearly between baseRate and topRate and
 * clamped to the current published cap. Pass `annualSalary: null` for the
 * while-studying rate.
 */
export function resolvePlan2AnnualInterestRate(model: Plan2InterestModel, annualSalary: number | null): number {
  if (annualSalary === null) return model.whileStudyingRate;

  let rate: number;
  if (annualSalary <= model.lowerIncomeThreshold) {
    rate = model.baseRate;
  } else if (annualSalary >= model.upperIncomeThreshold) {
    rate = model.topRate;
  } else {
    const span = model.upperIncomeThreshold - model.lowerIncomeThreshold;
    const progress = (annualSalary - model.lowerIncomeThreshold) / span;
    rate = model.baseRate + progress * (model.topRate - model.baseRate);
  }

  return model.cappedAt !== null ? Math.min(rate, model.cappedAt) : rate;
}

/** Resolves the annual interest rate for any supported plan/interest model. `annualSalary: null` means "while studying" for Plan 2, or is ignored for Plan 5's flat rate. */
export function resolveAnnualInterestRate(rules: StudentLoanRuleSet, annualSalary: number | null): number {
  return rules.interest.kind === "flat" ? rules.interest.rate : resolvePlan2AnnualInterestRate(rules.interest, annualSalary);
}
