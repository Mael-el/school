import { describe, expect, it } from 'vitest';
import { incrementCode, schoolYearPrefix, suggestNextSchoolYear } from '../../shared/next-code';

describe('incrementCode', () => {
  it('returns the fallback when there is no previous value', () => {
    expect(incrementCode(null, 'ELV-001')).toBe('ELV-001');
    expect(incrementCode('   ', 'PER-001')).toBe('PER-001');
  });

  it('increments the last numeric run and keeps padding', () => {
    expect(incrementCode('EMG-26054', 'ELV-001')).toBe('EMG-26055');
    expect(incrementCode('DIR-001', 'PER-001')).toBe('DIR-002');
    expect(incrementCode('INS-2026-054', 'INS-2026-001')).toBe('INS-2026-055');
  });

  it('appends a numeric suffix when the last value has none', () => {
    expect(incrementCode('EMG', 'ELV-001')).toBe('EMG-001');
    expect(incrementCode('EMG-', 'ELV-001')).toBe('EMG-001');
  });
});

describe('schoolYearPrefix', () => {
  it('uses the start year of a school-year label', () => {
    expect(schoolYearPrefix('2026/2027')).toBe('2026');
  });
});

describe('suggestNextSchoolYear', () => {
  it('advances a standard school-year label by one year', () => {
    expect(suggestNextSchoolYear('2026/2027')).toBe('2027/2028');
    expect(suggestNextSchoolYear(' 2025/2026 ')).toBe('2026/2027');
  });

  it('returns empty for invalid labels', () => {
    expect(suggestNextSchoolYear('')).toBe('');
    expect(suggestNextSchoolYear('2026')).toBe('');
  });
});
