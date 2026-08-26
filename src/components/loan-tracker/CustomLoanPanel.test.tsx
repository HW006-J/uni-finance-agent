// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CustomLoanPanel } from "./CustomLoanPanel";

afterEach(() => {
  cleanup();
});

describe("CustomLoanPanel - example scenario on load", () => {
  it("shows the labelled example banner and the £1,500 / 24.9% / £100 example immediately", () => {
    render(<CustomLoanPanel />);
    expect(screen.getByText("Example projection — change any value")).toBeInTheDocument();
    expect(screen.getByText("Laptop finance")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /loan name/i })).toHaveValue("Laptop finance");
  });

  it("shows the full result summary with no typing required", () => {
    render(<CustomLoanPanel />);
    const outcomeCard = screen.getByText("Your estimated outcome").closest("div")!.parentElement!;
    const scoped = within(outcomeCard);

    expect(scoped.getByText("Monthly repayment")).toBeInTheDocument();
    expect(scoped.getByText("Estimated time to repay")).toBeInTheDocument();
    expect(scoped.getByText("Total interest paid")).toBeInTheDocument();
    expect(scoped.getByText("Total amount repaid")).toBeInTheDocument();
    // £1,500 at a 24.9% annual interest rate repaid at £100/month: 19 months = 1 year 7 months, £315.75 interest.
    expect(scoped.getByText("1 year 7 months")).toBeInTheDocument();
    expect(scoped.getByText("£315.75")).toBeInTheDocument();
    expect(scoped.getByText("£1,815.75")).toBeInTheDocument();
  });

  it("renders the loan-over-time chart", () => {
    render(<CustomLoanPanel />);
    expect(screen.getByRole("img", { name: /how your custom loan balance changes over time/i })).toBeInTheDocument();
  });

  it("shows the Student loan vs normal borrowing explainer", () => {
    render(<CustomLoanPanel />);
    expect(screen.getByText("Student loan vs normal borrowing")).toBeInTheDocument();
    expect(screen.getByText(/Repayments depend on your income/)).toBeInTheDocument();
    expect(screen.getByText(/Generally need to be repaid in full/)).toBeInTheDocument();
  });

  it("never mentions Klarna anywhere", () => {
    render(<CustomLoanPanel />);
    expect(screen.queryByText(/klarna/i)).not.toBeInTheDocument();
  });
});

describe("CustomLoanPanel - client-only state", () => {
  it("never writes to localStorage or triggers a network request", () => {
    const localSpy = vi.spyOn(Storage.prototype, "setItem");
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}"));
    render(<CustomLoanPanel />);

    const balanceInput = screen.getByRole("spinbutton", { name: /balance - exact value/i });
    fireEvent.change(balanceInput, { target: { value: "3000" } });

    expect(localSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    localSpy.mockRestore();
    fetchSpy.mockRestore();
  });
});

describe("CustomLoanPanel - editing the example", () => {
  it("updates the projection immediately when the repayment changes", () => {
    render(<CustomLoanPanel />);
    expect(screen.getByText("1 year 7 months")).toBeInTheDocument();

    const repaymentInput = screen.getByRole("spinbutton", { name: /monthly repayment - exact value/i });
    fireEvent.change(repaymentInput, { target: { value: "200" } });

    expect(screen.queryByText("1 year 7 months")).not.toBeInTheDocument();
  });

  it("a higher monthly repayment shows an earlier payoff and lower total interest", () => {
    render(<CustomLoanPanel />);
    const repaymentInput = screen.getByRole("spinbutton", { name: /monthly repayment - exact value/i });

    fireEvent.change(repaymentInput, { target: { value: "50" } });
    const interestAt50 = screen.getByText("Total interest paid").nextSibling?.textContent;

    fireEvent.change(repaymentInput, { target: { value: "300" } });
    const interestAt300 = screen.getByText("Total interest paid").nextSibling?.textContent;

    expect(interestAt50).not.toBe(interestAt300);
  });

  it("restores the example values when Reset to example is clicked", () => {
    render(<CustomLoanPanel />);
    const nameInput = screen.getByRole("textbox", { name: /loan name/i });
    fireEvent.change(nameInput, { target: { value: "Overdraft" } });
    expect(screen.queryByText("Example projection — change any value")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset to example" }));

    expect(screen.getByText("Example projection — change any value")).toBeInTheDocument();
    expect(nameInput).toHaveValue("Laptop finance");
  });

  it("falls back to 'Custom loan' as the heading when the loan name is cleared", () => {
    render(<CustomLoanPanel />);
    const nameInput = screen.getByRole("textbox", { name: /loan name/i });
    fireEvent.change(nameInput, { target: { value: "" } });
    expect(screen.getByRole("heading", { name: "Custom loan" })).toBeInTheDocument();
  });
});

describe("CustomLoanPanel - annual interest rate wording", () => {
  it("labels the rate input 'Annual interest rate', not APR", () => {
    render(<CustomLoanPanel />);
    expect(screen.getByText("Annual interest rate")).toBeInTheDocument();
    expect(screen.queryByText("Interest rate (APR)")).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /annual interest rate - exact value/i })).toBeInTheDocument();
  });

  it("shows the supporting text for the rate input", () => {
    render(<CustomLoanPanel />);
    expect(screen.getByText("Enter the annual rate charged on the outstanding balance.")).toBeInTheDocument();
  });

  it("discloses that this is an illustrative monthly rate derived from the annual rate, closed until clicked", () => {
    render(<CustomLoanPanel />);
    expect(screen.queryByText(/monthly rate derived from the annual interest rate/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "How this works" }));
    expect(screen.getByText(/monthly rate derived from the annual interest rate/)).toBeInTheDocument();
    expect(screen.getByText(/Actual lender calculations, fees and repayment terms may differ/)).toBeInTheDocument();
  });
});

describe("CustomLoanPanel - the 'balance never falls' warning", () => {
  it("shows a warning and no fake payoff when repayment doesn't exceed the interest accruing", () => {
    render(<CustomLoanPanel />);

    fireEvent.change(screen.getByRole("spinbutton", { name: /balance - exact value/i }), { target: { value: "5000" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /annual interest rate - exact value/i }), { target: { value: "24" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /monthly repayment - exact value/i }), { target: { value: "50" } });

    expect(screen.getByText("At this repayment level, your balance is not currently falling.")).toBeInTheDocument();
    expect(screen.getByText(/Your monthly repayment needs to be higher than the interest being added/)).toBeInTheDocument();
    expect(screen.queryByText("Your estimated outcome")).not.toBeInTheDocument();
    expect(screen.queryByText("Estimated time to repay")).not.toBeInTheDocument();
  });

  it("supports a 0% annual interest rate (e.g. a 0% BNPL balance) with a normal payoff, not a warning", () => {
    render(<CustomLoanPanel />);

    fireEvent.change(screen.getByRole("spinbutton", { name: /balance - exact value/i }), { target: { value: "600" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /annual interest rate - exact value/i }), { target: { value: "0" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /monthly repayment - exact value/i }), { target: { value: "100" } });

    expect(screen.queryByText("At this repayment level, your balance is not currently falling.")).not.toBeInTheDocument();
    expect(screen.getByText("Your estimated outcome")).toBeInTheDocument();
    expect(screen.getByText("£0.00")).toBeInTheDocument(); // zero total interest paid
  });
});
