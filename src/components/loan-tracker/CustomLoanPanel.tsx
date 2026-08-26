"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SliderField } from "./SliderField";
import { HowThisWorks } from "./HowThisWorks";
import { CustomLoanBalanceChart } from "./CustomLoanBalanceChart";
import { CUSTOM_LOAN_EXAMPLE, isCustomLoanExample, type CustomLoanState } from "./customLoanExample";
import {
  CUSTOM_LOAN_APR_PRESETS,
  CUSTOM_LOAN_APR_SLIDER,
  CUSTOM_LOAN_BALANCE_PRESETS,
  CUSTOM_LOAN_BALANCE_SLIDER,
  CUSTOM_LOAN_REPAYMENT_PRESETS,
  CUSTOM_LOAN_REPAYMENT_SLIDER,
  formatAnnualRateLabel,
  formatCustomLoanRepaymentLabel,
} from "./customLoanInputs";
import { formatMoney, formatMoneyInputPreview, getLargeAmountNotice } from "@/lib/finance/format";
import { formatCustomLoanDuration, simulateCustomLoan } from "@/lib/loans/customLoanSimulation";

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

/**
 * The Custom Loan calculator - a generic stand-in for any non-Student-Finance
 * borrowing (BNPL, overdraft, personal loan, credit card, etc). Entirely
 * client-side and additive to the existing Student Loan experience: it
 * shares no state, calculation code, or Supabase writes with it.
 */
