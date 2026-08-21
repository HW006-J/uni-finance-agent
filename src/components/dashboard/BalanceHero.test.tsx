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

    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3); // your runway, needs to last, safe extra spend
    expect(screen.getByText(/Not provided/)).toBeInTheDocument();
    expect(screen.getByText("Add your current balance to see your runway.")).toBeInTheDocument();
    expect(screen.queryByText("On track")).not.toBeInTheDocument();
    expect(screen.queryByText(/days short/)).not.toBeInTheDocument();
  });

  it("shows the balance-known-but-no-horizon fallback without a red/green state", () => {
    const profile = makeProfile({ currentBalance: 500, balanceKnown: true });
    const summary = calculateFinancialSummary(
      { profile, incomes: [], expenses: [], transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );
    render(<BalanceHero summary={summary} />);

    expect(screen.getByText("Add your next payment date to see your full runway.")).toBeInTheDocument();
    expect(screen.queryByText("On track")).not.toBeInTheDocument();
    expect(screen.queryByText(/days short/)).not.toBeInTheDocument();
  });
});

describe("BalanceHero - canonical scenario (£3,400 / Maintenance Loan 8 Jan(140d) / £245/week spend)", () => {
  const maintenanceLoan = makeIncome({ source: "Maintenance Loan", amount: 3200, date: "2026-05-21T00:00:00.000Z", frequency: "one_off" });
  const canonicalExpenses = [
    makeExpense({ name: "Rent", amount: 650, category: "rent", frequency: "monthly" }),
    makeExpense({ name: "Food", amount: 55, category: "groceries", frequency: "weekly" }),
    makeExpense({ name: "Going out", amount: 40, category: "going_out", frequency: "weekly" }),
  ];
  const profile = makeProfile({ currentBalance: 3400, balanceKnown: true });

  describe("before any recurring income - off-track (red) state", () => {
    const summary = calculateFinancialSummary(
      { profile, incomes: [maintenanceLoan], expenses: canonicalExpenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
      asOf,
    );

    it("shows actual runway (98) against the 140-day target, and £0 safe extra spend", () => {
      render(<BalanceHero summary={summary} />);
      expect(summary.actualRunway).toEqual({
        days: 98,
        meetsTarget: false,
        runOutDate: new Date(Date.UTC(2026, 3, 9)).toISOString(),
        daysShort: 42,
      });
      expect(screen.getByText("98")).toBeInTheDocument();
      expect(screen.getByText("Your runway")).toBeInTheDocument();
      expect(screen.getByText("140")).toBeInTheDocument();
      expect(screen.getByText("Needs to last")).toBeInTheDocument();
      expect(screen.getByText(formatMoney(0, "GBP"))).toBeInTheDocument();
      expect(screen.getByText(/after your planned costs/)).toBeInTheDocument();
    });

    it("shows the red status: days-short badge, cut sentence, and subtle run-out date", () => {
      render(<BalanceHero summary={summary} />);
      expect(screen.getByText("42 days short")).toBeInTheDocument();
      const cutSentence = screen.getByText(/Cut about/).closest("p")!;
      expect(cutSentence).toHaveTextContent(`Cut about ${formatMoneyWhole(75, "GBP")}/week to make it to your next payment.`);
      expect(screen.getByText(/At this rate, your money could run out around 9 April/)).toBeInTheDocument();
      expect(screen.queryByText("On track")).not.toBeInTheDocument();
    });

    it("presents the next major payment line and demotes available balance", () => {
      render(<BalanceHero summary={summary} />);
      const line = screen.getByText("Next major payment:").closest("p")!;
      expect(line).toHaveTextContent("£3,200");
      expect(line).toHaveTextContent("Maintenance Loan");
      expect(screen.getByText(formatMoney(3400, "GBP"))).toBeInTheDocument();
      expect(screen.getByText("available now")).toBeInTheDocument();
    });
  });

  describe("after adding a £200/week job - back on track (green) state", () => {
    const job = makeIncome({ source: "Job", amount: 200, date: "2026-01-08T00:00:00.000Z", frequency: "weekly" });
    const summary = calculateFinancialSummary(
      {
        profile,
        incomes: [maintenanceLoan, job],
        expenses: canonicalExpenses,
        transactions: [],
        goals: [],
        fundingAwards: [],
        incomeReceipts: [],
      },
      asOf,
    );

    it("shows a 140+ runway (never a fabricated precise figure beyond the target window)", () => {
      render(<BalanceHero summary={summary} />);
      expect(summary.actualRunway).toEqual({ days: 140, meetsTarget: true, runOutDate: null, daysShort: null });
      expect(screen.getByText("140+")).toBeInTheDocument();
      expect(screen.getByText("140")).toBeInTheDocument(); // needs to last, unchanged by the job
    });

    it("shows the job as a separate recurring-income chip, not as the next major payment", () => {
      render(<BalanceHero summary={summary} />);
      expect(screen.getByText(/Job/)).toBeInTheDocument();
      expect(screen.getByText(/\+£200/)).toBeInTheDocument();
      const majorPaymentLine = screen.getByText("Next major payment:").closest("p")!;
      expect(majorPaymentLine).toHaveTextContent("Maintenance Loan");
      expect(majorPaymentLine).not.toHaveTextContent("Job");
    });

    it("moves to the on-track green state with a sensible (not fabricated) safe-spend figure", () => {
      render(<BalanceHero summary={summary} />);
      expect(screen.getByText("On track")).toBeInTheDocument();
      expect(screen.getByText(/Covered until your next maintenance loan payment/)).toBeInTheDocument();
      expect(screen.getByText(formatMoney(125, "GBP"))).toBeInTheDocument(); // safe extra spend this week
      expect(screen.queryByText(/days short/)).not.toBeInTheDocument();
      expect(screen.queryByText(/could run out around/)).not.toBeInTheDocument();
    });

    it("never implies anywhere near the whole balance is safe to spend in a week", () => {
      render(<BalanceHero summary={summary} />);
      expect(screen.queryByText(formatMoney(3155, "GBP"))).not.toBeInTheDocument();
      expect(summary.safeWeeklySpend!).toBeLessThan(profile.currentBalance * 0.5);
    });
  });

  describe("demo story: healthy -> unexpected purchase -> recurring job recovery", () => {
    it("transitions green -> red -> green as the transcript describes", () => {
      const healthyIncomes = [maintenanceLoan, makeIncome({ source: "Job", amount: 200, date: "2026-01-08T00:00:00.000Z", frequency: "weekly" })];
      const healthySummary = calculateFinancialSummary(
        { profile, incomes: healthyIncomes, expenses: canonicalExpenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
        asOf,
      );
      expect(healthySummary.actualRunway!.meetsTarget).toBe(true);

      // "I just spent £2,800 on a laptop and course equipment." -> logTransaction decrements currentBalance directly.
      // (Comfortably covered by the £200/week job alone up to £2,500 of spend - a bigger purchase is needed to actually flip the state red.)
      const afterPurchaseProfile = { ...profile, currentBalance: profile.currentBalance - 2800 };
      const purchaseSummary = calculateFinancialSummary(
        { profile: afterPurchaseProfile, incomes: healthyIncomes, expenses: canonicalExpenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
        asOf,
      );
      expect(purchaseSummary.actualRunway!.meetsTarget).toBe(false);
      render(<BalanceHero summary={purchaseSummary} />);
      expect(screen.getByText(/days short/)).toBeInTheDocument();
      cleanup();

      // "I've started a part-time job earning £50 a week." -> an additional recurring income on top of the existing one.
      const recoveredIncomes = [...healthyIncomes, makeIncome({ source: "Second job", amount: 50, date: "2026-01-08T00:00:00.000Z", frequency: "weekly" })];
      const recoverySummary = calculateFinancialSummary(
        { profile: afterPurchaseProfile, incomes: recoveredIncomes, expenses: canonicalExpenses, transactions: [], goals: [], fundingAwards: [], incomeReceipts: [] },
        asOf,
      );
      expect(recoverySummary.horizonDays).toBe(healthySummary.horizonDays); // the major horizon never moves
      expect(recoverySummary.actualRunway!.meetsTarget).toBe(true);
      render(<BalanceHero summary={recoverySummary} />);
      expect(screen.getByText("On track")).toBeInTheDocument();
    });
  });
});
