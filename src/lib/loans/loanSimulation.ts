/**
 * Deterministic, pure-TypeScript monthly student loan repayment
 * simulation. No AI/Gemini involvement anywhere in this file - every
 * number here is arithmetic against the rules in `studentLoanRules.ts`
 * and the caller's explicit assumptions.
 *
 * Simplifications, documented rather than hidden:
 *  - `startingBalance` is treated as the balance AT `firstRepaymentDueDate`
 *    (the April the borrower first becomes due to repay) - no separate
 *    while-studying interest accrual is modelled before that date.
 *  - Salary and the repayment threshold step up once a year, on the
 *    anniversary of `firstRepaymentDueDate`, rather than continuously.
 *  - Interest is applied as a simple annualRate/12 each month, not
 *    day-by-day compounding - a standard simplification for an
 *    illustrative multi-decade projection.
 *  - Real UK payroll deductions happen per pay period against actual
 *    payslips; this cannot and does not claim penny-perfect SLC forecasting.
 */
import { round2 } from "@/lib/finance/engine";
import {
  getStudentLoanRules,
  resolveAnnualInterestRate,
  type LoanPlan,
  type StudentLoanRuleSet,
} from "./studentLoanRules";

export interface LoanSimulationInput {
  plan: LoanPlan;
  startingBalance: number;
  /** ISO date - the April the borrower first becomes due to repay. */
  firstRepaymentDueDate: string;
  startingSalary: number;
  /** e.g. 0.03 for 3%/year. */
  salaryGrowthRate: number;
  /** Assumption for how the repayment threshold grows each year. 0 = frozen (the conservative/current default). */
  thresholdGrowthRate?: number;
  /** Extra voluntary repayment on top of the statutory deduction, per month. */
  voluntaryMonthlyRepayment?: number;
}

export interface LoanMonthPoint {
  monthIndex: number;
  date: string;
  annualSalary: number;
  annualThreshold: number;
  annualInterestRate: number;
  interestAccrued: number;
  statutoryRepayment: number;
  voluntaryRepayment: number;
  balance: number;
}

export interface LoanSimulationResult {
  plan: LoanPlan;
  rules: StudentLoanRuleSet;
  startingBalance: number;
  firstRepaymentDueDate: string;
  writeOffDate: string;
  months: LoanMonthPoint[];
  totalStatutoryRepaid: number;
  totalVoluntaryRepaid: number;
  totalInterestAdded: number;
  /** ISO date the balance reached zero, or null if it never did within the write-off term. */
  payoffDate: string | null;
  /** Remaining balance at the write-off date, or null if the loan was fully repaid before then. */
  balanceAtWriteOff: number | null;
  totalRepaid: number;
}

const MAX_MONTHS_GUARD = 40 * 12 + 1; // hard ceiling matching the longest supported write-off term (Plan 5, 40 years)

function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const daysInTargetMonth = new Date(Date.UTC(year, month + months + 1, 0)).getUTCDate();
  const result = new Date(date);
  result.setUTCFullYear(year, month + months, Math.min(day, daysInTargetMonth));
  return result;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setUTCFullYear(date.getUTCFullYear() + years);
  return result;
}

/**
 * Derives the first repayment-due date (a 6 April) from an expected course
 * end date, per the general "the April after you leave your course" rule.
 * An explicit `firstRepaymentDueDate` from the user is always preferred
 * over this derivation when available.
 */
export function deriveFirstRepaymentDueDate(courseEndDateIso: string): string {
  const courseEnd = new Date(courseEndDateIso);
  const year = courseEnd.getUTCFullYear();
  const aprilSixThisYear = new Date(Date.UTC(year, 3, 6));
  const firstDue = courseEnd <= aprilSixThisYear ? aprilSixThisYear : new Date(Date.UTC(year + 1, 3, 6));
  return firstDue.toISOString().slice(0, 10);
}

