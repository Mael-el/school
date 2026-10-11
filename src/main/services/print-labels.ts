export type DocumentLanguageMode = 'fr_only' | 'en_only' | 'bilingual_fr_en';

export type ReceiptPaperFormat = 'A4' | 'ticket';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Builds FR-only, EN-only, or bilingual label HTML for printed documents. */
export class PrintLabels {
  constructor(readonly mode: DocumentLanguageMode) {}

  static fromSetting(raw: string | null | undefined): PrintLabels {
    if (raw === 'fr_only' || raw === 'en_only' || raw === 'bilingual_fr_en') {
      return new PrintLabels(raw);
    }
    return new PrintLabels('bilingual_fr_en');
  }

  /** Field label with optional secondary language (info-grid cells). */
  field(fr: string, en: string): string {
    if (this.mode === 'fr_only') {
      return `<span class="fr">${escapeHtml(fr)}</span>`;
    }
    if (this.mode === 'en_only') {
      return `<span class="en">${escapeHtml(en)}</span>`;
    }
    return `<span class="fr">${escapeHtml(fr)}</span> <span class="en">/ ${escapeHtml(en)}</span>`;
  }

  /** Document title block (header right column). */
  docTitle(fr: string, en: string): string {
    if (this.mode === 'fr_only') {
      return `<div class="fr">${escapeHtml(fr)}</div>`;
    }
    if (this.mode === 'en_only') {
      return `<div class="en">${escapeHtml(en)}</div>`;
    }
    return `<div class="fr">${escapeHtml(fr)}</div><div class="en">${escapeHtml(en)}</div>`;
  }

  /** Inline table row label (totals rows). */
  row(fr: string, en: string): string {
    if (this.mode === 'fr_only') return escapeHtml(fr);
    if (this.mode === 'en_only') return escapeHtml(en);
    return `${escapeHtml(fr)} / ${escapeHtml(en)}`;
  }

  /** Table header cell. */
  th(fr: string, en: string): string {
    return this.row(fr, en);
  }

  /** Section heading (h2). */
  section(fr: string, en: string): string {
    return this.row(fr, en);
  }

  officialLetterhead(schoolName: string, titleFr: string, titleEn: string): string {
    const school = escapeHtml(schoolName.toUpperCase());
    const frTitle = escapeHtml(titleFr.toUpperCase());
    const enTitle = escapeHtml(titleEn.toUpperCase());
    const stars = '<p class="official-stars">**********</p>';
    const frCol = `
      <div class="official-col">
        <p class="official-country">REPUBLIQUE DU CAMEROUN</p>
        <p class="official-motto">Paix-Travail-Patrie</p>
        ${stars}
        <p class="official-ministry">MINISTERE DE L'EDUCATION DE BASE</p>
        ${stars}
        <p class="official-school">${school}</p>
        ${stars}
        <p class="official-doc">${frTitle}</p>
        ${stars}
      </div>`;
    const enCol = `
      <div class="official-col">
        <p class="official-country">REPUBLIC OF CAMEROON</p>
        <p class="official-motto">Peace-Work-Fatherland</p>
        ${stars}
        <p class="official-ministry">MINISTRY OF BASIC EDUCATION</p>
        ${stars}
        <p class="official-school">${school}</p>
        ${stars}
        <p class="official-doc">${enTitle}</p>
        ${stars}
      </div>`;

    if (this.mode === 'fr_only') {
      return `<div class="official-header official-header--single">${frCol}</div>`;
    }
    if (this.mode === 'en_only') {
      return `<div class="official-header official-header--single">${enCol}</div>`;
    }
    return `<div class="official-header">${frCol}${enCol}</div>`;
  }

  /** Official government/ministry letterhead line (bold, stacked fr/en). */
  government(fr: string, en: string): string {
    if (this.mode === 'fr_only') {
      return `<p class="gov-line">${escapeHtml(fr)}</p>`;
    }
    if (this.mode === 'en_only') {
      return `<p class="gov-line">${escapeHtml(en)}</p>`;
    }
    return `<p class="gov-line">${escapeHtml(fr)}</p><p class="gov-line gov-line--en">${escapeHtml(en)}</p>`;
  }

  /** National motto line (italic, stacked fr/en). */
  motto(fr: string, en: string): string {
    if (this.mode === 'fr_only') {
      return `<p class="gov-motto">${escapeHtml(fr)}</p>`;
    }
    if (this.mode === 'en_only') {
      return `<p class="gov-motto">${escapeHtml(en)}</p>`;
    }
    return `<p class="gov-motto">${escapeHtml(fr)}</p><p class="gov-motto gov-motto--en">${escapeHtml(en)}</p>`;
  }

  /** Signature line fallback when no director name is set. */
  directorFallback(): string {
    if (this.mode === 'fr_only') return 'Direction';
    if (this.mode === 'en_only') return 'Director';
    return 'Direction / Director';
  }

  /** Footer signature role label. */
  signature(roleFr: string, roleEn: string): string {
    return this.row(roleFr, roleEn);
  }

  emptyPayments(): string {
    if (this.mode === 'fr_only') return 'Aucun paiement enregistré';
    if (this.mode === 'en_only') return 'No payments recorded';
    return 'Aucun paiement enregistré / No payments recorded';
  }

  emptyExpenses(): string {
    if (this.mode === 'fr_only') return 'Aucune dépense enregistrée';
    if (this.mode === 'en_only') return 'No expenses recorded';
    return 'Aucune dépense enregistrée / No expenses recorded';
  }

  emptyData(): string {
    if (this.mode === 'fr_only') return 'Aucune donnée pour cette période';
    if (this.mode === 'en_only') return 'No data for this period';
    return 'Aucune donnée pour cette période / No data for this period';
  }

  uncategorized(): string {
    if (this.mode === 'fr_only') return 'Sans catégorie';
    if (this.mode === 'en_only') return 'Uncategorized';
    return 'Sans catégorie';
  }
}

export function paperFormatFromSetting(
  raw: string | null | undefined,
): ReceiptPaperFormat {
  return raw === 'ticket' ? 'ticket' : 'A4';
}
