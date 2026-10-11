/** Product slug — must match `productName` in package.json (Electron userData path). */
export const PRODUCT_SLUG = 'complex-scolaire';

/** Generic application title (not school-specific). */
export const APP_DISPLAY_NAME = 'Suivi Frais Scolaires';

/** Default window / document title before school name is loaded. */
export const APP_WINDOW_TITLE = APP_DISPLAY_NAME;

/** Computes a sensible default school year (Northern hemisphere, Sept start). */
export function defaultSchoolYear(reference = new Date()): string {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}

/**
 * Settings applied on first database creation — no school-specific branding.
 * Schools customize these under Paramètres or via `npm run seed:profile`.
 */
export const TEMPLATE_DEFAULT_SETTINGS: Record<string, string | null> = {
  school_name: 'Mon établissement scolaire',
  school_short_name: APP_DISPLAY_NAME,
  address: null,
  phone: null,
  email: null,
  director_name: null,
  receipt_prefix: 'REC',
  staff_receipt_prefix: 'SAL',
  expense_reference_prefix: 'DEP',
  receipt_message: 'Merci pour votre confiance.',
  currency: 'FCFA',
  current_school_year: defaultSchoolYear(),
  document_language_mode: 'bilingual_fr_en',
  ui_language: 'fr',
  receipt_paper_format: 'A4',
  excel_export_enabled: '1',
  staff_salary_mode: 'fixe',
  expense_approval_required: '0',
  expense_approver_name: null,
  backup_reminder_days: '7',
  auto_backup_enabled: '0',
  auto_backup_interval_days: '1',
  expense_budget_limit: null,
  table_page_size: '50',
  ministry_name: "Ministère de l'Éducation de Base",
  ministry_name_en: 'Ministry of Basic Education',
  country_name: 'République du Cameroun',
  print_header_line: 'République du Cameroun — Paix • Travail • Patrie',
};

export const TEMPLATE_PAYMENT_CATEGORIES = ['Scolarité', 'Inscription'] as const;

export const TEMPLATE_CASHIERS = ['Caissier principal'] as const;
