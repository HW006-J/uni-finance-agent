"use client";

import { useMemo, useState } from "react";
import type { LoanMonthPoint } from "@/lib/loans/loanSimulation";
import { formatMoney, formatMoneyCompact, formatMoneyWhole } from "@/lib/finance/format";
import type { Currency } from "@/types/finance";

const WIDTH = 760;
const HEIGHT = 340;
const PAD_LEFT = 56;
const PAD_RIGHT = 24;
const PAD_TOP = 36;
const PAD_BOTTOM = 36;

const BASELINE_COLOR = "#12784a"; // --color-brand-dark
const EXTRA_COLOR = "#b6790f"; // --color-accent-dark

function niceStep(maxValue: number): number {
  if (maxValue <= 0) return 1;
  const rough = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  return step * magnitude;
}

export function LoanBalanceChart({
  baseline,
  withExtra,
  extraMonthlyAmount,
  currency,
}: {
  baseline: LoanMonthPoint[];
  withExtra: LoanMonthPoint[] | null;
  /** The extra monthly amount that produced `withExtra`, for the legend/tooltip labels. */
  extraMonthlyAmount: number;
  currency: Currency;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const totalMonths = Math.max(baseline.length, withExtra?.length ?? 0, 1);
  const maxBalance = Math.max(1, ...baseline.map((m) => m.balance), ...(withExtra ?? []).map((m) => m.balance));
  const yStep = niceStep(maxBalance);
  const yMax = Math.ceil(maxBalance / yStep) * yStep;

  const xForMonth = (m: number) => PAD_LEFT + (m / (totalMonths - 1 || 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const yForBalance = (b: number) => PAD_TOP + (1 - b / yMax) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  function balanceAt(series: LoanMonthPoint[], monthIndex: number): number {
    if (monthIndex < series.length) return series[monthIndex].balance;
    return 0; // paid off before this point
  }

  function pathFor(series: LoanMonthPoint[]): string {
    if (series.length === 0) {
      return `M${xForMonth(0).toFixed(2)},${yForBalance(0).toFixed(2)} L${xForMonth(totalMonths - 1).toFixed(2)},${yForBalance(0).toFixed(2)}`;
    }
    const points: [number, number][] = series.map((point, i) => [xForMonth(i), yForBalance(point.balance)]);
    // Extend flat to totalMonths if this series paid off before the other one.
    if (series.length < totalMonths) {
      points.push([xForMonth(totalMonths - 1), yForBalance(0)]);
    }
    return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  }

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = 0; v <= yMax; v += yStep) ticks.push(v);
    return ticks;
  }, [yMax, yStep]);

  const yearStepMonths = totalMonths > 240 ? 60 : totalMonths > 120 ? 24 : totalMonths > 48 ? 12 : 6;
  const xTicks: number[] = [];
  for (let m = 0; m < totalMonths; m += yearStepMonths) xTicks.push(m);

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.min(1, Math.max(0, (x * (WIDTH / rect.width) - PAD_LEFT) / (WIDTH - PAD_LEFT - PAD_RIGHT)));
    const monthIndex = Math.round(fraction * (totalMonths - 1));
    setHoverIndex(monthIndex);
  }

  const hoverPoint = hoverIndex !== null ? (baseline[hoverIndex] ?? withExtra?.[hoverIndex]) : null;
  const hoverBaseline = hoverIndex !== null ? balanceAt(baseline, hoverIndex) : null;
  const hoverExtra = hoverIndex !== null && withExtra ? balanceAt(withExtra, hoverIndex) : null;

  // End-of-line event markers: where each series actually finishes (payoff or write-off), not necessarily the chart's right edge.
  const baselineEndIndex = Math.max(0, baseline.length - 1);
  const baselineEndMarker = {
    x: xForMonth(baselineEndIndex),
    y: yForBalance(balanceAt(baseline, baselineEndIndex)),
    label: baseline[baselineEndIndex]?.balance === 0 || baseline.length === 0 ? "Loan cleared" : "Remainder written off",
  };
  const extraEndIndex = withExtra ? Math.max(0, withExtra.length - 1) : null;
  const extraEndMarker =
    withExtra && extraEndIndex !== null
      ? {
          x: xForMonth(extraEndIndex),
          y: yForBalance(balanceAt(withExtra, extraEndIndex)),
          label: withExtra[extraEndIndex]?.balance === 0 || withExtra.length === 0 ? "Loan cleared" : "Remainder written off",
        }
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: BASELINE_COLOR }} />
          Normal repayments
        </span>
        {withExtra ? (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded-full"
              style={{
                backgroundColor: EXTRA_COLOR,
                backgroundImage: `repeating-linear-gradient(90deg, ${EXTRA_COLOR} 0 4px, transparent 4px 7px)`,
              }}
            />
            With {formatMoneyWhole(extraMonthlyAmount, currency)}/month extra
          </span>
        ) : null}
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-2 w-full" role="img" aria-label="How much of your loan could be left over time">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yForBalance(tick)}
              y2={yForBalance(tick)}
              stroke="#eae2d2"
              strokeWidth={1}
            />
            <text x={PAD_LEFT - 8} y={yForBalance(tick) + 4} textAnchor="end" fontSize={11} fill="#736b5e" fontWeight={600}>
              {formatMoneyCompact(tick, currency)}
            </text>
          </g>
        ))}

        {xTicks.map((m) => {
          const point = baseline[m] ?? withExtra?.[m];
          const year = point ? new Date(point.date).getUTCFullYear() : null;
          return (
            <text key={m} x={xForMonth(m)} y={HEIGHT - PAD_BOTTOM + 18} textAnchor="middle" fontSize={11} fill="#736b5e" fontWeight={600}>
              {year ?? ""}
            </text>
          );
        })}

        {/* "Repayments start" marker */}
        <line x1={xForMonth(0)} x2={xForMonth(0)} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} stroke="#a89f8f" strokeWidth={1} strokeDasharray="2 3" />
        <text x={xForMonth(0) + 4} y={PAD_TOP - 12} fontSize={10} fontWeight={700} fill="#736b5e">
          Repayments start
        </text>

        <path d={pathFor(baseline)} fill="none" stroke={BASELINE_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {withExtra ? (
          <path
            d={pathFor(withExtra)}
            fill="none"
            stroke={EXTRA_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 5"
          />
        ) : null}

        {/* End-of-line event markers, readable without hovering. */}
        <g>
          <circle cx={baselineEndMarker.x} cy={baselineEndMarker.y} r={3.5} fill={BASELINE_COLOR} />
          <text
            x={Math.min(baselineEndMarker.x, WIDTH - PAD_RIGHT - 4)}
            y={Math.max(baselineEndMarker.y - 10, PAD_TOP + 10)}
            textAnchor="end"
            fontSize={10}
            fontWeight={700}
            fill={BASELINE_COLOR}
          >
            {baselineEndMarker.label}
          </text>
        </g>
        {extraEndMarker ? (
          <g>
            <circle cx={extraEndMarker.x} cy={extraEndMarker.y} r={3.5} fill={EXTRA_COLOR} />
            <text
              x={Math.min(extraEndMarker.x, WIDTH - PAD_RIGHT - 4)}
              y={Math.min(extraEndMarker.y + 20, HEIGHT - PAD_BOTTOM - 6)}
              textAnchor="end"
              fontSize={10}
              fontWeight={700}
              fill={EXTRA_COLOR}
            >
              {extraEndMarker.label}
            </text>
          </g>
        ) : null}

        {hoverIndex !== null ? (
          <g>
            <line x1={xForMonth(hoverIndex)} x2={xForMonth(hoverIndex)} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} stroke="#a89f8f" strokeWidth={1} strokeDasharray="3 3" />
            {hoverBaseline !== null ? <circle cx={xForMonth(hoverIndex)} cy={yForBalance(hoverBaseline)} r={4} fill={BASELINE_COLOR} /> : null}
            {hoverExtra !== null ? <circle cx={xForMonth(hoverIndex)} cy={yForBalance(hoverExtra)} r={4} fill={EXTRA_COLOR} /> : null}
          </g>
        ) : null}

        <rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={WIDTH - PAD_LEFT - PAD_RIGHT}
          height={HEIGHT - PAD_TOP - PAD_BOTTOM}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        />
      </svg>

      {hoverIndex !== null && hoverPoint ? (
        <div className="mt-2 rounded-xl bg-cream-dark px-4 py-3 text-xs font-semibold text-ink-soft">
          <p className="text-sm font-extrabold text-ink">
            {new Date(hoverPoint.date).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
          <div className="mt-1 space-y-0.5">
            {hoverBaseline !== null ? (
              <p style={{ color: BASELINE_COLOR }}>With normal repayments: about {formatMoney(hoverBaseline, currency)} left</p>
            ) : null}
            {hoverExtra !== null ? (
              <p style={{ color: EXTRA_COLOR }}>
                With {formatMoneyWhole(extraMonthlyAmount, currency)}/month extra: about {formatMoney(hoverExtra, currency)} left
              </p>
            ) : null}
          </div>
          <p className="mt-1.5 text-ink-faint">
            Estimated salary: {formatMoneyWhole(hoverPoint.annualSalary, currency)}/year · Approx repayments that year:{" "}
            {formatMoneyWhole(hoverPoint.statutoryRepayment * 12, currency)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
