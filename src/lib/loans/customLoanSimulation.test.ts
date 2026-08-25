import { describe, expect, it } from "vitest";
import { CUSTOM_LOAN_MAX_MONTHS, formatCustomLoanDuration, simulateCustomLoan } from "./customLoanSimulation";

describe("simulateCustomLoan - 0% APR", () => {
  it("reduces the balance by exactly the repayment each month, with no interest", () => {
    const result = simulateCustomLoan({ startingBalance: 1_200, annualPercentageRate: 0, monthlyRepayment: 100 });
    expect(result.totalInterestPaid).toBe(0);
    expect(result.payoffMonths).toBe(12);
    expect(result.totalRepaid).toBe(1_200);
    for (const month of result.months) {
      expect(month.interestAccrued).toBe(0);
    }
  });
});

describe("simulateCustomLoan - standard positive APR", () => {
  it("accrues interest proportional to the balance each month", () => {
    const result = simulateCustomLoan({ startingBalance: 2_000, annualPercentageRate: 10, monthlyRepayment: 150 });
    const expectedFirstInterest = 2_000 * (10 / 100 / 12);
    expect(result.months[0].interestAccrued).toBeCloseTo(expectedFirstInterest, 2);
    expect(result.totalInterestPaid).toBeGreaterThan(0);
  });
});

describe("simulateCustomLoan - normal payoff", () => {
  it("pays the loan off to exactly £0 when the repayment comfortably exceeds interest", () => {
    const result = simulateCustomLoan({ startingBalance: 1_500, annualPercentageRate: 24.9, monthlyRepayment: 100 });
    expect(result.balanceNeverFalls).toBe(false);
    expect(result.payoffMonths).toBe(19);
    expect(result.months[result.months.length - 1].balance).toBe(0);
    expect(result.totalInterestPaid).toBeCloseTo(315.75, 2);
    expect(result.totalRepaid).toBeCloseTo(1_815.75, 2);
  });
});

describe("simulateCustomLoan - final payment clamping", () => {
  it("never lets the balance go negative, clamping the final month's repayment", () => {
    const result = simulateCustomLoan({ startingBalance: 1_500, annualPercentageRate: 24.9, monthlyRepayment: 100 });
    for (const month of result.months) {
      expect(month.balance).toBeGreaterThanOrEqual(0);
    }
    const last = result.months[result.months.length - 1];
    expect(last.repayment).toBeLessThan(100);
  });
});

describe("simulateCustomLoan - repayment amount effects", () => {
  it("a higher monthly repayment reduces the payoff time", () => {
    const low = simulateCustomLoan({ startingBalance: 2_000, annualPercentageRate: 20, monthlyRepayment: 100 });
    const high = simulateCustomLoan({ startingBalance: 2_000, annualPercentageRate: 20, monthlyRepayment: 300 });
    expect(high.payoffMonths).not.toBeNull();
    expect(low.payoffMonths).not.toBeNull();
    expect(high.payoffMonths!).toBeLessThan(low.payoffMonths!);
  });

  it("a higher monthly repayment reduces total interest paid", () => {
    const low = simulateCustomLoan({ startingBalance: 2_000, annualPercentageRate: 20, monthlyRepayment: 100 });
    const high = simulateCustomLoan({ startingBalance: 2_000, annualPercentageRate: 20, monthlyRepayment: 300 });
    expect(high.totalInterestPaid).toBeLessThan(low.totalInterestPaid);
  });
});

describe("simulateCustomLoan - APR effects", () => {
  it("a higher APR increases total interest paid for the same repayment", () => {
    const low = simulateCustomLoan({ startingBalance: 2_000, annualPercentageRate: 10, monthlyRepayment: 150 });
    const high = simulateCustomLoan({ startingBalance: 2_000, annualPercentageRate: 30, monthlyRepayment: 150 });
    expect(high.totalInterestPaid).toBeGreaterThan(low.totalInterestPaid);
  });
});

describe("simulateCustomLoan - the 'balance never falls' edge case", () => {
  it("flags balanceNeverFalls and produces no fake payoff when repayment equals the interest accruing", () => {
    // £5,000 at 24% APR accrues exactly £100/month interest.
    const result = simulateCustomLoan({ startingBalance: 5_000, annualPercentageRate: 24, monthlyRepayment: 100 });
    expect(result.balanceNeverFalls).toBe(true);
    expect(result.payoffMonths).toBeNull();
    expect(result.months).toHaveLength(0);
    expect(result.totalInterestPaid).toBe(0);
  });

  it("flags balanceNeverFalls when repayment is below the interest accruing", () => {
    const result = simulateCustomLoan({ startingBalance: 5_000, annualPercentageRate: 24, monthlyRepayment: 50 });
    expect(result.balanceNeverFalls).toBe(true);
    expect(result.payoffMonths).toBeNull();
  });

  it("does not flag balanceNeverFalls once repayment exceeds the interest accruing", () => {
    const result = simulateCustomLoan({ startingBalance: 5_000, annualPercentageRate: 24, monthlyRepayment: 101 });
    expect(result.balanceNeverFalls).toBe(false);
  });

  it("exposes firstMonthInterest for the warning message", () => {
    const result = simulateCustomLoan({ startingBalance: 5_000, annualPercentageRate: 24, monthlyRepayment: 50 });
    expect(result.firstMonthInterest).toBe(100);
  });
});

