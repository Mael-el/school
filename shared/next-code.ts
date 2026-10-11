/** Increments a trailing digit run, preserving prefix and zero-padding. */
export function incrementCode(
  last: string | null | undefined,
  fallback: string,
): string {
  const value = last?.trim();
  if (!value) return fallback;

  const match = value.match(/^(.*?)(\d+)$/);
  if (!match) {
    const fallbackDigits = fallback.match(/(\d+)$/)?.[1] ?? '001';
    const sep = value.endsWith('-') ? '' : '-';
    return `${value}${sep}${fallbackDigits}`;
  }

  const prefix = match[1];
  const digits = match[2];
  return `${prefix}${String(Number(digits) + 1).padStart(digits.length, '0')}`;
}

export function schoolYearPrefix(schoolYear: string): string {
  const start = schoolYear.trim().split('/')[0] ?? '';
  return /^\d{4}$/.test(start) ? start : String(new Date().getFullYear());
}

/** Suggests the next school year label (e.g. 2026/2027 → 2027/2028). */
export function suggestNextSchoolYear(schoolYear: string): string {
  const match = schoolYear.trim().match(/^(\d{4})\/(\d{4})$/);
  if (!match) return '';
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '';
  return `${start + 1}/${end + 1}`;
}
