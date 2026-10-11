import { describe, expect, it } from 'vitest';
import { labelForSection, levelsForSection } from './class-levels';
import type { ClassLevelStructured } from './types';

const sampleLevel: ClassLevelStructured = {
  id: 1,
  code: 'PS',
  name: 'Petite Section',
  display_order: 1,
  labels: [
    { section: 'Francophone', name: 'Petite Section' },
    { section: 'Anglophone', name: 'Pre-Nursery' },
  ],
};

describe('class-levels', () => {
  it('returns section-specific label', () => {
    expect(labelForSection(sampleLevel, 'Anglophone')).toBe('Pre-Nursery');
    expect(labelForSection(sampleLevel, 'Francophone')).toBe('Petite Section');
  });

  it('filters levels by section', () => {
    const frOnly: ClassLevelStructured = {
      id: 2,
      code: 'SIL',
      name: 'SIL',
      display_order: 9,
      labels: [{ section: 'Francophone', name: 'SIL' }],
    };
    expect(levelsForSection([sampleLevel, frOnly], 'Anglophone')).toHaveLength(
      1,
    );
    expect(levelsForSection([sampleLevel, frOnly], 'Francophone')).toHaveLength(
      2,
    );
  });
});
