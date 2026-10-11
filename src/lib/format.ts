import { currentLocaleTag } from '../i18n';
import {
  DEFAULT_CURRENCY,
  formatCurrency as formatCurrencyShared,
  formatGroupedNumber,
  resolveCurrency,
} from '../../shared/currency';

export {
  DEFAULT_CURRENCY,
  formatCurrency,
  formatGroupedNumber,
  resolveCurrency,
} from '../../shared/currency';

let activeCurrency = DEFAULT_CURRENCY;

/** Keep UI amounts in sync with Paramètres › Devise. */
export function setActiveCurrency(currency?: string | null): void {
  activeCurrency = resolveCurrency(currency);
}

export function getActiveCurrency(): string {
  return activeCurrency;
}

function displayLocale(locale?: string): string {
  return locale || currentLocaleTag();
}

/** Locale-aware number formatting. */
export function fmtNumber(n: number, locale?: string): string {
  return formatGroupedNumber(n, displayLocale(locale));
}

/** Currency display using the school setting, unless a code is passed. */
export function fmtCurrency(
  n: number,
  currency?: string,
  locale?: string,
): string {
  return formatCurrencyShared(
    n,
    currency ?? activeCurrency,
    displayLocale(locale),
  );
}
