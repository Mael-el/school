import { format, isValid, parse, parseISO } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import i18n, { localeTag, normalizeUiLanguage } from '../i18n';

/** Storage format — matches SQLite TEXT columns (ISO 8601 date). */
export const ISO_DATE = 'yyyy-MM-dd';
/** Storage format for pay periods / month filters. */
export const ISO_MONTH = 'yyyy-MM';

export const DISPLAY_DATE_LONG = 'd MMMM yyyy';
export const DISPLAY_DATE_SHORT = 'dd/MM/yyyy';
export const DISPLAY_MONTH = 'MMMM yyyy';

export function getDateFnsLocale() {
  return normalizeUiLanguage(i18n.language) === 'en' ? enGB : fr;
}

export function todayIsoDate(): string {
  return format(new Date(), ISO_DATE);
}

export function todayIsoMonth(): string {
  return format(new Date(), ISO_MONTH);
}

export function parseIsoDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

export function parseIsoMonth(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, ISO_MONTH, new Date());
  return isValid(parsed) ? parsed : undefined;
}

export function toIsoDate(date: Date): string {
  return format(date, ISO_DATE);
}

export function toIsoMonth(date: Date): string {
  return format(date, ISO_MONTH);
}

/** Human-readable date in the active UI locale. */
export function formatDisplayDate(
  value: string | Date | null | undefined,
  pattern: string = DISPLAY_DATE_LONG,
): string {
  if (!value) return '';
  const date =
    typeof value === 'string' ? parseIsoDate(value) : isValid(value) ? value : undefined;
  if (!date) return typeof value === 'string' ? value : '';
  return format(date, pattern, { locale: getDateFnsLocale() });
}

/** @deprecated Use formatDisplayDate */
export const formatDateFr = formatDisplayDate;

/** Human-readable month in the active UI locale. */
export function formatDisplayMonth(value: string | null | undefined): string {
  if (!value) return '';
  const date = parseIsoMonth(value);
  if (!date) return value;
  return format(date, DISPLAY_MONTH, { locale: getDateFnsLocale() });
}

/** @deprecated Use formatDisplayMonth */
export const formatMonthFr = formatDisplayMonth;

/** Month labels for pickers (index 0 = January). */
export function getMonthLabels(): string[] {
  return Array.from({ length: 12 }, (_, index) =>
    format(new Date(2020, index, 1), 'MMMM', { locale: getDateFnsLocale() }),
  );
}

/** @deprecated Use getMonthLabels */
export const FRENCH_MONTHS = getMonthLabels();

/** Month abbreviations for charts. */
export function getMonthAbbreviations(): string[] {
  const abbr = i18n.t('months.abbr', { returnObjects: true });
  if (Array.isArray(abbr) && abbr.length === 12) {
    return abbr as string[];
  }
  return Array.from({ length: 12 }, (_, index) =>
    format(new Date(2020, index, 1), 'MMM', { locale: getDateFnsLocale() }),
  );
}

export function syncDocumentLanguage(): void {
  document.documentElement.lang = localeTag(normalizeUiLanguage(i18n.language));
}
