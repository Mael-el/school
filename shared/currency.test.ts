import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  formatGroupedNumber,
  resolveCurrency,
} from './currency';

describe('resolveCurrency', () => {
  it('falls back to FCFA when empty', () => {
    expect(resolveCurrency(null)).toBe(DEFAULT_CURRENCY);
    expect(resolveCurrency('')).toBe(DEFAULT_CURRENCY);
    expect(resolveCurrency('  ')).toBe(DEFAULT_CURRENCY);
  });

  it('keeps a custom code', () => {
    expect(resolveCurrency('XAF')).toBe('XAF');
  });
});

describe('formatGroupedNumber', () => {
  it('groups with a French locale using a visible space', () => {
    expect(formatGroupedNumber(40_000, 'fr-FR')).toBe('40 000');
  });

  it('groups with an English locale', () => {
    expect(formatGroupedNumber(40_000, 'en-GB')).toBe('40,000');
  });

  it('rounds and treats non-finite values as zero', () => {
    expect(formatGroupedNumber(10.6, 'en-GB')).toBe('11');
    expect(formatGroupedNumber(Number.NaN, 'en-GB')).toBe('0');
  });
});

describe('formatCurrency', () => {
  it('appends the currency code', () => {
    expect(formatCurrency(1500, 'FCFA', 'en-GB')).toBe('1,500 FCFA');
    expect(formatCurrency(0, 'XAF', 'en-GB')).toBe('0 XAF');
  });

  it('uses FCFA when the code is missing', () => {
    expect(formatCurrency(10, '', 'en-GB')).toBe('10 FCFA');
  });
});
