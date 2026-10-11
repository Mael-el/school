// Lightweight renderer-side mirrors of the main-process DB row shapes
// (kept independent from src/main/** so the renderer bundle never imports
// anything from the main process at runtime — see contextIsolation notes
// in docs/electron-app-plan.md section 2).
export interface Student {
  id: number;
  matricule: string;
  full_name: string;
  gender: 'Garçon' | 'Fille' | null;
  birth_date: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  neighborhood: string | null;
  status?: 'Actif' | 'Archivé';
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: number;
  student_id: number;
  registration_no: string | null;
  school_year: string;
  class_level_id: number;
  section: 'Francophone' | 'Anglophone' | null;
  expected_fee: number;
  registration_date: string | null;
  status: 'Actif' | 'Transféré' | 'Retiré';
  created_at: string;
  updated_at: string;
}

export interface EnrollmentBalance {
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

export interface Payment {
  id: number;
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
  created_at: string;
}

export interface ClassLevel {
  id: number;
  code: string | null;
  name: string;
  display_order: number;
}

export interface ClassLevelLabel {
  section: 'Francophone' | 'Anglophone';
  name: string;
}

export interface ClassLevelStructured extends ClassLevel {
  labels: ClassLevelLabel[];
}

export interface PaymentCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface Cashier {
  id: number;
  name: string;
}

export interface ClassFee {
  id: number;
  class_level_id: number;
  school_year: string;
  section: 'Francophone' | 'Anglophone';
  annual_fee: number;
}

export interface ClassBalanceSummary {
  class_level_id: number;
  class_name: string;
  expected_total: number;
  paid_total: number;
  balance_total: number;
}

export interface MonthlyCollection {
  /** "YYYY-MM" */
  month: string;
  total: number;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface Expense {
  id: number;
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
  created_at: string;
}

export interface ExpenseTotalByCategory {
  category_id: number | null;
  category_name: string;
  total: number;
}

export interface StaffMember {
  id: number;
  staff_no: string;
  full_name: string;
  role: string;
  class_level_id: number | null;
  phone: string | null;
  hire_date: string | null;
  monthly_salary: number;
  status: 'Actif' | 'Suspendu' | 'Sorti';
  created_at: string;
  updated_at: string;
}

export interface StaffPayment {
  id: number;
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
  created_at: string;
}

export interface StaffMonthlyBalance {
  id: number;
  staff_no: string;
  full_name: string;
  role: string;
  monthly_salary: number;
  paid: number;
  balance: number;
}

export interface MonthlyCashflow {
  /** "YYYY-MM" */
  period: string;
  revenue: number;
  expenses: number;
  salaries: number;
  net: number;
}

export interface CashflowFilters {
  /** "YYYY-MM", inclusive */
  from?: string;
  /** "YYYY-MM", inclusive */
  to?: string;
}

export interface CashflowTotals {
  revenue: number;
  expenses: number;
  salaries: number;
  net: number;
}

export interface OverdueEnrollment {
  enrollment_id: number;
  student_id: number;
  matricule: string;
  full_name: string;
  class_name: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  expected_fee: number;
  total_paid: number;
  balance: number;
}

export interface RecoveryStats {
  school_year: string;
  enrollment_count: number;
  expected_total: number;
  collected_total: number;
  balance_total: number;
  recovery_rate: number;
}

export interface YearComparisonRow {
  school_year: string;
  enrollment_count: number;
  expected_total: number;
  collected_total: number;
  recovery_rate: number;
}

export interface DashboardAlerts {
  unpaid_staff_count: number;
  pay_period: string;
  expense_month_total: number;
  expense_budget_limit: number | null;
  expense_budget_exceeded: boolean;
}

export interface BackupStatus {
  lastBackupAt: string | null;
  lastAutoBackupAt: string | null;
  reminderDays: number;
  overdue: boolean;
  autoBackupEnabled: boolean;
  autoBackupIntervalDays: number;
}

export interface BackupResult {
  canceled: boolean;
  filePath?: string;
  backedUpAt?: string;
}

export interface BackupRestoreResult {
  success: boolean;
  canceled?: boolean;
}

export interface PrintHtmlResult {
  html: string;
  defaultFileName: string;
  paperFormat?: 'A4' | 'ticket';
  footerNote?: string;
}
