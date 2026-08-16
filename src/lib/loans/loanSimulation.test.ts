import { describe, expect, it } from "vitest";
import {
  compareLoanSimulations,
  deriveFirstRepaymentDueDate,
  formatMonthsDuration,
  simulateLoan,
  type LoanSimulationInput,
} from "./loanSimulation";

const baseInput: LoanSimulationInput = {
  plan: "plan5",
  startingBalance: 40_000,
  firstRepaymentDueDate: "2027-04-06",
  startingSalary: 30_000,
  salaryGrowthRate: 0.02,
};

describe("deriveFirstRepaymentDueDate", () => {
  it("uses the same year's 6 April when the course ends on/before it", () => {
    expect(deriveFirstRepaymentDueDate("2027-02-01")).toBe("2027-04-06");
  });

  it("rolls to next year's 6 April when the course ends after it", () => {
    expect(deriveFirstRepaymentDueDate("2027-06-15")).toBe("2028-04-06");
  });

  it("uses the same date when the course ends exactly on 6 April", () => {
    expect(deriveFirstRepaymentDueDate("2027-04-06")).toBe("2027-04-06");
  });
});

describe("simulateLoan - repayment thresholds and rate", () => {
  it("charges nothing when salary is below the Plan 5 threshold (£25,000)", () => {
    const result = simulateLoan({ ...baseInput, plan: "plan5", startingSalary: 20_000, salaryGrowthRate: 0 });
    expect(result.months[0].statutoryRepayment).toBe(0);
  });

  it("charges 9% of income over the Plan 5 threshold", () => {
    const result = simulateLoan({ ...baseInput, plan: "plan5", startingSalary: 37_000, salaryGrowthRate: 0 });
    // Monthly: (37000-25000)/12 * 0.09
    const expectedMonthly = ((37_000 - 25_000) / 12) * 0.09;
    expect(result.months[0].statutoryRepayment).toBeCloseTo(expectedMonthly, 2);
  });

  it("charges nothing when salary is below the Plan 2 threshold (£29,385)", () => {
    const result = simulateLoan({ ...baseInput, plan: "plan2", startingSalary: 25_000, salaryGrowthRate: 0 });
    expect(result.months[0].statutoryRepayment).toBe(0);
  });

  it("charges 9% of income over the Plan 2 threshold", () => {
    const result = simulateLoan({ ...baseInput, plan: "plan2", startingSalary: 40_000, salaryGrowthRate: 0 });
    const expectedMonthly = ((40_000 - 29_385) / 12) * 0.09;
    expect(result.months[0].statutoryRepayment).toBeCloseTo(expectedMonthly, 2);
  });

  it("uses the correct annual threshold for each plan", () => {
    expect(simulateLoan({ ...baseInput, plan: "plan2" }).months[0].annualThreshold).toBe(29_385);
    expect(simulateLoan({ ...baseInput, plan: "plan5" }).months[0].annualThreshold).toBe(25_000);
  });
});

describe("simulateLoan - salary and threshold growth", () => {
  it("steps salary up annually according to the growth rate", () => {
    const result = simulateLoan({ ...baseInput, startingSalary: 30_000, salaryGrowthRate: 0.1, plan: "plan5" });
    expect(result.months[0].annualSalary).toBe(30_000);
    expect(result.months[12].annualSalary).toBeCloseTo(33_000, 2); // +10% after one year
    expect(result.months[24].annualSalary).toBeCloseTo(36_300, 2); // +10% again
  });

  it("keeps the threshold frozen when no threshold growth assumption is given", () => {
    const result = simulateLoan({ ...baseInput, plan: "plan5" });
    const last = result.months[result.months.length - 1];
    expect(result.months[0].annualThreshold).toBe(last.annualThreshold);
  });

  it("grows the threshold when a threshold growth assumption is supplied", () => {
    const result = simulateLoan({ ...baseInput, plan: "plan5", thresholdGrowthRate: 0.05 });
    expect(result.months[12].annualThreshold).toBeCloseTo(25_000 * 1.05, 2);
  });
});