/** Runs the monthly simulation described in the module doc comment. Pure function - identical inputs always produce identical output. */
export function simulateLoan(input: LoanSimulationInput): LoanSimulationResult {
  const rules = getStudentLoanRules(input.plan);
  const thresholdGrowthRate = input.thresholdGrowthRate ?? 0;
  const voluntaryMonthlyRepayment = Math.max(0, input.voluntaryMonthlyRepayment ?? 0);
  const startDate = new Date(input.firstRepaymentDueDate);
  const writeOffDate = addYears(startDate, rules.writeOffYearsAfterFirstDue);
  const maxMonths = Math.min(rules.writeOffYearsAfterFirstDue * 12, MAX_MONTHS_GUARD);

  const months: LoanMonthPoint[] = [];
  let balance = Math.max(0, round2(input.startingBalance));
  let totalStatutoryRepaid = 0;
  let totalVoluntaryRepaid = 0;
  let totalInterestAdded = 0;
  let payoffDate: string | null = balance === 0 ? input.firstRepaymentDueDate : null;

  for (let m = 0; m < maxMonths && balance > 0; m += 1) {
    const yearsElapsed = Math.floor(m / 12);
    const monthDate = addMonthsClamped(startDate, m);

    const annualSalary = input.startingSalary * (1 + input.salaryGrowthRate) ** yearsElapsed;
    const annualThreshold = rules.annualRepaymentThreshold * (1 + thresholdGrowthRate) ** yearsElapsed;
    const annualInterestRate = resolveAnnualInterestRate(rules, annualSalary);

    const monthlySalary = annualSalary / 12;
    const monthlyThreshold = annualThreshold / 12;
    const statutoryRaw = Math.max(0, (monthlySalary - monthlyThreshold) * rules.repaymentRate);

    const interestAccrued = round2(balance * (annualInterestRate / 12));
    balance = round2(balance + interestAccrued);

    const statutoryRepayment = round2(Math.min(statutoryRaw, balance));
    balance = round2(balance - statutoryRepayment);

    const voluntaryRepayment = round2(Math.min(voluntaryMonthlyRepayment, balance));
    balance = round2(balance - voluntaryRepayment);

    totalStatutoryRepaid = round2(totalStatutoryRepaid + statutoryRepayment);
    totalVoluntaryRepaid = round2(totalVoluntaryRepaid + voluntaryRepayment);
    totalInterestAdded = round2(totalInterestAdded + interestAccrued);

    months.push({
      monthIndex: m,
      date: monthDate.toISOString().slice(0, 10),
      annualSalary: round2(annualSalary),
      annualThreshold: round2(annualThreshold),
      annualInterestRate,
      interestAccrued,
      statutoryRepayment,
      voluntaryRepayment,
      balance,
    });

    if (balance <= 0 && payoffDate === null) {
      payoffDate = monthDate.toISOString().slice(0, 10);
    }
  }

  const balanceAtWriteOff = payoffDate !== null ? null : balance;

  return {
    plan: input.plan,
    rules,
    startingBalance: round2(input.startingBalance),
    firstRepaymentDueDate: input.firstRepaymentDueDate,
    writeOffDate: writeOffDate.toISOString().slice(0, 10),
    months,
    totalStatutoryRepaid,
    totalVoluntaryRepaid,
    totalInterestAdded,
    payoffDate,
    balanceAtWriteOff,
    totalRepaid: round2(totalStatutoryRepaid + totalVoluntaryRepaid),
  };
}

// ---------------------------------------------------------------------------
// Extra-repayment comparison - a neutral, deterministic answer to "is the
// extra repayment actually doing anything?". Never frames overpaying as
// inherently good or bad - see the module doc comment.
// ---------------------------------------------------------------------------

export type LoanOutcome = "paid_off" | "written_off";

export interface LoanComparison {
  baselineOutcome: LoanOutcome;
  withExtraOutcome: LoanOutcome;
  /** Whole months the loan is cleared earlier under the extra repayment. Only set when both scenarios reach £0 (both "paid_off"). */
  monthsEarlier: number | null;
  /** withExtra.totalRepaid - baseline.totalRepaid - how much more (or less) the student personally pays in overall. */
  totalPersonallyRepaidDifference: number;
  /** withExtra.totalInterestAdded - baseline.totalInterestAdded. */
  totalInterestDifference: number;
  /** How much smaller the amount written off ends up being. Only set when both scenarios still end in write-off. */
  writtenOffReducedBy: number | null;
}

/**
 * Compares two simulations that share the same inputs except for the extra
 * (voluntary) monthly repayment. Pure arithmetic over already-computed
 * simulation results - no new financial modelling happens here.
 */
export function compareLoanSimulations(baseline: LoanSimulationResult, withExtra: LoanSimulationResult): LoanComparison {
  const baselineOutcome: LoanOutcome = baseline.payoffDate ? "paid_off" : "written_off";
  const withExtraOutcome: LoanOutcome = withExtra.payoffDate ? "paid_off" : "written_off";

  const monthsEarlier =
    baselineOutcome === "paid_off" && withExtraOutcome === "paid_off"
      ? baseline.months.length - withExtra.months.length
      : null;

  const writtenOffReducedBy =
    baselineOutcome === "written_off" && withExtraOutcome === "written_off"
      ? round2((baseline.balanceAtWriteOff ?? 0) - (withExtra.balanceAtWriteOff ?? 0))
      : null;

  return {
    baselineOutcome,
    withExtraOutcome,
    monthsEarlier,
    totalPersonallyRepaidDifference: round2(withExtra.totalRepaid - baseline.totalRepaid),
    totalInterestDifference: round2(withExtra.totalInterestAdded - baseline.totalInterestAdded),
    writtenOffReducedBy,
  };
}

/** Plain "N years M months" / "N months" duration string for a whole number of months. Returns "less than a month" for 0. */
export function formatMonthsDuration(totalMonths: number): string {
  const months = Math.max(0, Math.round(totalMonths));
  if (months === 0) return "less than a month";
  const years = Math.floor(months / 12);
  const remainderMonths = months % 12;
  const yearPart = years > 0 ? `${years} year${years === 1 ? "" : "s"}` : "";
  const monthPart = remainderMonths > 0 ? `${remainderMonths} month${remainderMonths === 1 ? "" : "s"}` : "";
  return [yearPart, monthPart].filter(Boolean).join(" ");
}