describe("simulateCustomLoan - zero-value edges", () => {
  it("returns an already-paid-off result for a £0 starting balance, with no warning", () => {
    const result = simulateCustomLoan({ startingBalance: 0, annualPercentageRate: 24.9, monthlyRepayment: 100 });
    expect(result.payoffMonths).toBe(0);
    expect(result.balanceNeverFalls).toBe(false);
    expect(result.months).toHaveLength(0);
    expect(result.totalInterestPaid).toBe(0);
    expect(result.totalRepaid).toBe(0);
  });

  it("flags balanceNeverFalls for a £0 monthly repayment against a positive balance", () => {
    const result = simulateCustomLoan({ startingBalance: 1_000, annualPercentageRate: 10, monthlyRepayment: 0 });
    expect(result.balanceNeverFalls).toBe(true);
    expect(result.payoffMonths).toBeNull();
  });

  it("flags balanceNeverFalls for £0 repayment even at 0% APR (balance genuinely never falls)", () => {
    const result = simulateCustomLoan({ startingBalance: 1_000, annualPercentageRate: 0, monthlyRepayment: 0 });
    expect(result.balanceNeverFalls).toBe(true);
  });
});

describe("simulateCustomLoan - very high APR", () => {
  it("still pays off correctly when the repayment is well above the (large) interest amount", () => {
    const result = simulateCustomLoan({ startingBalance: 1_000, annualPercentageRate: 100, monthlyRepayment: 200 });
    expect(result.balanceNeverFalls).toBe(false);
    expect(result.payoffMonths).not.toBeNull();
    expect(result.months[result.months.length - 1].balance).toBe(0);
  });

  it("supports the full 0-100% APR range without special-casing", () => {
    const result = simulateCustomLoan({ startingBalance: 500, annualPercentageRate: 100, monthlyRepayment: 500 });
    expect(Number.isFinite(result.totalInterestPaid)).toBe(true);
    expect(result.months[0].balance).toBeGreaterThanOrEqual(0);
  });
});

describe("simulateCustomLoan - very large manual balance", () => {
  it("handles a balance far above the slider's suggested £20,000 max", () => {
    const result = simulateCustomLoan({ startingBalance: 500_000, annualPercentageRate: 15, monthlyRepayment: 5_000 });
    expect(result.balanceNeverFalls).toBe(true); // £5,000 interest/month vs £5,000 repayment - flat, not falling
    const paying = simulateCustomLoan({ startingBalance: 500_000, annualPercentageRate: 15, monthlyRepayment: 7_000 });
    expect(paying.balanceNeverFalls).toBe(false);
    expect(paying.totalInterestPaid).toBeGreaterThan(0);
  });
});

describe("simulateCustomLoan - maximum simulation horizon", () => {
  it("stops at the 600-month ceiling and reports reachedMaxHorizon when the loan would otherwise run forever", () => {
    const result = simulateCustomLoan({ startingBalance: 100_000, annualPercentageRate: 5, monthlyRepayment: 420 });
    expect(result.balanceNeverFalls).toBe(false);
    expect(result.months).toHaveLength(CUSTOM_LOAN_MAX_MONTHS);
    expect(result.payoffMonths).toBeNull();
    expect(result.reachedMaxHorizon).toBe(true);
    expect(result.months[result.months.length - 1].balance).toBeGreaterThan(0);
  });

  it("does not set reachedMaxHorizon for a loan that pays off comfortably inside the horizon", () => {
    const result = simulateCustomLoan({ startingBalance: 1_500, annualPercentageRate: 24.9, monthlyRepayment: 100 });
    expect(result.reachedMaxHorizon).toBe(false);
  });
});

describe("simulateCustomLoan - determinism", () => {
  it("produces identical output for identical inputs", () => {
    const input = { startingBalance: 3_000, annualPercentageRate: 18.5, monthlyRepayment: 120 };
    expect(simulateCustomLoan(input)).toEqual(simulateCustomLoan(input));
  });
});

describe("formatCustomLoanDuration", () => {
  it("formats a mix of years and months", () => {
    expect(formatCustomLoanDuration(19)).toBe("1 year 7 months");
  });

  it("formats whole years with no remainder", () => {
    expect(formatCustomLoanDuration(24)).toBe("2 years");
  });

  it("formats less than a year as months only", () => {
    expect(formatCustomLoanDuration(7)).toBe("7 months");
  });

  it("formats zero as 'less than a month'", () => {
    expect(formatCustomLoanDuration(0)).toBe("less than a month");
  });
});
