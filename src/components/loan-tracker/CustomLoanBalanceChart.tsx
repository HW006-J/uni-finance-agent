"use client";

import { useMemo, useState } from "react";
import type { CustomLoanMonthPoint } from "@/lib/loans/customLoanSimulation";
import { formatMoney, formatMoneyCompact } from "@/lib/finance/format";

const WIDTH = 760;
const HEIGHT = 340;
const PAD_LEFT = 56;
const PAD_RIGHT = 24;
const PAD_TOP = 36;
const PAD_BOTTOM = 36;

const BALANCE_COLOR = "#12784a"; // --color-brand-dark, matching the Student Loan chart

function niceStep(maxValue: number): number {
  if (maxValue <= 0) return 1;
  const rough = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  return step * magnitude;
}

/** Reuses the Student Loan chart's design language (axes, gridlines, hover tooltip) for the Custom Loan's single-series balance-over-time line. */
export function CustomLoanBalanceChart({
  months,
  startingBalance,
  reachedMaxHorizon,
}: {
  months: CustomLoanMonthPoint[];
  startingBalance: number;
  reachedMaxHorizon: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Prepend month 0 (the starting balance) so the line always starts from "today".
  const series = useMemo(() => [{ balance: startingBalance }, ...months], [months, startingBalance]);
  const totalMonths = series.length;
  const maxBalance = Math.max(1, startingBalance, ...months.map((m) => m.balance));
  const yStep = niceStep(maxBalance);
  const yMax = Math.ceil(maxBalance / yStep) * yStep;

  const xForMonth = (m: number) => PAD_LEFT + (m / (totalMonths - 1 || 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const yForBalance = (b: number) => PAD_TOP + (1 - b / yMax) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  const pathD = series.map((point, i) => `${i === 0 ? "M" : "L"}${xForMonth(i).toFixed(2)},${yForBalance(point.balance).toFixed(2)}`).join(" ");

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = 0; v <= yMax; v += yStep) ticks.push(v);
    return ticks;
  }, [yMax, yStep]);

  const yearStepMonths = totalMonths > 240 ? 60 : totalMonths > 120 ? 24 : totalMonths > 48 ? 12 : totalMonths > 24 ? 6 : 3;
  const xTicks: number[] = [];
  for (let m = 0; m < totalMonths; m += yearStepMonths) xTicks.push(m);

  function formatXTickLabel(monthIndex: number): string {
    const years = Math.floor(monthIndex / 12);
    const rem = monthIndex % 12;
    if (years === 0) return `${monthIndex}mo`;
    if (rem === 0) return `${years}y`;
    return `${years}y ${rem}mo`;
  }

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.min(1, Math.max(0, (x * (WIDTH / rect.width) - PAD_LEFT) / (WIDTH - PAD_LEFT - PAD_RIGHT)));
    const monthIndex = Math.round(fraction * (totalMonths - 1));
    setHoverIndex(monthIndex);
  }

  const hoverBalance = hoverIndex !== null ? (series[hoverIndex]?.balance ?? 0) : null;

  const endIndex = totalMonths - 1;
  const endBalance = series[endIndex].balance;
  const endMarker = {
    x: xForMonth(endIndex),
    y: yForBalance(endBalance),
    label: endBalance <= 0 ? "Loan cleared" : reachedMaxHorizon ? "Still owing after 50 years" : "",
  };

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-2 w-full" role="img" aria-label="How your custom loan balance changes over time">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yForBalance(tick)} y2={yForBalance(tick)} stroke="#eae2d2" strokeWidth={1} />
            <text x={PAD_LEFT - 8} y={yForBalance(tick) + 4} textAnchor="end" fontSize={11} fill="#736b5e" fontWeight={600}>
              {formatMoneyCompact(tick)}
            </text>
          </g>
        ))}

        {xTicks.map((m) => (
          <text key={m} x={xForMonth(m)} y={HEIGHT - PAD_BOTTOM + 18} textAnchor="middle" fontSize={11} fill="#736b5e" fontWeight={600}>
            {formatXTickLabel(m)}
          </text>
        ))}

        <path d={pathD} fill="none" stroke={BALANCE_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        <g>
          <circle cx={endMarker.x} cy={endMarker.y} r={3.5} fill={BALANCE_COLOR} />
          {endMarker.label ? (
            <text
              x={Math.min(endMarker.x, WIDTH - PAD_RIGHT - 4)}
              y={Math.max(endMarker.y - 10, PAD_TOP + 10)}
              textAnchor="end"
              fontSize={10}
              fontWeight={700}
              fill={BALANCE_COLOR}
            >
              {endMarker.label}
            </text>
          ) : null}
        </g>

        {hoverIndex !== null ? (
          <g>
            <line x1={xForMonth(hoverIndex)} x2={xForMonth(hoverIndex)} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} stroke="#a89f8f" strokeWidth={1} strokeDasharray="3 3" />
            {hoverBalance !== null ? <circle cx={xForMonth(hoverIndex)} cy={yForBalance(hoverBalance)} r={4} fill={BALANCE_COLOR} /> : null}
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

      {hoverIndex !== null && hoverBalance !== null ? (
        <div className="mt-2 rounded-xl bg-cream-dark px-4 py-3 text-xs font-semibold text-ink-soft">
          <p className="text-sm font-extrabold text-ink">{formatXTickLabel(hoverIndex)} in</p>
          <p style={{ color: BALANCE_COLOR }}>About {formatMoney(hoverBalance)} left</p>
        </div>
      ) : null}
    </div>
  );
}
