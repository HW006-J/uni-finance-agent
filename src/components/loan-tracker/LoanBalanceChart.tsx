"use client";

import { useMemo, useState } from "react";
import type { LoanMonthPoint } from "@/lib/loans/loanSimulation";
import { formatMoney } from "@/lib/finance/format";
import type { Currency } from "@/types/finance";

const WIDTH = 760;
const HEIGHT = 340;
const PAD_LEFT = 64;
const PAD_RIGHT = 24;
const PAD_TOP = 20;
const PAD_BOTTOM = 36;

const BASELINE_COLOR = "#12784a"; // --color-brand-dark
const VOLUNTARY_COLOR = "#b6790f"; // --color-accent-dark

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
  withVoluntary,
  currency,
}: {
  baseline: LoanMonthPoint[];
  withVoluntary: LoanMonthPoint[] | null;
  currency: Currency;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const totalMonths = Math.max(baseline.length, withVoluntary?.length ?? 0, 1);
  const maxBalance = Math.max(1, ...baseline.map((m) => m.balance), ...(withVoluntary ?? []).map((m) => m.balance));
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

  const hoverDate = hoverIndex !== null ? (baseline[hoverIndex] ?? withVoluntary?.[hoverIndex])?.date : null;
  const hoverBaseline = hoverIndex !== null ? balanceAt(baseline, hoverIndex) : null;
  const hoverVoluntary = hoverIndex !== null && withVoluntary ? balanceAt(withVoluntary, hoverIndex) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: BASELINE_COLOR }} />
          Statutory repayments only
        </span>
        {withVoluntary ? (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded-full"
              style={{
                backgroundColor: VOLUNTARY_COLOR,
                backgroundImage: `repeating-linear-gradient(90deg, ${VOLUNTARY_COLOR} 0 4px, transparent 4px 7px)`,
              }}
            />
            With extra repayments
          </span>
        ) : null}
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-2 w-full" role="img" aria-label="Outstanding loan balance over time">
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
              {formatMoney(tick, currency).replace(/\.00$/, "")}
            </text>
          </g>
        ))}

        {xTicks.map((m) => {
          const point = baseline[m] ?? withVoluntary?.[m];
          const year = point ? new Date(point.date).getUTCFullYear() : null;
          return (
            <text key={m} x={xForMonth(m)} y={HEIGHT - PAD_BOTTOM + 18} textAnchor="middle" fontSize={11} fill="#736b5e" fontWeight={600}>
              {year ?? ""}
            </text>
          );
        })}

        <path d={pathFor(baseline)} fill="none" stroke={BASELINE_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {withVoluntary ? (
          <path
            d={pathFor(withVoluntary)}
            fill="none"
            stroke={VOLUNTARY_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 5"
          />
        ) : null}

        {hoverIndex !== null ? (
          <g>
            <line x1={xForMonth(hoverIndex)} x2={xForMonth(hoverIndex)} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} stroke="#a89f8f" strokeWidth={1} strokeDasharray="3 3" />
            {hoverBaseline !== null ? <circle cx={xForMonth(hoverIndex)} cy={yForBalance(hoverBaseline)} r={4} fill={BASELINE_COLOR} /> : null}
            {hoverVoluntary !== null ? <circle cx={xForMonth(hoverIndex)} cy={yForBalance(hoverVoluntary)} r={4} fill={VOLUNTARY_COLOR} /> : null}
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

      {hoverIndex !== null && hoverDate ? (
        <div className="mt-2 flex flex-wrap gap-4 rounded-xl bg-cream-dark px-4 py-2 text-xs font-semibold text-ink-soft">
          <span className="font-bold text-ink">{new Date(hoverDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>
          {hoverBaseline !== null ? (
            <span style={{ color: BASELINE_COLOR }}>Statutory only: {formatMoney(hoverBaseline, currency)}</span>
          ) : null}
          {hoverVoluntary !== null ? (
            <span style={{ color: VOLUNTARY_COLOR }}>With extra: {formatMoney(hoverVoluntary, currency)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
