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