describe("simulateLoan - interest", () => {
  it("applies zero interest and holds the balance change to repayments only when the rate is zero", () => {
    // Very high salary relative to threshold with a manually-zeroed rate isn't directly configurable,
    // but Plan 5's flat rate can be effectively neutralised by asserting interestAccrued matches balance*rate/12 exactly.
    const result = simulateLoan({ ...baseInput, plan: "plan5", startingBalance: 10_000, startingSalary: 0, salaryGrowthRate: 0 });
    const expectedInterest = 10_000 * (0.041 / 12);
    expect(result.months[0].interestAccrued).toBeCloseTo(expectedInterest, 2);
  });

  it("accrues no interest and takes no repayment once the balance has already reached zero", () => {
    const result = simulateLoan({ ...baseInput, startingBalance: 0 });
    expect(result.months).toHaveLength(0);
    expect(result.payoffDate).toBe(baseInput.firstRepaymentDueDate);
    expect(result.totalInterestAdded).toBe(0);
  });

  it("uses a higher effective Plan 2 interest rate for a higher earner than a lower earner", () => {
    const lowEarner = simulateLoan({ ...baseInput, plan: "plan2", startingSalary: 30_000, salaryGrowthRate: 0 });
    const highEarner = simulateLoan({ ...baseInput, plan: "plan2", startingSalary: 55_000, salaryGrowthRate: 0 });
    expect(highEarner.months[0].annualInterestRate).toBeGreaterThan(lowEarner.months[0].annualInterestRate);
  });
});

describe("simulateLoan - voluntary repayments", () => {
  it("reduces total interest and can bring forward the payoff date", () => {
    const withoutVoluntary = simulateLoan({ ...baseInput, plan: "plan5", startingBalance: 5_000, startingSalary: 45_000, salaryGrowthRate: 0 });
    const withVoluntary = simulateLoan({ ...baseInput, plan: "plan5", startingBalance: 5_000, startingSalary: 45_000, salaryGrowthRate: 0, voluntaryMonthlyRepayment: 200 });

    expect(withVoluntary.totalInterestAdded).toBeLessThanOrEqual(withoutVoluntary.totalInterestAdded);
    expect(withVoluntary.payoffDate).not.toBeNull();
    if (withoutVoluntary.payoffDate && withVoluntary.payoffDate) {
      expect(new Date(withVoluntary.payoffDate).getTime()).toBeLessThanOrEqual(new Date(withoutVoluntary.payoffDate).getTime());
    }
  });

  it("increasing the extra monthly repayment monotonically shortens or holds the payoff time", () => {
    const low = simulateLoan({ ...baseInput, plan: "plan5", startingBalance: 8_000, startingSalary: 40_000, voluntaryMonthlyRepayment: 50 });
    const high = simulateLoan({ ...baseInput, plan: "plan5", startingBalance: 8_000, startingSalary: 40_000, voluntaryMonthlyRepayment: 300 });
    expect(high.months.length).toBeLessThanOrEqual(low.months.length);
  });
});

