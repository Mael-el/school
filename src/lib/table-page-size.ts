export const DEFAULT_TABLE_PAGE_SIZE = 50;

export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;

export function parseTablePageSize(
  value: string | number | null | undefined,
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TABLE_PAGE_SIZE;
  return Math.min(500, Math.floor(n));
}

export function pageSizeSelectOptions(current: number): number[] {
  if (
    (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(current)
  ) {
    return [...TABLE_PAGE_SIZE_OPTIONS];
  }
  return [...TABLE_PAGE_SIZE_OPTIONS, current].sort((a, b) => a - b);
}
