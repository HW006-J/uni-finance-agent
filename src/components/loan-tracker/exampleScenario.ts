/**
 * The Loan Tracker's default, clearly-labelled example scenario. Shown on
 * initial load so the page is useful and demo-ready with zero typing - never
 * written to Supabase, never mixed with the student's actual Budget data,
 * and only ever held in this page's client-side React state.
 */

export interface LoanTrackerState {
  courseStartDate: string;
  courseEndDate: string;
  loanBalance: string;
  startingSalary: string;
  salaryGrowthPercent: string;
  extraMonthly: string;
}

/** English undergraduate course, Sept 2026 - June 2029, £45k balance, £32k starting salary, 3%/yr growth, no extra repayment. */
export const EXAMPLE_SCENARIO: LoanTrackerState = {
  courseStartDate: "2026-09-01",
  courseEndDate: "2029-06-30",
  loanBalance: "45000",
  startingSalary: "32000",
  salaryGrowthPercent: "3",
  extraMonthly: "0",
};

/** True while every field still matches the untouched example scenario. */
export function isExampleScenario(state: LoanTrackerState): boolean {
  return (
    state.courseStartDate === EXAMPLE_SCENARIO.courseStartDate &&
    state.courseEndDate === EXAMPLE_SCENARIO.courseEndDate &&
    state.loanBalance === EXAMPLE_SCENARIO.loanBalance &&
    state.startingSalary === EXAMPLE_SCENARIO.startingSalary &&
    state.salaryGrowthPercent === EXAMPLE_SCENARIO.salaryGrowthPercent &&
    state.extraMonthly === EXAMPLE_SCENARIO.extraMonthly
  );
}
