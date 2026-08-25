/**
 * The Custom Loan calculator's default, clearly-labelled example scenario.
 * Illustrative only - never written to Supabase, never mixed with the
 * student's actual Budget or Student Loan data, and only ever held in this
 * page's client-side React state. Mirrors `exampleScenario.ts`.
 */

export interface CustomLoanState {
  loanName: string;
  balance: string;
  aprPercent: string;
  monthlyRepayment: string;
}

/** Laptop finance: £1,500 balance, 24.9% APR, £100/month repayment. */
export const CUSTOM_LOAN_EXAMPLE: CustomLoanState = {
  loanName: "Laptop finance",
  balance: "1500",
  aprPercent: "24.9",
  monthlyRepayment: "100",
};

/** A blank starting point, for students who want to enter their own figures rather than start from the example. */
export const CUSTOM_LOAN_BLANK: CustomLoanState = {
  loanName: "Custom loan",
  balance: "",
  aprPercent: "",
  monthlyRepayment: "",
};

/** True while every field still matches the untouched example scenario. */
export function isCustomLoanExample(state: CustomLoanState): boolean {
  return (
    state.loanName === CUSTOM_LOAN_EXAMPLE.loanName &&
    state.balance === CUSTOM_LOAN_EXAMPLE.balance &&
    state.aprPercent === CUSTOM_LOAN_EXAMPLE.aprPercent &&
    state.monthlyRepayment === CUSTOM_LOAN_EXAMPLE.monthlyRepayment
  );
}
