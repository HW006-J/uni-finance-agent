// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BalanceHero } from "./BalanceHero";
import { calculateFinancialSummary } from "@/lib/finance/engine";
import { formatMoney, formatMoneyWhole } from "@/lib/finance/format";
import { makeExpense, makeIncome, makeProfile } from "@/lib/finance/test-helpers";

afterEach(() => {
  cleanup();
});

const asOf = new Date("2026-01-01T00:00:00.000Z");

describe("BalanceHero - missing balance/horizon never fabricates a runway", () => {
  it("shows honest fallbacks with no balance and no known income", () => {
    const profile = makeProfile({ currentBalance: 0, balanceKnown: false });
    const summary = calculateFinancialSummary(
      { profile, incomes: [], expenses: [], transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );
    render(<BalanceHero summary={summary} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("No upcoming payment on record yet")).toBeInTheDocument();
    expect(screen.getByText("Not provided")).toBeInTheDocument();
    expect(screen.getByText("Add your current balance to see your runway.")).toBeInTheDocument();
    expect(screen.queryByText(/on track/)).not.toBeInTheDocument();
    expect(screen.queryByText("Projected shortfall")).not.toBeInTheDocument();
    expect(screen.queryByText(/run out around/)).not.toBeInTheDocument();
  });
});

describe("BalanceHero - on-track runway", () => {
  const profile = makeProfile({ currentBalance: 5000, emergencyBuffer: 0, balanceKnown: true });
  const incomes = [makeIncome({ source: "Maintenance Loan", amount: 3200, date: "2026-05-26T00:00:00.000Z", frequency: "one_off" })];
  const expenses = [makeExpense({ name: "Rent", amount: 50, category: "rent", frequency: "weekly" })];
  const summary = calculateFinancialSummary(
    { profile, incomes, expenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
    asOf,
  );

  it("shows the correct days-until-next-payment headline", () => {
    render(<BalanceHero summary={summary} />);
    expect(screen.getByText(`${summary.nextIncome!.daysAway} days`)).toBeInTheDocument();
    expect(screen.getByText("until your next payment")).toBeInTheDocument();
  });

  it("presents the next payment amount, source and date", () => {
    render(<BalanceHero summary={summary} />);
    const nextPaymentLine = screen.getByText("Next payment:").closest("p")!;
    expect(nextPaymentLine).toHaveTextContent("£3,200");
    expect(nextPaymentLine).toHaveTextContent("Maintenance Loan");
  });

  it("shows the positive on-track state with a matching safe-weekly-spend figure", () => {
    render(<BalanceHero summary={summary} />);
    expect(screen.getByText("You’re on track")).toBeInTheDocument();
    expect(screen.getByText("Safe to spend this week")).toBeInTheDocument();
    expect(screen.getByText(formatMoney(summary.safeWeeklySpend!, "GBP"))).toBeInTheDocument();
    expect(screen.getByText("Projected buffer at next payment")).toBeInTheDocument();
    expect(screen.getByText(formatMoney(summary.discretionaryCash!, "GBP"))).toBeInTheDocument();
  });
});

describe("BalanceHero - projected shortfall", () => {
  const profile = makeProfile({ currentBalance: 300, emergencyBuffer: 0, balanceKnown: true });
  const incomes = [makeIncome({ source: "Maintenance Loan", amount: 3200, date: "2026-05-26T00:00:00.000Z", frequency: "one_off" })];
  const expenses = [makeExpense({ name: "Rent", amount: 100, category: "rent", frequency: "weekly" })];
  const summary = calculateFinancialSummary(
    { profile, incomes, expenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
    asOf,
  );

  it("has a real shortfall and run-out projection in this fixture", () => {
    expect(summary.shortfallAmount).not.toBeNull();
    expect(summary.suggestedWeeklyReduction).not.toBeNull();
    expect(summary.runOutEstimate).not.toBeNull();
  });

  it("shows the projected-shortfall figure and the weekly reduction, matching the engine's own numbers", () => {
    render(<BalanceHero summary={summary} />);
    expect(screen.getByText("Projected shortfall")).toBeInTheDocument();
    expect(screen.getByText(formatMoney(summary.shortfallAmount!, "GBP"))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatMoneyWhole(summary.suggestedWeeklyReduction!, "GBP") + "/week"))).toBeInTheDocument();
  });

  it("shows the run-out date and the day gap before the next payment", () => {
    render(<BalanceHero summary={summary} />);
    const gapDays = summary.nextIncome!.daysAway - summary.runOutEstimate!.days;
    expect(screen.getByText(new RegExp(`${gapDays}-day gap`))).toBeInTheDocument();
    expect(screen.getByText(/run out around/)).toBeInTheDocument();
  });

  it("does not show the on-track state at the same time", () => {
    render(<BalanceHero summary={summary} />);
    expect(screen.queryByText("You’re on track")).not.toBeInTheDocument();
  });
});
