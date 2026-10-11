import { describe, expect, it } from 'vitest';
import { pdfFileName, slugFilePart } from './print-file-name';

describe('slugFilePart', () => {
  it('strips accents and punctuation', () => {
    expect(slugFilePart('Jean Dupont')).toBe('Jean-Dupont');
    expect(slugFilePart("N° REC-001 / élève")).toBe('N-REC-001-eleve');
  });
});

describe('pdfFileName', () => {
  it('joins document type and person', () => {
    expect(pdfFileName('Recu-paiement', 'Jean Dupont', '2026-08-22')).toBe(
      'Recu-paiement_Jean-Dupont_2026-08-22.pdf',
    );
  });

  it('skips empty parts', () => {
    expect(pdfFileName('Rapport-financier', null, '2026-01')).toBe(
      'Rapport-financier_2026-01.pdf',
    );
  });
});
