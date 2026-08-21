import { describe, expect, it } from "vitest";
import { inferPlanFromCourseStart } from "@/lib/loans/studentLoanRules";
import { deriveFirstRepaymentDueDate, simulateLoan } from "@/lib/loans/loanSimulation";
import { EXAMPLE_SCENARIO, isExampleScenario, type LoanTrackerState } from "./exampleScenario";

describe("EXAMPLE_SCENARIO", () => {
  it("matches the specified default scenario exactly", () => {
    expect(EXAMPLE_SCENARIO).toEqual({
      courseStartDate: "2026-09-01",
      courseEndDate: "2029-06-30",
      loanBalance: "45000",
      startingSalary: "32000",
      salaryGrowthPercent: "3",
      extraMonthly: "0",
    });
  });

  it("infers Plan 5 for the example course start date", () => {
    expect(inferPlanFromCourseStart(EXAMPLE_SCENARIO.courseStartDate)).toBe("plan5");
  });

  it("produces a valid, non-empty simulation with no extra repayment", () => {
    const firstRepaymentDueDate = deriveFirstRepaymentDueDate(EXAMPLE_SCENARIO.courseEndDate);
    const result = simulateLoan({
      plan: "plan5",
      startingBalance: Number.parseFloat(EXAMPLE_SCENARIO.loanBalance),
      firstRepaymentDueDate,
      startingSalary: Number.parseFloat(EXAMPLE_SCENARIO.startingSalary),
      salaryGrowthRate: Number.parseFloat(EXAMPLE_SCENARIO.salaryGrowthPercent) / 100,
    });

    expect(result.months.length).toBeGreaterThan(0);
    expect(result.startingBalance).toBe(45_000);
    expect(result.months[0].statutoryRepayment).toBeGreaterThan(0);
  });
});

describe("isExampleScenario", () => {
  it("is true for the untouched example", () => {
    expect(isExampleScenario(EXAMPLE_SCENARIO)).toBe(true);
  });

  it("is false once any single field is changed", () => {
    const edited: LoanTrackerState = { ...EXAMPLE_SCENARIO, startingSalary: "50000" };
    expect(isExampleScenario(edited)).toBe(false);
  });

  it("is false when every field differs", () => {
    const custom: LoanTrackerState = {
      courseStartDate: "2020-09-01",
      courseEndDate: "2023-06-30",
      loanBalance: "10000",
      startingSalary: "40000",
      salaryGrowthPercent: "1",
      extraMonthly: "50",
    };
    expect(isExampleScenario(custom)).toBe(false);
  });
});
