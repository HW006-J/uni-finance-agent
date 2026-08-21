"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/nav/AppHeader";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { MoneyTipCard } from "@/components/dashboard/MoneyTipCard";
import { LoanBalanceChart } from "./LoanBalanceChart";
import { SliderField } from "./SliderField";
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
import { DISCLAIMER } from "@/lib/brand";
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

function planEraNote(plan: LoanPlan): string {
  return plan === "plan5"
    ? "This is the student-loan system used for most English undergraduate courses started from August 2023."
    : "This is the student-loan system used for English undergraduate courses started between September 2012 and July 2023.";
}

export function LoanTrackerShell() {
  const [courseStartDate, setCourseStartDate] = useState("");
  const [planOverride, setPlanOverride] = useState<LoanPlan | null>(null);
  const [showManualPlanPicker, setShowManualPlanPicker] = useState(false);
  const [loanBalance, setLoanBalance] = useState("");
  const [courseEndDate, setCourseEndDate] = useState("");
  const [startingSalary, setStartingSalary] = useState("");
  const [salaryGrowthPercent, setSalaryGrowthPercent] = useState("3");
  const [extraMonthly, setExtraMonthly] = useState("0");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [thresholdGrowthPercent, setThresholdGrowthPercent] = useState("0");

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

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <AppHeader />

      <Card className="mt-6 border-accent/30 bg-accent-light/60 p-4 text-sm font-semibold text-accent-dark">
        This tracker currently covers English undergraduate loans only. If you started your course outside England, or
        have a Postgraduate loan, these figures won&rsquo;t apply to you.
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <h2 className="text-lg font-extrabold text-ink">Your loan</h2>
          <div className="mt-4 space-y-4">
            <Field label="When did you start your undergraduate course?" hint="We use this to work out which repayment rules likely apply to you.">
              <input type="date" value={courseStartDate} onChange={(e) => setCourseStartDate(e.target.value)} className={inputClass} />
            </Field>

            {courseStartDate ? (
              <div className="rounded-2xl bg-cream-dark p-4">
                <p className="text-sm font-extrabold text-ink">
                  You&rsquo;re likely on <span className="text-brand-dark">{rules.label}</span>
                  {planOverride ? <span className="ml-1 text-xs font-semibold text-ink-faint">(chosen manually)</span> : null}
                </p>
                <p className="mt-1 text-xs font-medium text-ink-soft">{planEraNote(plan)}</p>
                {!showManualPlanPicker ? (
                  <button
                    type="button"
                    onClick={() => setShowManualPlanPicker(true)}
                    className="mt-2 text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
                  >
                    Not sure? Choose my plan manually
                  </button>
                ) : (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      {SUPPORTED_LOAN_PLANS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPlanOverride(p)}
                          className={`flex-1 rounded-2xl px-4 py-2 text-sm font-bold transition-colors ${
                            plan === p ? "bg-brand text-white" : "bg-surface text-ink-soft hover:bg-border"
                          }`}
                        >
                          {getStudentLoanRules(p).label}
                        </button>
                      ))}
                    </div>
                    {planOverride ? (
                      <button
                        type="button"
                        onClick={() => setPlanOverride(null)}
                        className="text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
                      >
                        Use the inferred plan instead
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            <SliderField
              label="Current/expected loan balance"
              value={loanBalance}
              onChange={setLoanBalance}
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
              label="Expected course end date"
              hint={
                firstRepaymentDueDate
                  ? `We use this to estimate when repayments may begin: around ${formatYearMonth(firstRepaymentDueDate)}. Repayments don't start the moment you graduate.`
                  : "We use this to estimate when repayments may begin - not the moment you graduate."
              }
            >
              <input type="date" value={courseEndDate} onChange={(e) => setCourseEndDate(e.target.value)} className={inputClass} />
            </Field>

            <SliderField
              label="Expected starting salary"
              hint="Annual, before tax"
              value={startingSalary}
              onChange={setStartingSalary}
              range={STARTING_SALARY_SLIDER}
              displayValue={Number.isFinite(parsedSalary) ? formatSalaryPerYear(parsedSalary) : "Enter a salary"}
              inputPrefix="£"
              presets={STARTING_SALARY_PRESETS}
            />

            <SliderField
              label="Expected annual salary growth"
              hint="A rough estimate is fine - you can change this"
              value={salaryGrowthPercent}
              onChange={setSalaryGrowthPercent}
              range={SALARY_GROWTH_SLIDER}
              displayValue={formatGrowthPerYear(Number.parseFloat(salaryGrowthPercent) || 0)}
              inputSuffix="%"
            />

            <SliderField
              label="Extra repayment"
              hint="Optional - on top of what's normally taken from your pay."
              value={extraMonthly}
              onChange={setExtraMonthly}
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
                <div className="mt-3 space-y-4 rounded-2xl bg-cream-dark p-4">
                  <Field
                    label="Growth in the repayment starting point"
                    hint="Assumed change to the amount you can earn before repayments start, each year - 0% keeps it frozen at today's figure"
                  >
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
                    Interest:{" "}
                    {plan === "plan2"
                      ? "modelled on the current Plan 2 rule, which rises with your income up to a published cap."
                      : "modelled at the current flat Plan 5 rate."}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {active ? (
            <Card className="border-brand/25 bg-brand-light/30 p-6 shadow-tactile">
              <h2 className="text-lg font-extrabold text-ink">Your estimated outcome</h2>

              <div className="mt-4">
                <p className={labelClass}>When you start working</p>
                <p className="mt-1 text-3xl font-extrabold text-brand-dark">
                  {firstMonthRepayment !== null ? `About ${formatMoneyWhole(firstMonthRepayment)}/month` : "£0/month"}
                </p>
                <p className="mt-1 text-xs font-medium text-ink-soft">
                  Estimated automatic student-loan repayment at a {formatMoneyWhole(parsedSalary)} starting salary, under
                  today&rsquo;s {rules.label} rules ({formatMoneyWhole(firstMonthRepayment !== null ? firstMonthRepayment * 12 : 0)}/year).
                </p>
              </div>

              <div className="mt-5 border-t border-brand/15 pt-4">
                {active.payoffDate ? (
                  <>
                    <p className={labelClass}>Likely outcome: loan fully repaid</p>
                    <p className="mt-1 text-xl font-extrabold text-ink">
                      You could finish repaying around {formatYearMonth(active.payoffDate)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className={labelClass}>Likely outcome: some loan written off</p>
                    <p className="mt-1 text-xl font-extrabold text-ink">
                      Remaining loan could be written off around {formatYearMonth(active.writeOffDate)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-ink-soft">
                      Written off means you no longer have to repay the remaining balance.
                    </p>
                  </>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className={labelClass}>You might repay in total</p>
                  <p className="mt-1 text-lg font-extrabold text-ink">{formatMoney(active.totalRepaid)}</p>
                </div>
                {active.balanceAtWriteOff !== null ? (
                  <div>
                    <p className={labelClass}>Could remain when written off</p>
                    <p className="mt-1 text-lg font-extrabold text-ink">{formatMoney(active.balanceAtWriteOff)}</p>
                  </div>
                ) : null}
              </div>
              <p className="mt-3 text-xs font-medium text-ink-soft">
                Based on the assumptions you&rsquo;ve entered and current rules - not a guarantee. Future interest rates,
                thresholds and your actual earnings will change.
              </p>
            </Card>
          ) : null}

          <Card className="p-6">
            <h2 className="text-lg font-extrabold text-ink">Your loan rules</h2>
            <p className="mt-1 text-2xl font-extrabold text-brand-dark">{rules.label}</p>
            <p className="mt-2 text-sm font-medium text-ink-soft">
              Repayments start once you earn more than {formatMoneyWhole(rules.annualRepaymentThreshold)}/year. You repay{" "}
              {Math.round(rules.repaymentRate * 100)}% of the part of your salary above that. If some of the loan is
              still left after {rules.writeOffYearsAfterFirstDue} years, the remainder is written off.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-ink-faint">Using current {rules.effectiveTaxYear} rules</span>
              <a
                href={rules.sources[0].url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-accent-dark underline underline-offset-2"
              >
                How this works →
              </a>
            </div>
          </Card>

          <Card className="p-6 shadow-tactile">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-ink">How much of your loan could be left?</h2>
              <span className="text-xs font-bold text-ink-faint">
                Using current {rules.effectiveTaxYear} {rules.label} rules
              </span>
            </div>

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
                Fill in your course start date, loan balance, course end date and starting salary to see your projection.
              </p>
            )}
          </Card>

          {comparison && results?.withExtra ? (
            <Card className="border-caution/30 bg-caution-light p-5">
              <h3 className="text-sm font-extrabold text-caution-dark">If you pay {formatMoneyWhole(extraAmount)}/month extra</h3>
              <ul className="mt-2 space-y-1.5 text-sm font-semibold text-caution-dark">
                {comparison.monthsEarlier !== null && comparison.monthsEarlier > 0 ? (
                  <li>Loan cleared about {formatMonthsDuration(comparison.monthsEarlier)} earlier</li>
                ) : null}
                <li>
                  You personally repay{" "}
                  {formatMoney(Math.abs(comparison.totalPersonallyRepaidDifference))}{" "}
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
                {comparison.baselineOutcome === "written_off" && comparison.withExtraOutcome === "paid_off" ? (
                  <li>
                    Under these assumptions, paying extra means the loan could be fully repaid instead of a remaining
                    balance being written off - you&rsquo;d be repaying {formatMoney(results.baseline.balanceAtWriteOff ?? 0)} that
                    may otherwise have been written off.
                  </li>
                ) : null}
              </ul>
              <p className="mt-3 text-xs font-semibold text-caution-dark/80">
                Runway doesn&rsquo;t recommend either choice - it&rsquo;s your call.{" "}
                <a
                  href="https://www.gov.uk/repaying-your-student-loan/make-extra-repayments"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Read official guidance →
                </a>
              </p>
            </Card>
          ) : null}

          {active ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile label="Starting balance" value={formatMoney(active.startingBalance)} sublabel="What you told us" />
              <StatTile label="Normal repayments" value={formatMoney(active.totalStatutoryRepaid)} sublabel="Taken automatically from your pay, like tax" />
              {results?.withExtra ? (
                <StatTile label="Extra repayments" value={formatMoney(active.totalVoluntaryRepaid)} sublabel="Your extra payments" />
              ) : null}
            </div>
          ) : null}

          {active ? (
            <Card className="p-5">
              <p className="text-sm font-bold text-ink-soft">Interest added</p>
              <p className="mt-1 text-2xl font-extrabold text-ink">{formatMoney(active.totalInterestAdded)}</p>
              <p className="mt-2 text-xs font-medium text-ink-soft">
                Interest affects the loan balance, but the amount normally taken from your pay is based mainly on your
                income and repayment rules - not directly on this figure.
              </p>
            </Card>
          ) : null}

          <MoneyTipCard context={{ page: "loan_tracker" }} />
        </div>
      </div>

      <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-ink-faint">{DISCLAIMER}</p>
    </main>
  );
}
