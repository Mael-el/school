/** Default currency code (Cameroon / CEMAC). Integer amounts, no cents. */
export const DEFAULT_CURRENCY = 'FCFA';

export const DEFAULT_CURRENCY_LOCALE = 'fr-FR';

export function resolveCurrency(currency?: string | null): string {
  const trimmed = currency?.trim();
  return trimmed || DEFAULT_CURRENCY;
}

export function resolveCurrencyLocale(locale?: string | null): string {
  const trimmed = locale?.trim();
  return trimmed || DEFAULT_CURRENCY_LOCALE;
}

/** Grouped integer display (40 000 / 40,000). Non-finite values become 0. */
export function formatGroupedNumber(
  amount: number,
  locale: string = DEFAULT_CURRENCY_LOCALE,
): string {
  const numeric = Number(amount);
  const value = Number.isFinite(numeric) ? numeric : 0;
  const formatted = new Intl.NumberFormat(resolveCurrencyLocale(locale), {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.round(value));
  // fr-FR uses a thin space (U+202F) that disappears under tight letter-spacing
  // on dashboard tiles — normalize to a regular space so grouping stays visible.
  return formatted.replace(/[\u00A0\u202F\u2009]/g, ' ');
}

/** `40 000 FCFA` — shared by the UI and printed receipts. */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_CURRENCY_LOCALE,
): string {
  return `${formatGroupedNumber(amount, locale)} ${resolveCurrency(currency)}`;
}
