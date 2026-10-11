import { describe, expect, it } from 'vitest';
import {
  amountInWordsEn,
  amountInWordsFr,
  numberToEnglishWords,
  numberToFrenchWords,
} from './amount-words';

describe('numberToFrenchWords', () => {
  it('spells simple numbers', () => {
    expect(numberToFrenchWords(0)).toBe('zéro');
    expect(numberToFrenchWords(16)).toBe('seize');
    expect(numberToFrenchWords(17)).toBe('dix-sept');
    expect(numberToFrenchWords(21)).toBe('vingt et un');
    expect(numberToFrenchWords(34)).toBe('trente-quatre');
  });

  it('handles the 70/80/90 irregularities', () => {
    expect(numberToFrenchWords(70)).toBe('soixante-dix');
    expect(numberToFrenchWords(71)).toBe('soixante et onze');
    expect(numberToFrenchWords(76)).toBe('soixante-seize');
    expect(numberToFrenchWords(80)).toBe('quatre-vingts');
    expect(numberToFrenchWords(81)).toBe('quatre-vingt-un');
    expect(numberToFrenchWords(91)).toBe('quatre-vingt-onze');
    expect(numberToFrenchWords(99)).toBe('quatre-vingt-dix-neuf');
  });

  it('handles hundreds with plural rules', () => {
    expect(numberToFrenchWords(100)).toBe('cent');
    expect(numberToFrenchWords(101)).toBe('cent un');
    expect(numberToFrenchWords(200)).toBe('deux cents');
    expect(numberToFrenchWords(250)).toBe('deux cent cinquante');
  });

  it('handles thousands, millions and billions', () => {
    expect(numberToFrenchWords(1000)).toBe('mille');
    expect(numberToFrenchWords(1500)).toBe('mille cinq cents');
    expect(numberToFrenchWords(40_000)).toBe('quarante mille');
    expect(numberToFrenchWords(125_500)).toBe('cent vingt-cinq mille cinq cents');
    expect(numberToFrenchWords(1_000_000)).toBe('un million');
    expect(numberToFrenchWords(2_300_000)).toBe(
      'deux millions trois cent mille',
    );
    expect(numberToFrenchWords(80_000)).toBe('quatre-vingt mille');
    expect(numberToFrenchWords(200_000_000)).toBe('deux cents millions');
    expect(numberToFrenchWords(1_000_000_000)).toBe('un milliard');
  });
});

describe('numberToEnglishWords', () => {
  it('spells representative amounts', () => {
    expect(numberToEnglishWords(0)).toBe('zero');
    expect(numberToEnglishWords(21)).toBe('twenty-one');
    expect(numberToEnglishWords(105)).toBe('one hundred five');
    expect(numberToEnglishWords(40_000)).toBe('forty thousand');
    expect(numberToEnglishWords(2_300_000)).toBe(
      'two million three hundred thousand',
    );
  });
});

describe('amountInWords currency phrases', () => {
  it('appends the currency, with « de » after exact millions', () => {
    expect(amountInWordsFr(40_000)).toBe('quarante mille francs CFA');
    expect(amountInWordsFr(2_000_000)).toBe('deux millions de francs CFA');
    expect(amountInWordsFr(2_000_500)).toBe(
      'deux millions cinq cents francs CFA',
    );
    expect(amountInWordsEn(40_000)).toBe('forty thousand CFA francs');
  });
});
