import { describe, expect, it } from 'vitest';
import {
  formatDateFr,
  formatMonthFr,
  parseIsoDate,
  toIsoDate,
  toIsoMonth,
} from './dates';

describe('dates', () => {
  it('formats ISO dates in French', () => {
    expect(formatDateFr('2026-09-10')).toBe('10 septembre 2026');
    expect(formatMonthFr('2026-09')).toBe('septembre 2026');
  });

  it('round-trips ISO date strings', () => {
    const date = parseIsoDate('2026-09-10');
    expect(date).toBeDefined();
    if (!date) return;
    expect(toIsoDate(date)).toBe('2026-09-10');
    expect(toIsoMonth(date)).toBe('2026-09');
  });
});
