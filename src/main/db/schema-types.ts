// Kysely typed schema — mirrors the SQL schema in docs/electron-app-plan.md
// (section 4). One interface per table; `Generated<T>` marks
// autoincrement/default columns that are optional on insert.
import type { Generated, ColumnType } from 'kysely';

type Timestamp = ColumnType<string, string | undefined, string>;

export interface SettingsTable {
  key: string;
  value: string | null;
}

export interface CashiersTable {
  id: Generated<number>;
  name: string;
}

export interface ClassLevelsTable {
  id: Generated<number>;
  code: string | null;
  name: string;
  display_order: number;
}

export interface ClassLevelLabelsTable {
  id: Generated<number>;
  class_level_id: number;
  section: 'Francophone' | 'Anglophone';
  name: string;
}

export interface ClassNameAliasesTable {
  id: Generated<number>;
  alias: string;
  class_level_id: number;
  section: 'Francophone' | 'Anglophone';
}

export interface ClassFeesTable {
  id: Generated<number>;
  class_level_id: number;
  school_year: string;
  section: 'Francophone' | 'Anglophone';
  annual_fee: number;
}

export interface PaymentCategoriesTable {
  id: Generated<number>;
  name: string;
  description: string | null;
}

export interface StudentsTable {
  id: Generated<number>;
  matricule: string;
  full_name: string;
  gender: 'Garçon' | 'Fille' | null;
  birth_date: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  neighborhood: string | null;
  status: 'Actif' | 'Archivé';
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface EnrollmentsTable {
  id: Generated<number>;
  student_id: number;
  registration_no: string | null;
  school_year: string;
  class_level_id: number;
  section: 'Francophone' | 'Anglophone' | null;
  expected_fee: number;
  registration_date: string | null;
  status: 'Actif' | 'Transféré' | 'Retiré';
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CountersTable {
  name: string;
  last_value: number;
}

export interface PaymentsTable {
  id: Generated<number>;
  receipt_no: string;
  enrollment_id: number;
  payment_date: string;
  category_id: number | null;
  term: '1er trimestre' | '2e trimestre' | '3e trimestre' | null;
  installment_no: number | null;
  amount: number;
  payment_mode: string;
  transaction_ref: string | null;
  cashier_id: number | null;
  note: string | null;
  status: 'Validé' | 'Annulé';
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: Timestamp;
}

export interface ExpenseCategoriesTable {
  id: Generated<number>;
  name: string;
  description: string | null;
}

export interface ExpensesTable {
  id: Generated<number>;
  reference_no: string;
  expense_date: string;
  category_id: number | null;
  description: string;
  amount: number;
  payment_mode: string;
  supplier_name: string | null;
  receipt_ref: string | null;
  approved_by: string | null;
  note: string | null;
  status: 'Validé' | 'Annulé';
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: Timestamp;
}

export interface StaffMembersTable {
  id: Generated<number>;
  staff_no: string;
  full_name: string;
  role: string;
  class_level_id: number | null;
  phone: string | null;
  hire_date: string | null;
  monthly_salary: number;
  status: 'Actif' | 'Suspendu' | 'Sorti';
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface StaffPaymentsTable {
  id: Generated<number>;
  receipt_no: string;
  staff_id: number;
  payment_date: string;
  pay_period: string;
  amount: number;
  payment_type: 'Salaire' | 'Avance' | 'Prime' | 'Autre';
  payment_mode: string;
  transaction_ref: string | null;
  cashier_id: number | null;
  note: string | null;
  status: 'Validé' | 'Annulé';
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: Timestamp;
}

export interface AuditLogTable {
  id: Generated<number>;
  action: string;
  entity: string;
  entity_id: number;
  before_json: string | null;
  after_json: string | null;
  note: string | null;
  created_at: Timestamp;
}

export interface EnrollmentBalancesView {
  enrollment_id: number;
  student_id: number;
  matricule: string;
  full_name: string;
  school_year: string;
  class_level_id: number;
  section: 'Francophone' | 'Anglophone' | null;
  registration_no: string | null;
  class_name: string;
  enrollment_status?: 'Actif' | 'Transféré' | 'Retiré';
  student_status?: 'Actif' | 'Archivé';
  expected_fee: number;
  total_paid: number;
  balance: number;
  status: 'Non payé' | 'Paiement partiel' | 'Payé' | 'Trop-perçu';
}

export interface CashflowSummaryView {
  period: string;
  type: 'Recette frais scolaires' | 'Dépense' | 'Salaire personnel';
  total: number;
}

export interface WebUsersTable {
  id: Generated<number>;
  username: string;
  password_hash: string;
  password_salt: string;
  role: 'admin' | 'staff';
  created_at: Timestamp;
  disabled: number;
}

export interface Database {
  settings: SettingsTable;
  cashiers: CashiersTable;
  class_levels: ClassLevelsTable;
  class_level_labels: ClassLevelLabelsTable;
  class_name_aliases: ClassNameAliasesTable;
  class_fees: ClassFeesTable;
  payment_categories: PaymentCategoriesTable;
  students: StudentsTable;
  enrollments: EnrollmentsTable;
  counters: CountersTable;
  payments: PaymentsTable;
  expense_categories: ExpenseCategoriesTable;
  expenses: ExpensesTable;
  staff_members: StaffMembersTable;
  staff_payments: StaffPaymentsTable;
  audit_log: AuditLogTable;
  web_users: WebUsersTable;
  enrollment_balances: EnrollmentBalancesView;
  enrollment_balances_all: EnrollmentBalancesView;
  cashflow_summary: CashflowSummaryView;
}
