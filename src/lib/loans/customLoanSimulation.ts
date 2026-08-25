/**
 * Deterministic, pure-TypeScript monthly amortisation simulation for a
 * "custom loan" - a generic stand-in for any non-Student-Finance borrowing
 * a student might have (BNPL, overdraft, personal loan, credit card, etc).
 * No AI/Gemini involvement anywhere in this file.
 *
 * Each month:
 *   monthlyInterestRate = APR / 100 / 12
 *   interest = currentBalance * monthlyInterestRate
 *   newBalance = currentBalance + interest - monthlyRepayment
 * (with the final repayment clamped so the balance never goes negative).
 *
 * Unlike the Student Loan simulation, this is a plain interest-bearing
 * amortisation: repayments are contractual, not income-linked, and there is
 * no write-off - the loan simply keeps accruing interest indefinitely if the
 * repayment never exceeds the interest being added.
 */
import { round2 } from "@/lib/finance/engine";

export interface CustomLoanSimulationInput {
  startingBalance: number;
  /** e.g. 24.9 for 24.9% APR. */
  annualPercentageRate: number;
  monthlyRepayment: number;
}

export interface CustomLoanMonthPoint {
  monthIndex: number;
  interestAccrued: number;
  repayment: number;
  balance: number;
}

export interface CustomLoanSimulationResult {
  startingBalance: number;
  annualPercentageRate: number;
  monthlyRepayment: number;
  months: CustomLoanMonthPoint[];
  totalInterestPaid: number;
  totalRepaid: number;
  /** Interest that would accrue on the starting balance in the first month - used to explain the "balance never falls" warning. */
  firstMonthInterest: number;
  /** Whole months until the balance reached £0, or null if it never did within the simulation horizon. */
  payoffMonths: number | null;
  /**
   * True when the fixed monthly repayment is at or below the interest
   * accruing on the starting balance, so the balance will never fall - see
   * the module doc comment. When true, `months`/payoff figures are not
   * computed (there is nothing meaningful to simulate).
   */
  balanceNeverFalls: boolean;
  /** True when the balance was still above £0 after the max simulation horizon. */
  reachedMaxHorizon: boolean;
}

/** 600 months / 50 years - a safe ceiling for an illustrative consumer-credit projection. */
export const CUSTOM_LOAN_MAX_MONTHS = 600;

/** Plain "N years M months" / "N months" duration string for a whole number of months. Returns "less than a month" for 0. */
export function formatCustomLoanDuration(totalMonths: number): string {
  const months = Math.max(0, Math.round(totalMonths));
  if (months === 0) return "less than a month";
  const years = Math.floor(months / 12);
  const remainderMonths = months % 12;
  const yearPart = years > 0 ? `${years} year${years === 1 ? "" : "s"}` : "";
  const monthPart = remainderMonths > 0 ? `${remainderMonths} month${remainderMonths === 1 ? "" : "s"}` : "";
  return [yearPart, monthPart].filter(Boolean).join(" ");
}

/**
 * Runs the monthly amortisation simulation described in the module doc
 * comment. Pure function - identical inputs always produce identical output.
 */
export function simulateCustomLoan(input: CustomLoanSimulationInput): CustomLoanSimulationResult {
  const startingBalance = Math.max(0, round2(input.startingBalance));
  const annualPercentageRate = Math.max(0, input.annualPercentageRate);
  const monthlyRepayment = Math.max(0, round2(input.monthlyRepayment));
  const monthlyInterestRate = annualPercentageRate / 100 / 12;

  // Interest is proportional to the balance, so if the fixed repayment
  // doesn't exceed the interest on the STARTING balance, it can never
  // exceed the interest on any later (equal-or-smaller) balance either -
  // the balance would only ever hold flat or grow. Checking once up front
  // is therefore sufficient and avoids ever showing a fake payoff date.
  const firstMonthInterest = round2(startingBalance * monthlyInterestRate);
  const balanceNeverFalls = startingBalance > 0 && monthlyRepayment <= firstMonthInterest;

  const months: CustomLoanMonthPoint[] = [];
  let balance = startingBalance;
  let totalInterestPaid = 0;
  let totalRepaid = 0;
  let payoffMonths: number | null = balance === 0 ? 0 : null;
  let reachedMaxHorizon = false;

  if (!balanceNeverFalls) {
    for (let m = 0; m < CUSTOM_LOAN_MAX_MONTHS && balance > 0; m += 1) {
      const interestAccrued = round2(balance * monthlyInterestRate);
      const balanceWithInterest = round2(balance + interestAccrued);
      const repayment = round2(Math.min(monthlyRepayment, balanceWithInterest));
      balance = round2(balanceWithInterest - repayment);

      totalInterestPaid = round2(totalInterestPaid + interestAccrued);
      totalRepaid = round2(totalRepaid + repayment);

      months.push({ monthIndex: m, interestAccrued, repayment, balance });

      if (balance <= 0 && payoffMonths === null) {
        payoffMonths = m + 1;
      }
    }

    if (balance > 0) {
      reachedMaxHorizon = true;
    }
  }

  return {
    startingBalance,
    annualPercentageRate,
    monthlyRepayment,
    months,
    totalInterestPaid,
    totalRepaid,
    firstMonthInterest,
    payoffMonths,
    balanceNeverFalls,
    reachedMaxHorizon,
  };
}
