// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LoanTrackerShell } from "./LoanTrackerShell";

afterEach(() => {
  cleanup();
});

describe("LoanTrackerShell - example scenario on load", () => {
  it("shows the labelled example banner immediately", () => {
    render(<LoanTrackerShell />);
    expect(screen.getByText("Example projection — change any value")).toBeInTheDocument();
  });

  it("shows a full projection immediately, with no typing required", () => {
    render(<LoanTrackerShell />);
    expect(screen.getByText("Your estimated outcome")).toBeInTheDocument();
    expect(screen.getByText(/\/month$/)).toBeInTheDocument();
    expect(screen.getByText("Loan could end around")).toBeInTheDocument();
    expect(screen.getByText("Estimated total repaid")).toBeInTheDocument();
  });

  it("renders the chart immediately from the example state", () => {
    render(<LoanTrackerShell />);
    expect(screen.getByRole("img", { name: /how much of your loan could be left/i })).toBeInTheDocument();
  });

  it("infers Plan 5 for the example course start date", () => {
    render(<LoanTrackerShell />);
    expect(screen.getByText("Plan 5")).toBeInTheDocument();
  });
});

describe("LoanTrackerShell - client-only example state", () => {
  it("never writes the example state to localStorage or sessionStorage", () => {
    const localSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<LoanTrackerShell />);

    const salaryInput = screen.getByRole("spinbutton", { name: /starting salary - exact value/i });
    fireEvent.change(salaryInput, { target: { value: "50000" } });

    expect(localSpy).not.toHaveBeenCalled();
    localSpy.mockRestore();
  });

  it("never triggers a network request (Budget/Supabase state stays untouched)", () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}"));
    render(<LoanTrackerShell />);

    const salaryInput = screen.getByRole("spinbutton", { name: /starting salary - exact value/i });
    fireEvent.change(salaryInput, { target: { value: "50000" } });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("LoanTrackerShell - editing the example", () => {
  it("updates the monthly repayment immediately when the salary slider's value changes", () => {
    render(<LoanTrackerShell />);
    const before = screen.getByText(/\/month$/).textContent;

    const salaryInput = screen.getByRole("spinbutton", { name: /starting salary - exact value/i });
    fireEvent.change(salaryInput, { target: { value: "50000" } });

    const after = screen.getByText(/\/month$/).textContent;
    expect(after).not.toBe(before);
  });

  it("shows the extra-repayment comparison once extra repayment is above zero, and hides it at zero", () => {
    render(<LoanTrackerShell />);
    expect(screen.queryByText(/What changes with/)).not.toBeInTheDocument();

    const extraInput = screen.getByRole("spinbutton", { name: /extra repayment - exact value/i });
    fireEvent.change(extraInput, { target: { value: "100" } });

    expect(screen.getByText("What changes with £100/month extra")).toBeInTheDocument();

    fireEvent.change(extraInput, { target: { value: "0" } });
    expect(screen.queryByText(/What changes with/)).not.toBeInTheDocument();
  });

  it("restores the example values when Reset to example is clicked", () => {
    render(<LoanTrackerShell />);

    const salaryInput = screen.getByRole("spinbutton", { name: /starting salary - exact value/i });
    fireEvent.change(salaryInput, { target: { value: "50000" } });
    expect(screen.queryByText("Example projection — change any value")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset to example" }));

    expect(screen.getByText("Example projection — change any value")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /starting salary - exact value/i })).toHaveValue(32000);
  });
});

describe("LoanTrackerShell - How this works disclosures", () => {
  it("keeps 'How this works' near the repayment plan closed by default, then opens it", () => {
    render(<LoanTrackerShell />);
    expect(screen.queryByText("Why Plan 5?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "How this works" }));
    expect(screen.getByText("Why Plan 5?")).toBeInTheDocument();
  });

  it("keeps 'How we estimate this' near the projection closed by default, then opens it", () => {
    render(<LoanTrackerShell />);
    fireEvent.click(screen.getByRole("button", { name: "How we estimate this" }));
    expect(screen.getByText(/Salary growth is your assumption/)).toBeInTheDocument();
  });

  it("shows 'What happens if I pay extra?' once extra repayment is above zero, closed until clicked", () => {
    render(<LoanTrackerShell />);
    const extraInput = screen.getByRole("spinbutton", { name: /extra repayment - exact value/i });
    fireEvent.change(extraInput, { target: { value: "100" } });

    expect(screen.queryByText(/Extra repayments are optional/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "What happens if I pay extra?" }));
    expect(screen.getByText(/Extra repayments are optional/)).toBeInTheDocument();
  });
});

describe("LoanTrackerShell - Custom Loan mode switch", () => {
  it("defaults to Student Loan mode with the existing content intact", () => {
    render(<LoanTrackerShell />);
    expect(screen.getByRole("tab", { name: "Student Loan" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Your estimated outcome")).toBeInTheDocument();
  });

  it("switches to the Custom Loan calculator without touching Student Loan state, and back again", () => {
    render(<LoanTrackerShell />);

    fireEvent.click(screen.getByRole("tab", { name: "Custom Loan" }));
    expect(screen.getByRole("tab", { name: "Custom Loan" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Laptop finance")).toBeInTheDocument();
    expect(screen.getByText("Student loan vs normal borrowing")).toBeInTheDocument();
    // The Student Loan assumptions panel is not rendered while in Custom Loan mode.
    expect(screen.queryByText("Your assumptions")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Student Loan" }));
    expect(screen.getByText("Your assumptions")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /starting salary - exact value/i })).toHaveValue(32000);
  });
});

describe("LoanTrackerShell - reduced text still carries required results", () => {
  it("keeps the key result labels visible without expanding any disclosure", () => {
    render(<LoanTrackerShell />);
    const outcomeCard = screen.getByText("Your estimated outcome").closest("div")!.parentElement!;
    const scoped = within(outcomeCard);

    expect(scoped.getByText("When you start working")).toBeInTheDocument();
    expect(scoped.getByText("Likely outcome")).toBeInTheDocument();
    expect(scoped.getByText("Loan could end around")).toBeInTheDocument();
    expect(scoped.getByText("Estimated total repaid")).toBeInTheDocument();
  });
});
