import { describe, expect, it } from 'vitest';
import { PrintLabels, paperFormatFromSetting } from './print-labels';

describe('PrintLabels', () => {
  it('renders bilingual field labels by default', () => {
    const labels = PrintLabels.fromSetting('bilingual_fr_en');
    expect(labels.field('Élève', 'Student')).toContain('Élève');
    expect(labels.field('Élève', 'Student')).toContain('Student');
  });

  it('renders French-only labels when document_language_mode is fr_only', () => {
    const labels = PrintLabels.fromSetting('fr_only');
    const html = labels.field('Élève', 'Student');
    expect(html).toContain('Élève');
    expect(html).not.toContain('Student');
  });

  it('renders English-only labels when document_language_mode is en_only', () => {
    const labels = PrintLabels.fromSetting('en_only');
    const html = labels.field('Élève', 'Student');
    expect(html).toContain('Student');
    expect(html).not.toContain('Élève');
  });

  it('falls back to bilingual for unknown mode', () => {
    const labels = PrintLabels.fromSetting('unknown');
    expect(labels.mode).toBe('bilingual_fr_en');
  });

  it('renders the official Basic Education letterhead', () => {
    const labels = PrintLabels.fromSetting('bilingual_fr_en');
    const html = labels.officialLetterhead(
      'Complexe Scolaire Émergence',
      'Reçu de paiement',
      'Payment Receipt',
    );
    expect(html).toContain('REPUBLIQUE DU CAMEROUN');
    expect(html).toContain('REPUBLIC OF CAMEROON');
    expect(html).toContain("MINISTERE DE L'EDUCATION DE BASE");
    expect(html).toContain('MINISTRY OF BASIC EDUCATION');
    expect(html).toContain('COMPLEXE SCOLAIRE');
    expect(html).toContain('PAYMENT RECEIPT');
  });
});

describe('paperFormatFromSetting', () => {
  it('maps ticket and A4 settings', () => {
    expect(paperFormatFromSetting('ticket')).toBe('ticket');
    expect(paperFormatFromSetting('A4')).toBe('A4');
    expect(paperFormatFromSetting(null)).toBe('A4');
  });
});

describe('pdfOptionsForPaperFormat', () => {
  it('uses custom width for ticket format', async () => {
    const { pdfOptionsForPaperFormat } = await import('./PrintService');
    const ticket = pdfOptionsForPaperFormat('ticket');
    expect(ticket.pageSize).toEqual({ width: 80000, height: 297000 });
    expect(pdfOptionsForPaperFormat('A4').pageSize).toBe('A4');
  });
});
