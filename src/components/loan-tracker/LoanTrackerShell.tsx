"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/nav/AppHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { MoneyTipCard } from "@/components/dashboard/MoneyTipCard";
import { LoanBalanceChart } from "./LoanBalanceChart";
import { DISCLAIMER } from "@/lib/brand";
import { formatMoney } from "@/lib/finance/format";
import { deriveFirstRepaymentDueDate, simulateLoan, type LoanSimulationResult } from "@/lib/loans/loanSimulation";
import { getStudentLoanRules, SUPPORTED_LOAN_PLANS, type LoanPlan } from "@/lib/loans/studentLoanRules";

const inputClass =
  "w-full rounded-2xl border border-border bg-cream px-4 py-2.5 text-sm font-medium text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none";
const labelClass = "text-xs font-bold uppercase tracking-wide text-ink-soft";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? <span className="block text-xs font-medium text-ink-faint">{hint}</span> : null}
    </label>
  );
}

function formatYearMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function LoanTrackerShell() {
  const [plan, setPlan] = useState<LoanPlan>("plan5");
  const [loanBalance, setLoanBalance] = useState("");
  const [courseEndDate, setCourseEndDate] = useState("");
  const [startingSalary, setStartingSalary] = useState("");
  const [salaryGrowthPercent, setSalaryGrowthPercent] = useState("3");
  const [voluntaryMonthly, setVoluntaryMonthly] = useState("0");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [thresholdGrowthPercent, setThresholdGrowthPercent] = useState("0");

  const rules = getStudentLoanRules(plan);

  const parsedBalance = Number.parseFloat(loanBalance);
  const parsedSalary = Number.parseFloat(startingSalary);
  const hasValidInputs =
    Number.isFinite(parsedBalance) && parsedBalance >= 0 && Number.isFinite(parsedSalary) && parsedSalary >= 0 && courseEndDate.length > 0;

  const firstRepaymentDueDate = useMemo(
    () => (courseEndDate ? deriveFirstRepaymentDueDate(courseEndDate) : null),
    [courseEndDate],
  );

  const voluntaryAmount = Math.max(0, Number.parseFloat(voluntaryMonthly) || 0);

  const results = useMemo<{ baseline: LoanSimulationResult; withVoluntary: LoanSimulationResult | null } | null>(() => {
    if (!hasValidInputs || !firstRepaymentDueDate) return null;
    const salaryGrowthRate = (Number.parseFloat(salaryGrowthPercent) || 0) / 100;
    const thresholdGrowthRate = (Number.parseFloat(thresholdGrowthPercent) || 0) / 100;

    const baseline = simulateLoan({
      plan,
      startingBalance: parsedBalance,
      firstRepaymentDueDate,
      startingSalary: parsedSalary,
      salaryGrowthRate,
      thresholdGrowthRate,
    });

    const withVoluntary =
      voluntaryAmount > 0
        ? simulateLoan({
            plan,
            startingBalance: parsedBalance,
            firstRepaymentDueDate,
            startingSalary: parsedSalary,
            salaryGrowthRate,
            thresholdGrowthRate,
            voluntaryMonthlyRepayment: voluntaryAmount,
          })
        : null;

    return { baseline, withVoluntary };
  }, [hasValidInputs, firstRepaymentDueDate, plan, parsedBalance, parsedSalary, salaryGrowthPercent, thresholdGrowthPercent, voluntaryAmount]);

  const active = results ? (results.withVoluntary ?? results.baseline) : null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <AppHeader />

      <Card className="mt-6 border-accent/30 bg-accent-light/60 p-4 text-sm font-semibold text-accent-dark">
        This tracker currently models English undergraduate <strong>Plan 2</strong> and <strong>Plan 5</strong> loans only. If
        you&rsquo;re on Plan 1, Plan 4 (Scotland) or a Postgraduate loan, these figures won&rsquo;t apply to you.
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <h2 className="text-lg font-extrabold text-ink">Your loan</h2>
          <div className="mt-4 space-y-4">
            <Field label="Repayment plan">
              <div className="flex gap-2">
                {SUPPORTED_LOAN_PLANS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${
                      plan === p ? "bg-brand text-white" : "bg-cream text-ink-soft hover:bg-cream-dark"
                    }`}
                  >
                    {getStudentLoanRules(p).label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Current/expected loan balance">
              <input
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="e.g. 45000"
                value={loanBalance}
                onChange={(e) => setLoanBalance(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field
              label="Expected course end date"
              hint={firstRepaymentDueDate ? `First repayment estimated: ${formatYearMonth(firstRepaymentDueDate)}` : "Used to estimate your first repayment date (the following 6 April)"}
            >
              <input type="date" value={courseEndDate} onChange={(e) => setCourseEndDate(e.target.value)} className={inputClass} />
            </Field>

            <Field label="Expected starting salary" hint="Annual, before tax">
              <input
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="e.g. 28000"
                value={startingSalary}
                onChange={(e) => setStartingSalary(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Expected annual salary growth" hint="A rough estimate is fine - you can change this">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={salaryGrowthPercent}
                  onChange={(e) => setSalaryGrowthPercent(e.target.value)}
                  className={inputClass}
                />
                <span className="text-sm font-bold text-ink-soft">%/yr</span>
              </div>
            </Field>

            <Field label="Extra voluntary repayment" hint="On top of what's taken automatically">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink-soft">£</span>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={voluntaryMonthly}
                  onChange={(e) => setVoluntaryMonthly(e.target.value)}
                  className={inputClass}
                />
                <span className="text-sm font-bold text-ink-soft">/mo</span>
              </div>
              <Button variant="secondary" className="mt-1 !px-3 !py-1.5 text-xs" onClick={() => setVoluntaryMonthly(String(voluntaryAmount + 50))}>
                Try +£50/month
              </Button>
            </Field>

            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
              >
                {showAdvanced ? "Hide" : "Show"} advanced assumptions
              </button>
              {showAdvanced ? (
                <div className="mt-3 space-y-4 rounded-2xl bg-cream-dark p-4">
                  <Field label="Repayment threshold growth" hint="Assumed change to the threshold each year - 0% keeps it frozen at today's figure">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdGrowthPercent}
                        onChange={(e) => setThresholdGrowthPercent(e.target.value)}
                        className={inputClass}
                      />
                      <span className="text-sm font-bold text-ink-soft">%/yr</span>
                    </div>
                  </Field>
                  <p className="text-xs font-medium text-ink-soft">
                    Interest: {plan === "plan2" ? "modelled on the current income-linked Plan 2 rule (RPI to RPI+3%, capped at the current published rate)." : "modelled at the current flat Plan 5 rate (RPI)."}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6 shadow-tactile">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-ink">Outstanding balance over time</h2>
              <span className="text-xs font-bold text-ink-faint">
                Using current {rules.effectiveTaxYear} {rules.label} rules
              </span>
            </div>

            {active ? (
              <div className="mt-4">
                <LoanBalanceChart baseline={results!.baseline.months} withVoluntary={results!.withVoluntary?.months ?? null} currency="GBP" />
              </div>
            ) : (
              <p className="mt-6 rounded-2xl bg-cream-dark p-6 text-center text-sm font-medium text-ink-soft">
                Fill in your loan balance, course end date and starting salary to see your projection.
              </p>
            )}

            <p className="mt-4 text-xs font-medium text-ink-soft">
              Illustrative projection based on the assumptions above and below - not a guarantee. Future interest rates,
              thresholds and your actual earnings will change.
            </p>
          </Card>

          {active ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Starting balance" value={formatMoney(active.startingBalance, "GBP")} sublabel="What you told us" />
              {active.payoffDate ? (
                <StatTile
                  label="Estimated payoff"
                  value={formatYearMonth(active.payoffDate)}
                  sublabel="Estimated under these assumptions"
                  emphasis
                />
              ) : (
                <StatTile
                  label="Projected write-off date"
                  value={formatYearMonth(active.writeOffDate)}
                  sublabel={`${rules.writeOffYearsAfterFirstDue} years after first due to repay`}
                />
              )}
              <StatTile label="Estimated total repaid" value={formatMoney(active.totalRepaid, "GBP")} sublabel="Statutory + voluntary" />
              <StatTile label="Estimated interest added" value={formatMoney(active.totalInterestAdded, "GBP")} sublabel="Over the whole projection" />
              {active.balanceAtWriteOff !== null ? (
                <StatTile
                  label="Estimated amount written off"
                  value={formatMoney(active.balanceAtWriteOff, "GBP")}
                  sublabel="Remaining balance at write-off"
                />
              ) : null}
              <StatTile label="Statutory repayments" value={formatMoney(active.totalStatutoryRepaid, "GBP")} sublabel="Taken automatically, like tax" />
              {results?.withVoluntary ? (
                <StatTile label="Voluntary repayments" value={formatMoney(active.totalVoluntaryRepaid, "GBP")} sublabel="Your extra payments" />
              ) : null}
            </div>
          ) : null}

          {results?.withVoluntary ? (
            <Card className="border-caution/30 bg-caution-light p-5 text-sm font-semibold text-caution-dark">
              Extra repayments don&rsquo;t reduce what&rsquo;s taken automatically from your pay - they&rsquo;re on top of it.
              Compare the two lines above: paying extra either clears the loan earlier and cuts interest, or simply means
              paying more before an amount that might otherwise have been written off. Wallet Buddy doesn&rsquo;t recommend
              either choice - it&rsquo;s your call.{" "}
              <a
                href="https://www.gov.uk/repaying-your-student-loan/make-extra-repayments"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Read official guidance →
              </a>
            </Card>
          ) : null}

          <MoneyTipCard context={{ page: "loan_tracker" }} />
        </div>
      </div>

      <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-ink-faint">{DISCLAIMER}</p>
    </main>
  );
}
