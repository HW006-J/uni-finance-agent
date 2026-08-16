import type { Currency } from "@/types/finance";

const LOCALE_BY_CURRENCY: Record<Currency, string> = {
  GBP: "en-GB",
  USD: "en-US",
  EUR: "en-IE",
};

export function formatMoney(amount: number, currency: Currency = "GBP"): string {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Whole-pounds formatting with no decimals, e.g. for headline stats where pence add noise. */
export function formatMoneyWhole(amount: number, currency: Currency = "GBP"): string {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

/**
 * Compact axis-label formatting for charts, e.g. `£10k` instead of `£10,000.00`.
 * Only used for chart tick labels - real money amounts elsewhere always use
 * `formatMoney`/`formatMoneyWhole` so figures a student might act on are never truncated.
 */
export function formatMoneyCompact(amount: number, currency: Currency = "GBP"): string {
  const symbol = CURRENCY_SYMBOL[currency];
  if (amount === 0) return `${symbol}0`;
  if (Math.abs(amount) >= 1000) {
    const thousands = amount / 1000;
    const rounded = Number.isInteger(thousands) ? thousands : Math.round(thousands * 10) / 10;
    return `${symbol}${rounded}k`;
  }
  return `${symbol}${Math.round(amount)}`;
}

/**
 * A live "£45,000"-style preview for a raw numeric input string, or null if
 * the input isn't a valid non-negative number yet. Purely presentational -
 * never used as the value actually submitted/stored.
 */
export function formatMoneyInputPreview(raw: string, currency: Currency = "GBP"): string | null {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return formatMoneyWhole(value, currency);
}

/** Threshold above which an entered amount is unusual enough to double-check with the student, non-blockingly. */
export const LARGE_AMOUNT_CHECK_THRESHOLD = 150_000;

/**
 * A non-blocking "just checking" message for amounts that are unusually
 * large for a student loan balance or similar figure, or null if the amount
 * doesn't warrant a check. Never prevents the value from being used.
 */
export function getLargeAmountNotice(amount: number, currency: Currency = "GBP"): string | null {
  if (!Number.isFinite(amount) || amount < LARGE_AMOUNT_CHECK_THRESHOLD) return null;
  return `That's ${formatMoneyWhole(amount, currency)} — just checking that's the amount you intended.`;
}
