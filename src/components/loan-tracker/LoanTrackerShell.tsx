"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/nav/AppHeader";
import { Card } from "@/components/ui/Card";
import { MoneyTipCard } from "@/components/dashboard/MoneyTipCard";
import { LoanBalanceChart } from "./LoanBalanceChart";
import { SliderField } from "./SliderField";
import { HowThisWorks } from "./HowThisWorks";
import { CustomLoanPanel } from "./CustomLoanPanel";
import { EXAMPLE_SCENARIO, isExampleScenario, type LoanTrackerState } from "./exampleScenario";
import {
  EXTRA_REPAYMENT_PRESETS,
  EXTRA_REPAYMENT_SLIDER,
  LOAN_BALANCE_PRESETS,
  LOAN_BALANCE_SLIDER,
  SALARY_GROWTH_SLIDER,
  STARTING_SALARY_PRESETS,
  STARTING_SALARY_SLIDER,
  formatExtraRepaymentLabel,
  formatGrowthPerYear,
  formatSalaryPerYear,
} from "./sliderInputs";
import { formatMoney, formatMoneyInputPreview, formatMoneyWhole, getLargeAmountNotice } from "@/lib/finance/format";
import {
  compareLoanSimulations,
  deriveFirstRepaymentDueDate,
  formatMonthsDuration,
  simulateLoan,
  type LoanSimulationResult,
} from "@/lib/loans/loanSimulation";
import { getStudentLoanRules, inferPlanFromCourseStart, SUPPORTED_LOAN_PLANS, type LoanPlan } from "@/lib/loans/studentLoanRules";

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
  const [mode, setMode] = useState<"student" | "custom">("student");
  const [state, setState] = useState<LoanTrackerState>(EXAMPLE_SCENARIO);
  const [planOverride, setPlanOverride] = useState<LoanPlan | null>(null);
  const [showManualPlanPicker, setShowManualPlanPicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [thresholdGrowthPercent, setThresholdGrowthPercent] = useState("0");

  const { courseStartDate, courseEndDate, loanBalance, startingSalary, salaryGrowthPercent, extraMonthly } = state;
  const isExample = isExampleScenario(state);

  function updateField<K extends keyof LoanTrackerState>(key: K, value: LoanTrackerState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function resetToExample() {
    setState(EXAMPLE_SCENARIO);
    setPlanOverride(null);
    setShowManualPlanPicker(false);
    setShowAdvanced(false);
    setThresholdGrowthPercent("0");
  }

  const inferredPlan = courseStartDate ? inferPlanFromCourseStart(courseStartDate) : null;
  const plan = planOverride ?? inferredPlan ?? "plan5";
  const rules = getStudentLoanRules(plan);

  const parsedBalance = Number.parseFloat(loanBalance);
  const parsedSalary = Number.parseFloat(startingSalary);
  const loanBalanceLargeNotice = Number.isFinite(parsedBalance) ? getLargeAmountNotice(parsedBalance) : null;

  const hasValidInputs =
    courseStartDate.length > 0 &&
    Number.isFinite(parsedBalance) &&
    parsedBalance >= 0 &&
    Number.isFinite(parsedSalary) &&
    parsedSalary >= 0 &&
    courseEndDate.length > 0;

  const firstRepaymentDueDate = useMemo(
    () => (courseEndDate ? deriveFirstRepaymentDueDate(courseEndDate) : null),
    [courseEndDate],
  );

  const extraAmount = Math.max(0, Number.parseFloat(extraMonthly) || 0);

  const results = useMemo<{ baseline: LoanSimulationResult; withExtra: LoanSimulationResult | null } | null>(() => {
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

    const withExtra =
      extraAmount > 0
        ? simulateLoan({
            plan,
            startingBalance: parsedBalance,
            firstRepaymentDueDate,
            startingSalary: parsedSalary,
            salaryGrowthRate,
            thresholdGrowthRate,
            voluntaryMonthlyRepayment: extraAmount,
          })
        : null;

    return { baseline, withExtra };
  }, [hasValidInputs, firstRepaymentDueDate, plan, parsedBalance, parsedSalary, salaryGrowthPercent, thresholdGrowthPercent, extraAmount]);

  const active = results ? (results.withExtra ?? results.baseline) : null;
  const comparison = results?.withExtra ? compareLoanSimulations(results.baseline, results.withExtra) : null;
  const firstMonthRepayment = active?.months[0]?.statutoryRepayment ?? null;
  const outcomeLabel = active?.payoffDate ? "Paid off" : "Written off";
  const keyDate = active ? (active.payoffDate ?? active.writeOffDate) : null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <AppHeader />

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Loan Tracker</h1>
          <p className="mt-1 text-xs font-medium text-ink-faint">
            {mode === "student"
              ? "English undergraduate loans only · illustrative estimate, not financial advice"
              : "Model other borrowing, like a personal loan, overdraft or BNPL balance · illustrative estimate, not financial advice"}
          </p>

          <div
            className="mt-3 inline-flex items-center gap-1 rounded-2xl bg-cream-dark p-1"
            role="tablist"
            aria-label="Loan Tracker mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "student"}
              onClick={() => setMode("student")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                mode === "student" ? "bg-surface text-brand-dark shadow-tactile-sm" : "text-ink-soft hover:text-ink"
              }`}
            >
              Student Loan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "custom"}
              onClick={() => setMode("custom")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                mode === "custom" ? "bg-surface text-brand-dark shadow-tactile-sm" : "text-ink-soft hover:text-ink"
              }`}
            >
              Custom Loan
            </button>
          </div>

          {mode === "student" && isExample ? (
            <p className="mt-2 inline-block rounded-full bg-accent-light px-3 py-1 text-xs font-bold text-accent-dark">
              Example projection — change any value
            </p>
          ) : null}
        </div>
        {mode === "student" ? (
          <button
            type="button"
            onClick={resetToExample}
            className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-bold text-ink-soft hover:bg-cream-dark"
          >
            Reset to example
          </button>
        ) : null}
      </div>

      {mode === "custom" ? (
        <CustomLoanPanel />
      ) : (
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <h2 className="text-lg font-extrabold text-ink">Your assumptions</h2>
          <div className="mt-4 space-y-4">
            <Field label="Course start">
              <input
                type="date"
                value={courseStartDate}
                onChange={(e) => updateField("courseStartDate", e.target.value)}
                className={inputClass}
              />
            </Field>

            {courseStartDate ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-cream-dark px-4 py-3">
                <p className="text-sm font-extrabold text-ink">
                  {rules.label}
                  {planOverride ? <span className="ml-1 text-xs font-semibold text-ink-faint">(manual)</span> : null}
                </p>
                <HowThisWorks label="How this works" title={`Why ${rules.label}?`}>
                  <p>
                    We infer this from your course start date - courses from August 2023 onward use Plan 5; earlier ones
                    use Plan 2.
                  </p>
                  <p>Repayments only start once you earn above {formatMoneyWhole(rules.annualRepaymentThreshold)}/year.</p>
                  <p>You repay {Math.round(rules.repaymentRate * 100)}% of the part of your income above that threshold.</p>
                  <p>Any balance still left after {rules.writeOffYearsAfterFirstDue} years is written off.</p>
                </HowThisWorks>
                {!showManualPlanPicker ? (
                  <button
                    type="button"
                    onClick={() => setShowManualPlanPicker(true)}
                    className="text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
                  >
                    Not sure?
                  </button>
                ) : null}
                {showManualPlanPicker ? (
                  <div className="mt-1 flex w-full flex-wrap items-center gap-2">
                    {SUPPORTED_LOAN_PLANS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlanOverride(p)}
                        className={`rounded-2xl px-3 py-1.5 text-xs font-bold transition-colors ${
                          plan === p ? "bg-brand text-white" : "bg-surface text-ink-soft hover:bg-border"
                        }`}
                      >
                        {getStudentLoanRules(p).label}
                      </button>
                    ))}
                    {planOverride ? (
                      <button
                        type="button"
                        onClick={() => setPlanOverride(null)}
                        className="text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
                      >
                        Use inferred
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <SliderField
              label="Loan balance"
              value={loanBalance}
              onChange={(v) => updateField("loanBalance", v)}
              range={LOAN_BALANCE_SLIDER}
              displayValue={formatMoneyInputPreview(loanBalance) ?? "Enter an amount"}
              inputPrefix="£"
              presets={LOAN_BALANCE_PRESETS}
              belowSlider={
                loanBalanceLargeNotice ? (
                  <p className="text-xs font-semibold text-caution-dark">{loanBalanceLargeNotice}</p>
                ) : null
              }
            />

            <Field
              label="Course end"
              hint={firstRepaymentDueDate ? `First repayment due ~${formatYearMonth(firstRepaymentDueDate)}` : undefined}
            >
              <input
                type="date"
                value={courseEndDate}
                onChange={(e) => updateField("courseEndDate", e.target.value)}
                className={inputClass}
              />
            </Field>

            <SliderField
              label="Starting salary"
              hint="Annual, before tax"
              value={startingSalary}
              onChange={(v) => updateField("startingSalary", v)}
              range={STARTING_SALARY_SLIDER}
              displayValue={Number.isFinite(parsedSalary) ? formatSalaryPerYear(parsedSalary) : "Enter a salary"}
              inputPrefix="£"
              presets={STARTING_SALARY_PRESETS}
            />

            <SliderField
              label="Salary growth"
              value={salaryGrowthPercent}
              onChange={(v) => updateField("salaryGrowthPercent", v)}
              range={SALARY_GROWTH_SLIDER}
              displayValue={formatGrowthPerYear(Number.parseFloat(salaryGrowthPercent) || 0)}
              inputSuffix="%"
            />

            <SliderField
              label="Extra repayment"
              hint="Optional"
              value={extraMonthly}
              onChange={(v) => updateField("extraMonthly", v)}
              range={EXTRA_REPAYMENT_SLIDER}
              displayValue={formatExtraRepaymentLabel(extraAmount)}
              inputPrefix="£"
              inputSuffix="/mo"
              presets={EXTRA_REPAYMENT_PRESETS}
            />

            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
              >
                {showAdvanced ? "Hide" : "Show"} advanced assumptions
              </button>
              {showAdvanced ? (
                <div className="mt-3 space-y-3 rounded-2xl bg-cream-dark p-4">
                  <Field label="Repayment threshold growth" hint="0% keeps it frozen at today's figure">
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
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {active ? (
            <Card className="border-brand/25 bg-brand-light/30 p-6 shadow-tactile">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-ink">Your estimated outcome</h2>
                <HowThisWorks label="How we estimate this" title="How we estimate this">
                  <p>We use today&rsquo;s repayment rules and thresholds - not guaranteed future figures.</p>
                  <p>Salary growth is your assumption, not a prediction.</p>
                  <p>Interest rates and thresholds can change over a 30-40 year loan term.</p>
                  <p>This is illustrative, not a guarantee of what you&rsquo;ll actually repay.</p>
                </HowThisWorks>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className={labelClass}>When you start working</p>
                  <p className="mt-1 text-3xl font-extrabold text-brand-dark">
                    {firstMonthRepayment !== null ? `${formatMoneyWhole(firstMonthRepayment)}/month` : "£0/month"}
                  </p>
                </div>
                <div>
                  <p className={labelClass}>Likely outcome</p>
                  <p className="mt-1 text-lg font-extrabold text-ink">
                    {outcomeLabel}
                    {active.balanceAtWriteOff !== null ? ` (≈${formatMoney(active.balanceAtWriteOff)} left)` : ""}
                  </p>
                </div>
                <div>
                  <p className={labelClass}>Loan could end around</p>
                  <p className="mt-1 text-lg font-extrabold text-ink">{keyDate ? formatYearMonth(keyDate) : "—"}</p>
                </div>
                <div>
                  <p className={labelClass}>Estimated total repaid</p>
                  <p className="mt-1 text-lg font-extrabold text-ink">{formatMoney(active.totalRepaid)}</p>
                </div>
              </div>
            </Card>
          ) : null}

          <Card className="p-6">
            <h2 className="text-lg font-extrabold text-ink">Loan over time</h2>
            {active ? (
              <div className="mt-4">
                <LoanBalanceChart
                  baseline={results!.baseline.months}
                  withExtra={results!.withExtra?.months ?? null}
                  extraMonthlyAmount={extraAmount}
                  currency="GBP"
                />
              </div>
            ) : (
              <p className="mt-6 rounded-2xl bg-cream-dark p-6 text-center text-sm font-medium text-ink-soft">
                Fill in your course dates, loan balance and starting salary to see your projection.
              </p>
            )}
          </Card>

          {comparison && results?.withExtra ? (
            <Card className="border-caution/30 bg-caution-light p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-caution-dark">
                  What changes with {formatMoneyWhole(extraAmount)}/month extra
                </h3>
                <HowThisWorks label="What happens if I pay extra?" title="What happens if I pay extra?">
                  <p>Extra repayments are optional - on top of what&rsquo;s normally deducted from your pay.</p>
                  <p>
                    Paying extra may or may not be worth it: if some of your loan would otherwise be written off, paying
                    extra can mean repaying money you might never have owed.
                  </p>
                  <p>
                    <a
                      href="https://www.gov.uk/repaying-your-student-loan/make-extra-repayments"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      Read official guidance →
                    </a>
                  </p>
                </HowThisWorks>
              </div>
              <ul className="mt-2 space-y-1.5 text-sm font-semibold text-caution-dark">
                {comparison.monthsEarlier !== null && comparison.monthsEarlier > 0 ? (
                  <li>Loan cleared about {formatMonthsDuration(comparison.monthsEarlier)} earlier</li>
                ) : null}
                <li>
                  You personally repay {formatMoney(Math.abs(comparison.totalPersonallyRepaidDifference))}{" "}
                  {comparison.totalPersonallyRepaidDifference >= 0 ? "more" : "less"} overall
                </li>
                <li>
                  Estimated interest {comparison.totalInterestDifference <= 0 ? "goes down by" : "goes up by"}{" "}
                  {formatMoney(Math.abs(comparison.totalInterestDifference))}
                </li>
                {comparison.writtenOffReducedBy !== null ? (
                  <li>
                    Amount eventually written off changes from {formatMoney(results.baseline.balanceAtWriteOff ?? 0)} to{" "}
                    {formatMoney(results.withExtra.balanceAtWriteOff ?? 0)}
                  </li>
                ) : null}
              </ul>
            </Card>
          ) : null}

          <MoneyTipCard context={{ page: "loan_tracker" }} />
        </div>
      </div>
      )}

      <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-ink-faint">
        Runway doesn&rsquo;t give financial advice. Figures are estimates under current rules and may change.
      </p>
    </main>
  );
}