export function CustomLoanPanel() {
  const [state, setState] = useState<CustomLoanState>(CUSTOM_LOAN_EXAMPLE);
  const isExample = isCustomLoanExample(state);

  function updateField<K extends keyof CustomLoanState>(key: K, value: CustomLoanState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function resetToExample() {
    setState(CUSTOM_LOAN_EXAMPLE);
  }

  const displayName = state.loanName.trim() || "Custom loan";

  const parsedBalance = Number.parseFloat(state.balance);
  const parsedApr = Number.parseFloat(state.aprPercent);
  const parsedRepayment = Number.parseFloat(state.monthlyRepayment);
  const balanceLargeNotice = Number.isFinite(parsedBalance) ? getLargeAmountNotice(parsedBalance) : null;

  const hasValidInputs =
    Number.isFinite(parsedBalance) &&
    parsedBalance >= 0 &&
    Number.isFinite(parsedApr) &&
    parsedApr >= 0 &&
    parsedApr <= 100 &&
    Number.isFinite(parsedRepayment) &&
    parsedRepayment >= 0;

  const result = useMemo(() => {
    if (!hasValidInputs) return null;
    return simulateCustomLoan({
      startingBalance: parsedBalance,
      annualPercentageRate: parsedApr,
      monthlyRepayment: parsedRepayment,
    });
  }, [hasValidInputs, parsedBalance, parsedApr, parsedRepayment]);

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="p-6 lg:col-span-1">
        <h2 className="text-lg font-extrabold text-ink">{displayName}</h2>
        <p className="mt-1 text-xs font-medium text-ink-faint">
          See how interest and repayments change the real cost of borrowing. Model another type of borrowing such as a
          personal loan, overdraft or buy-now-pay-later balance.
        </p>
        {isExample ? (
          <p className="mt-2 inline-block rounded-full bg-accent-light px-3 py-1 text-xs font-bold text-accent-dark">
            Example projection — change any value
          </p>
        ) : null}

        <div className="mt-4 space-y-4">
          <Field label="Loan name" hint="e.g. Laptop finance, Overdraft, Personal loan, BNPL purchase">
            <input
              type="text"
              value={state.loanName}
              onChange={(e) => updateField("loanName", e.target.value)}
              placeholder="Custom loan"
              className={inputClass}
            />
          </Field>

          <SliderField
            label="Balance"
            value={state.balance}
            onChange={(v) => updateField("balance", v)}
            range={CUSTOM_LOAN_BALANCE_SLIDER}
            displayValue={formatMoneyInputPreview(state.balance) ?? "Enter an amount"}
            inputPrefix="£"
            presets={CUSTOM_LOAN_BALANCE_PRESETS}
            belowSlider={balanceLargeNotice ? <p className="text-xs font-semibold text-caution-dark">{balanceLargeNotice}</p> : null}
          />

          <SliderField
            label="Annual interest rate"
            value={state.aprPercent}
            onChange={(v) => updateField("aprPercent", v)}
            range={CUSTOM_LOAN_APR_SLIDER}
            displayValue={Number.isFinite(parsedApr) ? formatAnnualRateLabel(parsedApr) : "Enter a rate"}
            inputSuffix="%"
            presets={CUSTOM_LOAN_APR_PRESETS}
            hint="Enter the annual rate charged on the outstanding balance."
            belowSlider={
              <HowThisWorks label="How this works" title="How this works">
                <p>
                  This is an illustrative projection using a monthly rate derived from the annual interest rate. Actual
                  lender calculations, fees and repayment terms may differ.
                </p>
              </HowThisWorks>
            }
          />

          <SliderField
            label="Monthly repayment"
            value={state.monthlyRepayment}
            onChange={(v) => updateField("monthlyRepayment", v)}
            range={CUSTOM_LOAN_REPAYMENT_SLIDER}
            displayValue={Number.isFinite(parsedRepayment) ? formatCustomLoanRepaymentLabel(parsedRepayment) : "Enter an amount"}
            inputPrefix="£"
            inputSuffix="/mo"
            presets={CUSTOM_LOAN_REPAYMENT_PRESETS}
          />

          <button
            type="button"
            onClick={resetToExample}
            className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-bold text-ink-soft hover:bg-cream-dark"
          >
            Reset to example
          </button>
        </div>
      </Card>

      <div className="space-y-6 lg:col-span-2">
        {result && result.balanceNeverFalls ? (
          <Card className="border-caution/30 bg-caution-light p-6 shadow-tactile">
            <h2 className="text-lg font-extrabold text-caution-dark">Your balance isn&rsquo;t falling</h2>
            <p className="mt-2 text-sm font-bold text-caution-dark">
              At this repayment level, your balance is not currently falling.
            </p>
            <p className="mt-2 text-sm font-semibold text-caution-dark">
              Your monthly repayment needs to be higher than the interest being added — currently about{" "}
              {formatMoney(result.firstMonthInterest)}/month — for the balance to reduce.
            </p>
          </Card>
        ) : null}

        {result && !result.balanceNeverFalls ? (
          <Card className="border-brand/25 bg-brand-light/30 p-6 shadow-tactile">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-ink">Your estimated outcome</h2>
              <HowThisWorks label="How we estimate this" title="How we estimate this">
                <p>We assume interest accrues monthly on the outstanding balance, and your repayment stays fixed.</p>
                <p>Real lenders may compound interest daily or change your rate - this is an illustrative estimate.</p>
                <p>This is illustrative, not a guarantee of what you&rsquo;ll actually repay.</p>
              </HowThisWorks>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className={labelClass}>Monthly repayment</p>
                <p className="mt-1 text-3xl font-extrabold text-brand-dark">{formatCustomLoanRepaymentLabel(result.monthlyRepayment)}</p>
              </div>
              <div>
                <p className={labelClass}>Estimated time to repay</p>
                <p className="mt-1 text-lg font-extrabold text-ink">
                  {result.payoffMonths !== null
                    ? formatCustomLoanDuration(result.payoffMonths)
                    : result.reachedMaxHorizon
                      ? "Still not repaid after 50 years"
                      : "—"}
                </p>
              </div>
              <div>
                <p className={labelClass}>Total interest paid</p>
                <p className="mt-1 text-lg font-extrabold text-ink">{formatMoney(result.totalInterestPaid)}</p>
              </div>
              <div>
                <p className={labelClass}>Total amount repaid</p>
                <p className="mt-1 text-lg font-extrabold text-ink">{formatMoney(result.totalRepaid)}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-brand/20 pt-3 text-xs font-semibold text-ink-soft">
              <span>Original balance: {formatMoney(result.startingBalance)}</span>
              <span>Interest paid: {formatMoney(result.totalInterestPaid)}</span>
            </div>
          </Card>
        ) : null}

        <Card className="p-6">
          <h2 className="text-lg font-extrabold text-ink">Loan over time</h2>
          {result && !result.balanceNeverFalls ? (
            <div className="mt-4">
              <CustomLoanBalanceChart months={result.months} startingBalance={result.startingBalance} reachedMaxHorizon={result.reachedMaxHorizon} />
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-cream-dark p-6 text-center text-sm font-medium text-ink-soft">
              {result?.balanceNeverFalls
                ? "No graph to show yet - increase your monthly repayment above the interest being added to see a payoff projection."
                : "Fill in your balance, interest rate and monthly repayment to see your projection."}
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-ink">Student loan vs normal borrowing</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 text-xs font-medium text-ink-soft sm:grid-cols-2">
            <div>
              <p className="text-xs font-extrabold text-ink">Student loans</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                <li>Repayments depend on your income, not the balance</li>
                <li>May eventually be written off, depending on your plan and its rules</li>
                <li>Don&rsquo;t behave like a normal consumer loan</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-extrabold text-ink">Custom loans (this calculator)</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                <li>Usually charge interest on the outstanding balance</li>
                <li>Require contractual repayments, whether or not you&rsquo;re earning</li>
                <li>Generally need to be repaid in full - there&rsquo;s no write-off</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
