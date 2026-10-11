// Selective wipe of operational records and optional configuration,
// used by Paramètres › Vider les données.
import fs from 'node:fs/promises';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema-types';
import {
  CLEAR_GROUPS,
  expandClearSelection,
  type ClearCounts,
  type ClearGroup,
  type ClearResult,
  type ClearSelection,
} from '../../../shared/clear-selection';
import {
  defaultSchoolYear,
  TEMPLATE_DEFAULT_SETTINGS,
} from '../../../shared/school-defaults';
import { SettingsService } from './SettingsService';

export type {
  ClearCounts,
  ClearGroup,
  ClearResult,
  ClearSelection,
} from '../../../shared/clear-selection';
export {
  CLEAR_GROUPS,
  expandClearSelection,
  selectedClearGroups,
} from '../../../shared/clear-selection';

const COUNTERS: Partial<Record<ClearGroup, string>> = {
  payments: 'payment_receipt',
  expenses: 'expense_reference',
  staffPayments: 'staff_payment_receipt',
};

const IDENTITY_KEYS = [
  'school_name',
  'school_short_name',
  'address',
  'phone',
  'email',
  'director_name',
  'receipt_message',
  'country_name',
  'print_header_line',
  'ministry_name',
  'ministry_name_en',
  'school_logo_path',
] as const;

const ADVANCED_KEYS = [
  'receipt_prefix',
  'staff_receipt_prefix',
  'expense_reference_prefix',
  'currency',
  'document_language_mode',
  'ui_language',
  'receipt_paper_format',
  'excel_export_enabled',
  'staff_salary_mode',
  'expense_approval_required',
  'expense_approver_name',
  'backup_reminder_days',
  'auto_backup_enabled',
  'auto_backup_interval_days',
  'expense_budget_limit',
  'table_page_size',
] as const;

async function countRows(
  db: Kysely<Database>,
  table:
    | 'payments'
    | 'expenses'
    | 'staff_payments'
    | 'enrollments'
    | 'students'
    | 'staff_members'
    | 'audit_log'
    | 'class_levels'
    | 'class_fees'
    | 'payment_categories'
    | 'expense_categories'
    | 'cashiers',
): Promise<number> {
  const row = await db
    .selectFrom(table)
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}

function filledCount(
  settings: Record<string, string | null>,
  keys: readonly string[],
): number {
  return keys.filter((key) => {
    const value = settings[key];
    return value !== null && value !== undefined && value !== '';
  }).length;
}

function changedAdvancedCount(
  settings: Record<string, string | null>,
): number {
  return ADVANCED_KEYS.filter((key) => {
    const current = settings[key] ?? null;
    const fallback = TEMPLATE_DEFAULT_SETTINGS[key] ?? null;
    return current !== fallback;
  }).length;
}

export class DataCleanupService {
  constructor(private readonly db: Kysely<Database>) {}

  async preview(): Promise<ClearCounts> {
    const settings = new SettingsService(this.db);
    const allSettings = await settings.getAll();
    const [
      payments,
      expenses,
      staffPayments,
      enrollments,
      students,
      staff,
      audit,
      classes,
      fees,
      paymentCategories,
      expenseCategories,
      cashiers,
    ] = await Promise.all([
      countRows(this.db, 'payments'),
      countRows(this.db, 'expenses'),
      countRows(this.db, 'staff_payments'),
      countRows(this.db, 'enrollments'),
      countRows(this.db, 'students'),
      countRows(this.db, 'staff_members'),
      countRows(this.db, 'audit_log'),
      countRows(this.db, 'class_levels'),
      countRows(this.db, 'class_fees'),
      countRows(this.db, 'payment_categories'),
      countRows(this.db, 'expense_categories'),
      countRows(this.db, 'cashiers'),
    ]);
    return {
      payments,
      expenses,
      staffPayments,
      enrollments,
      students,
      staff,
      audit,
      schoolIdentity: filledCount(allSettings, IDENTITY_KEYS),
      schoolYear: allSettings.current_school_year ? 1 : 0,
      classes,
      fees,
      paymentCategories,
      expenseCategories,
      cashiers,
      advancedOptions: changedAdvancedCount(allSettings),
    };
  }

  async clear(selection: ClearSelection): Promise<ClearResult> {
    const expanded = expandClearSelection(selection);
    if (!CLEAR_GROUPS.some((group) => expanded[group])) {
      throw new Error('Aucune donnée sélectionnée.');
    }

    const settings = new SettingsService(this.db);
    const logoPath = expanded.schoolIdentity
      ? await settings.get('school_logo_path')
      : null;

    const before = await this.preview();
    const countersReset = CLEAR_GROUPS.flatMap((group) => {
      const counter = COUNTERS[group];
      return expanded[group] && counter ? [counter] : [];
    });

    await this.db.transaction().execute(async (trx) => {
      if (expanded.payments) await trx.deleteFrom('payments').execute();
      if (expanded.expenses) await trx.deleteFrom('expenses').execute();
      if (expanded.staffPayments) {
        await trx.deleteFrom('staff_payments').execute();
      }
      if (expanded.enrollments) await trx.deleteFrom('enrollments').execute();
      if (expanded.students) await trx.deleteFrom('students').execute();
      if (expanded.staff) await trx.deleteFrom('staff_members').execute();
      if (expanded.audit) await trx.deleteFrom('audit_log').execute();

      if (expanded.paymentCategories) {
        await trx
          .updateTable('payments')
          .set({ category_id: null })
          .execute();
        await trx.deleteFrom('payment_categories').execute();
      }
      if (expanded.expenseCategories) {
        await trx
          .updateTable('expenses')
          .set({ category_id: null })
          .execute();
        await trx.deleteFrom('expense_categories').execute();
      }
      if (expanded.cashiers) {
        await trx.updateTable('payments').set({ cashier_id: null }).execute();
        await trx
          .updateTable('staff_payments')
          .set({ cashier_id: null })
          .execute();
        await trx.deleteFrom('cashiers').execute();
      }

      if (expanded.fees) await trx.deleteFrom('class_fees').execute();
      if (expanded.classes) {
        await trx
          .updateTable('staff_members')
          .set({ class_level_id: null })
          .execute();
        await trx.deleteFrom('class_name_aliases').execute();
        await trx.deleteFrom('class_level_labels').execute();
        await trx.deleteFrom('class_levels').execute();
      }

      if (countersReset.length > 0) {
        await trx
          .deleteFrom('counters')
          .where('name', 'in', countersReset)
          .execute();
      }

      const settingsTrx = new SettingsService(trx);
      if (expanded.schoolIdentity) {
        for (const key of IDENTITY_KEYS) {
          await settingsTrx.set(key, TEMPLATE_DEFAULT_SETTINGS[key] ?? null);
        }
      }
      if (expanded.schoolYear) {
        await settingsTrx.set('current_school_year', defaultSchoolYear());
      }
      if (expanded.advancedOptions) {
        for (const key of ADVANCED_KEYS) {
          await settingsTrx.set(key, TEMPLATE_DEFAULT_SETTINGS[key] ?? null);
        }
      }
    });

    if (logoPath) {
      try {
        await fs.unlink(logoPath);
      } catch {
        // The setting is already cleared; a missing file is fine.
      }
    }

    const after = await this.preview();
    const deleted = { ...before } as ClearResult;
    for (const group of CLEAR_GROUPS) {
      deleted[group] = Math.max(0, before[group] - after[group]);
    }
    deleted.countersReset = countersReset;
    return deleted;
  }
}