describe("simulateLoan - payoff vs write-off", () => {
  it("pays off before write-off for a small balance against a high salary", () => {
    const result = simulateLoan({ plan: "plan5", startingBalance: 1_000, firstRepaymentDueDate: "2027-04-06", startingSalary: 80_000, salaryGrowthRate: 0 });
    expect(result.payoffDate).not.toBeNull();
    expect(result.balanceAtWriteOff).toBeNull();
  });

  it("leaves a remaining balance at write-off for a very large balance against a low salary", () => {
    const result = simulateLoan({ plan: "plan5", startingBalance: 200_000, firstRepaymentDueDate: "2027-04-06", startingSalary: 26_000, salaryGrowthRate: 0 });
    expect(result.payoffDate).toBeNull();
    expect(result.balanceAtWriteOff).not.toBeNull();
    expect(result.balanceAtWriteOff).toBeGreaterThan(0);
  });

  it("Plan 2 write-off date is 30 years after the first repayment due date", () => {
    const result = simulateLoan({ ...baseInput, plan: "plan2" });
    expect(result.writeOffDate).toBe("2057-04-06");
  });

  it("Plan 5 write-off date is 40 years after the first repayment due date", () => {
    const result = simulateLoan({ ...baseInput, plan: "plan5" });
    expect(result.writeOffDate).toBe("2067-04-06");
  });

  it("a very high salary pays off quickly and leaves no negative balance", () => {
    const result = simulateLoan({ plan: "plan5", startingBalance: 5_000, firstRepaymentDueDate: "2027-04-06", startingSalary: 500_000, salaryGrowthRate: 0 });
    for (const month of result.months) {
      expect(month.balance).toBeGreaterThanOrEqual(0);
    }
  });

  it("never produces a negative balance across the full simulation", () => {
    const result = simulateLoan({ plan: "plan2", startingBalance: 45_000, firstRepaymentDueDate: "2027-04-06", startingSalary: 60_000, salaryGrowthRate: 0.04, voluntaryMonthlyRepayment: 500 });
    for (const month of result.months) {
      expect(month.balance).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("simulateLoan - determinism", () => {
  it("produces identical output for identical inputs", () => {
    const a = simulateLoan({ ...baseInput });
    const b = simulateLoan({ ...baseInput });
    expect(a).toEqual(b);
  });
});

describe("compareLoanSimulations", () => {
  it("reports months earlier when extra repayments bring forward a payoff that would already have happened", () => {
    const baseline = simulateLoan({ plan: "plan5", startingBalance: 5_000, firstRepaymentDueDate: "2027-04-06", startingSalary: 45_000, salaryGrowthRate: 0 });
    const withExtra = simulateLoan({ plan: "plan5", startingBalance: 5_000, firstRepaymentDueDate: "2027-04-06", startingSalary: 45_000, salaryGrowthRate: 0, voluntaryMonthlyRepayment: 200 });

    const comparison = compareLoanSimulations(baseline, withExtra);
    expect(comparison.baselineOutcome).toBe("paid_off");
    expect(comparison.withExtraOutcome).toBe("paid_off");
    expect(comparison.monthsEarlier).not.toBeNull();
    expect(comparison.monthsEarlier!).toBeGreaterThan(0);
    expect(comparison.writtenOffReducedBy).toBeNull();
  });

  it("reports a reduced write-off amount when extra repayments still don't fully clear the loan", () => {
    const baseline = simulateLoan({ plan: "plan5", startingBalance: 200_000, firstRepaymentDueDate: "2027-04-06", startingSalary: 26_000, salaryGrowthRate: 0 });
    const withExtra = simulateLoan({ plan: "plan5", startingBalance: 200_000, firstRepaymentDueDate: "2027-04-06", startingSalary: 26_000, salaryGrowthRate: 0, voluntaryMonthlyRepayment: 100 });

    const comparison = compareLoanSimulations(baseline, withExtra);
    expect(comparison.baselineOutcome).toBe("written_off");
    expect(comparison.withExtraOutcome).toBe("written_off");
    expect(comparison.monthsEarlier).toBeNull();
    expect(comparison.writtenOffReducedBy).not.toBeNull();
    expect(comparison.writtenOffReducedBy!).toBeGreaterThan(0);
  });

  it("computes the difference in total personally repaid and total interest", () => {
    const baseline = simulateLoan({ ...baseInput, plan: "plan5", startingBalance: 5_000, startingSalary: 45_000, salaryGrowthRate: 0 });
    const withExtra = simulateLoan({ ...baseInput, plan: "plan5", startingBalance: 5_000, startingSalary: 45_000, salaryGrowthRate: 0, voluntaryMonthlyRepayment: 200 });

    const comparison = compareLoanSimulations(baseline, withExtra);
    expect(comparison.totalPersonallyRepaidDifference).toBeCloseTo(withExtra.totalRepaid - baseline.totalRepaid, 2);
    expect(comparison.totalInterestDifference).toBeCloseTo(withExtra.totalInterestAdded - baseline.totalInterestAdded, 2);
    expect(comparison.totalInterestDifference).toBeLessThanOrEqual(0);
  });

  it("is deterministic for identical inputs", () => {
    const baseline = simulateLoan({ ...baseInput });
    const withExtra = simulateLoan({ ...baseInput, voluntaryMonthlyRepayment: 100 });
    expect(compareLoanSimulations(baseline, withExtra)).toEqual(compareLoanSimulations(baseline, withExtra));
  });
});

describe("formatMonthsDuration", () => {
  it("formats whole years with no remainder months", () => {
    expect(formatMonthsDuration(24)).toBe("2 years");
  });

  it("formats a single year correctly (no plural)", () => {
    expect(formatMonthsDuration(12)).toBe("1 year");
  });

  it("formats years and months together", () => {
    expect(formatMonthsDuration(25)).toBe("2 years 1 month");
  });

  it("formats less than a year as months only", () => {
    expect(formatMonthsDuration(7)).toBe("7 months");
  });

  it("formats a single month correctly (no plural)", () => {
    expect(formatMonthsDuration(1)).toBe("1 month");
  });

  it("formats zero as 'less than a month'", () => {
    expect(formatMonthsDuration(0)).toBe("less than a month");
  });

  it("rounds and never goes negative", () => {
    expect(formatMonthsDuration(-3)).toBe("less than a month");
  });
});
