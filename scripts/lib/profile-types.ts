export interface ProfileClassLevelLabels {
  francophone?: string;
  anglophone?: string;
}

export interface ProfileClassLevelFees {
  francophone?: number;
  anglophone?: number;
}

export interface ProfileClassLevel {
  /** Logical level identifier (e.g. PS, CP, C6). */
  code?: string;
  display_order: number;
  /** Default annual fee for each section offered by this level. */
  fee: number;
  /** Optional per-section fees (overrides `fee` for that section). */
  fees?: ProfileClassLevelFees;
  /** Bilingual display names — preferred (V2 Phase C). */
  labels?: ProfileClassLevelLabels;
  /** Legacy flat row — single name + section (pre-Phase C profiles). */
  name?: string;
  section?: 'Francophone' | 'Anglophone';
}

export interface ProfileStaffMember {
  staff_no: string;
  full_name: string;
  role: string;
  monthly_salary: number;
  phone?: string | null;
  hire_date?: string | null;
  /** When omitted, seeder pays the current month except the last member. */
  payments?: Array<{
    pay_period: string;
    amount?: number;
    payment_date?: string;
    payment_type?: 'Salaire' | 'Avance' | 'Prime' | 'Autre';
    payment_mode?: string;
  }>;
}

export interface ProfileExpense {
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  payment_mode?: string;
  supplier_name?: string | null;
  receipt_ref?: string | null;
  approved_by?: string | null;
  note?: string | null;
}

export interface ProfileDemoOptions {
  school_year: string;
  /** Students per section per class level. */
  students_per_class: number;
  /** Prefix for generated student IDs (defaults to receipt_prefix). */
  matricule_prefix?: string;
  first_names?: string[];
  first_names_anglophone?: string[];
  last_names?: string[];
  neighborhoods?: string[];
}

/** JSON school profile — loaded from `app/profiles/*.json`. */
export interface SchoolProfile {
  id: string;
  label: string;
  description?: string;
  settings: Record<string, string | null>;
  classLevels: ProfileClassLevel[];
  paymentCategories?: string[];
  expenseCategories?: string[];
  cashiers?: string[];
  staff?: ProfileStaffMember[];
  expenses?: ProfileExpense[];
  demo?: ProfileDemoOptions;
}
