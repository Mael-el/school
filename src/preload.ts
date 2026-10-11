// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
//
// Single, typed IPC entry point exposed to the renderer (contextIsolation
// is enabled, nodeIntegration is disabled — see docs/electron-app-plan.md
// section 2). The renderer never touches Node/Electron APIs directly.
import { contextBridge, ipcRenderer } from 'electron';
import type {
  Cashier,
  ClassLevel,
  ClassLevelStructured,
  ClassFee,
  Enrollment,
  EnrollmentBalance,
  Expense,
  ExpenseCategory,
  ExpenseTotalByCategory,
  Payment,
  PaymentCategory,
  Student,
  StaffMember,
  StaffPayment,
  StaffMonthlyBalance,
  ClassBalanceSummary,
  MonthlyCollection,
  MonthlyCashflow,
  CashflowTotals,
  OverdueEnrollment,
  RecoveryStats,
  YearComparisonRow,
  DashboardAlerts,
  BackupStatus,
  BackupResult,
  BackupRestoreResult,
  PrintHtmlResult,
} from './lib/types';
import type { CreateStudentInput } from './main/services/StudentService';
import type { RegisterStudentInput } from './main/services/RegistrationService';
import type {
  CreateEnrollmentInput,
  UpdateEnrollmentInput,
} from './main/services/EnrollmentService';
import type { CreatePaymentInput } from './main/services/PaymentService';
import type { PrintResult } from './main/services/ipc';
import type { CloseoutResult } from './main/services/SchoolYearService';
import type {
  ClearCounts,
  ClearResult,
  ClearSelection,
} from '../shared/clear-selection';
import type {
  FixtureProfileId,
  LoadFixturesResult,
} from './main/services/FixtureService';
import type {
  CreateExpenseInput,
  ExpenseFilters,
} from './main/services/ExpenseService';
import type {
  CreateStaffMemberInput,
  CreateStaffPaymentInput,
} from './main/services/StaffService';
import type { CashflowFilters } from './main/services/TreasuryService';

const api = {
  students: {
    list: (includeArchived = false): Promise<Student[]> =>
      ipcRenderer.invoke('students:list', includeArchived),
    search: (query: string): Promise<Student[]> =>
      ipcRenderer.invoke('students:search', query),
    getById: (id: number): Promise<Student | undefined> =>
      ipcRenderer.invoke('students:getById', id),
    create: (input: CreateStudentInput): Promise<Student | undefined> =>
      ipcRenderer.invoke('students:create', input),
    register: (
      input: RegisterStudentInput,
    ): Promise<{ student: Student; enrollment: Enrollment }> =>
      ipcRenderer.invoke('students:register', input),
    update: (
      id: number,
      input: Partial<CreateStudentInput>,
    ): Promise<Student | undefined> =>
      ipcRenderer.invoke('students:update', id, input),
    archive: (id: number): Promise<Student | undefined> =>
      ipcRenderer.invoke('students:archive', id),
    reactivate: (id: number): Promise<Student | undefined> =>
      ipcRenderer.invoke('students:reactivate', id),
    delete: (id: number): Promise<void> =>
      ipcRenderer.invoke('students:delete', id),
    nextMatricule: (): Promise<string> =>
      ipcRenderer.invoke('students:nextMatricule'),
  },
  enrollments: {
    listForStudent: (studentId: number): Promise<Enrollment[]> =>
      ipcRenderer.invoke('enrollments:listForStudent', studentId),
    listForYear: (schoolYear: string): Promise<Enrollment[]> =>
      ipcRenderer.invoke('enrollments:listForYear', schoolYear),
    create: (input: CreateEnrollmentInput): Promise<Enrollment | undefined> =>
      ipcRenderer.invoke('enrollments:create', input),
    update: (
      id: number,
      input: UpdateEnrollmentInput,
    ): Promise<Enrollment | undefined> =>
      ipcRenderer.invoke('enrollments:update', id, input),
    delete: (id: number): Promise<void> =>
      ipcRenderer.invoke('enrollments:delete', id),
    getBalance: (
      enrollmentId: number,
    ): Promise<EnrollmentBalance | undefined> =>
      ipcRenderer.invoke('enrollments:getBalance', enrollmentId),
    listBalancesForYear: (
      schoolYear: string,
      includeInactive = false,
    ): Promise<EnrollmentBalance[]> =>
      ipcRenderer.invoke(
        'enrollments:listBalancesForYear',
        schoolYear,
        includeInactive,
      ),
    nextRegistrationNo: (schoolYear: string): Promise<string> =>
      ipcRenderer.invoke('enrollments:nextRegistrationNo', schoolYear),
  },
  payments: {
    listForEnrollment: (enrollmentId: number): Promise<Payment[]> =>
      ipcRenderer.invoke('payments:listForEnrollment', enrollmentId),
    create: (input: CreatePaymentInput): Promise<Payment> =>
      ipcRenderer.invoke('payments:create', input),
    cancel: (id: number, reason: string): Promise<void> =>
      ipcRenderer.invoke('payments:cancel', id, reason),
    delete: (id: number): Promise<void> =>
      ipcRenderer.invoke('payments:delete', id),
  },
  settings: {
    getAll: (): Promise<Record<string, string | null>> =>
      ipcRenderer.invoke('settings:getAll'),
    get: (key: string): Promise<string | null | undefined> =>
      ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string | null): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value),
    getBranding: (): Promise<{
      schoolName: string;
      schoolShortName: string;
      windowTitle: string;
      logoDataUrl: string | null;
    }> => ipcRenderer.invoke('settings:getBranding'),
    getLogoDataUrl: (): Promise<string | null> =>
      ipcRenderer.invoke('settings:getLogoDataUrl'),
    pickLogo: (): Promise<string | null> =>
      ipcRenderer.invoke('settings:pickLogo'),
    onBrandingUpdated: (callback: () => void): (() => void) => {
      const listener = () => callback();
      ipcRenderer.on('branding:updated', listener);
      return () => ipcRenderer.removeListener('branding:updated', listener);
    },
  },
  reference: {
    classLevels: (): Promise<ClassLevel[]> =>
      ipcRenderer.invoke('reference:classLevels'),
    paymentCategories: (): Promise<PaymentCategory[]> =>
      ipcRenderer.invoke('reference:paymentCategories'),
    cashiers: (): Promise<Cashier[]> =>
      ipcRenderer.invoke('reference:cashiers'),
    schoolYears: (): Promise<string[]> =>
      ipcRenderer.invoke('reference:schoolYears'),
    expenseCategories: (): Promise<ExpenseCategory[]> =>
      ipcRenderer.invoke('reference:expenseCategories'),
  },
  reports: {
    classBalancesForYear: (
      schoolYear: string,
    ): Promise<ClassBalanceSummary[]> =>
      ipcRenderer.invoke('reports:classBalancesForYear', schoolYear),
    monthlyCollectionsForYear: (
      schoolYear: string,
    ): Promise<MonthlyCollection[]> =>
      ipcRenderer.invoke('reports:monthlyCollectionsForYear', schoolYear),
    overdueEnrollments: (schoolYear: string): Promise<OverdueEnrollment[]> =>
      ipcRenderer.invoke('reports:overdueEnrollments', schoolYear),
    recoveryStats: (schoolYear: string): Promise<RecoveryStats> =>
      ipcRenderer.invoke('reports:recoveryStats', schoolYear),
    yearOverYear: (): Promise<YearComparisonRow[]> =>
      ipcRenderer.invoke('reports:yearOverYear'),
    dashboardAlerts: (
      payPeriod: string,
      expenseMonth: string,
    ): Promise<DashboardAlerts> =>
      ipcRenderer.invoke('reports:dashboardAlerts', payPeriod, expenseMonth),
  },
  print: {
    studentStatement: (enrollmentId: number): Promise<PrintResult> =>
      ipcRenderer.invoke('print:studentStatement', enrollmentId),
    paymentReceipt: (paymentId: number): Promise<PrintResult> =>
      ipcRenderer.invoke('print:paymentReceipt', paymentId),
    expenseRegister: (filters: ExpenseFilters): Promise<PrintResult> =>
      ipcRenderer.invoke('print:expenseRegister', filters),
    staffPaymentReceipt: (paymentId: number): Promise<PrintResult> =>
      ipcRenderer.invoke('print:staffPaymentReceipt', paymentId),
    financialReport: (filters: CashflowFilters = {}): Promise<PrintResult> =>
      ipcRenderer.invoke('print:financialReport', filters),
    savePdfFromHtml: (
      html: string,
      defaultFileName: string,
      paperFormat?: 'A4' | 'ticket',
      footerNote?: string,
    ): Promise<PrintResult> =>
      ipcRenderer.invoke(
        'print:savePdfFromHtml',
        html,
        defaultFileName,
        paperFormat,
        footerNote,
      ),
    classRosterHtml: (
      schoolYear: string,
      filters?: {
        classLevelId?: number;
        section?: 'Francophone' | 'Anglophone';
      },
    ): Promise<PrintHtmlResult> =>
      ipcRenderer.invoke('print:classRosterHtml', schoolYear, filters ?? {}),
    studentStatementHtml: (enrollmentId: number): Promise<PrintHtmlResult> =>
      ipcRenderer.invoke('print:studentStatementHtml', enrollmentId),
    paymentReceiptHtml: (paymentId: number): Promise<PrintHtmlResult> =>
      ipcRenderer.invoke('print:paymentReceiptHtml', paymentId),
    expenseRegisterHtml: (filters: ExpenseFilters): Promise<PrintHtmlResult> =>
      ipcRenderer.invoke('print:expenseRegisterHtml', filters),
    staffPaymentReceiptHtml: (paymentId: number): Promise<PrintHtmlResult> =>
      ipcRenderer.invoke('print:staffPaymentReceiptHtml', paymentId),
    financialReportHtml: (filters: CashflowFilters): Promise<PrintHtmlResult> =>
      ipcRenderer.invoke('print:financialReportHtml', filters),
  },
  classLevels: {
    create: (input: {
      name: string;
      display_order: number;
    }): Promise<unknown> => ipcRenderer.invoke('classLevels:create', input),
    update: (
      id: number,
      input: Partial<{ name: string; display_order: number; code: string }>,
    ): Promise<unknown> => ipcRenderer.invoke('classLevels:update', id, input),
    listStructured: (): Promise<ClassLevelStructured[]> =>
      ipcRenderer.invoke('classLevels:listStructured'),
    upsertStructured: (input: {
      id?: number;
      code: string;
      display_order: number;
      labels: {
        francophone?: string | null;
        anglophone?: string | null;
      };
    }): Promise<number> =>
      ipcRenderer.invoke('classLevels:upsertStructured', input),
    removeSectionClass: (input: {
      class_level_id: number;
      section: 'Francophone' | 'Anglophone';
    }): Promise<void> =>
      ipcRenderer.invoke('classLevels:removeSectionClass', input),
  },
  classFees: {
    upsert: (input: {
      class_level_id: number;
      school_year: string;
      section: 'Francophone' | 'Anglophone';
      annual_fee: number;
    }): Promise<unknown> => ipcRenderer.invoke('classFees:upsert', input),
    listForYear: (schoolYear: string): Promise<ClassFee[]> =>
      ipcRenderer.invoke('classFees:listForYear', schoolYear),
  },
  paymentCategories: {
    create: (input: {
      name: string;
      description: string | null;
    }): Promise<unknown> =>
      ipcRenderer.invoke('paymentCategories:create', input),
    update: (
      id: number,
      input: { name: string; description?: string | null },
    ): Promise<void> =>
      ipcRenderer.invoke('paymentCategories:update', id, input),
    delete: (id: number): Promise<void> =>
      ipcRenderer.invoke('paymentCategories:delete', id),
  },
  cashiers: {
    create: (input: { name: string }): Promise<unknown> =>
      ipcRenderer.invoke('cashiers:create', input),
    update: (id: number, input: { name: string }): Promise<void> =>
      ipcRenderer.invoke('cashiers:update', id, input),
    delete: (id: number): Promise<void> =>
      ipcRenderer.invoke('cashiers:delete', id),
  },
  schoolYears: {
    list: (): Promise<string[]> => ipcRenderer.invoke('schoolYears:list'),
    closeout: (fromYear: string, toYear: string): Promise<CloseoutResult> =>
      ipcRenderer.invoke('schoolYears:closeout', fromYear, toYear),
  },
  expenses: {
    list: (filters: ExpenseFilters = {}): Promise<Expense[]> =>
      ipcRenderer.invoke('expenses:list', filters),
    create: (input: CreateExpenseInput): Promise<Expense> =>
      ipcRenderer.invoke('expenses:create', input),
    update: (
      id: number,
      input: Partial<CreateExpenseInput>,
    ): Promise<Expense> => ipcRenderer.invoke('expenses:update', id, input),
    cancel: (id: number, reason: string): Promise<void> =>
      ipcRenderer.invoke('expenses:cancel', id, reason),
    delete: (id: number): Promise<void> =>
      ipcRenderer.invoke('expenses:delete', id),
    totalsByCategory: (
      filters: ExpenseFilters = {},
    ): Promise<ExpenseTotalByCategory[]> =>
      ipcRenderer.invoke('expenses:totalsByCategory', filters),
    exportExcel: (filters: ExpenseFilters = {}): Promise<PrintResult> =>
      ipcRenderer.invoke('expenses:exportExcel', filters),
  },
  expenseCategories: {
    create: (input: {
      name: string;
      description: string | null;
    }): Promise<unknown> =>
      ipcRenderer.invoke('expenseCategories:create', input),
    update: (
      id: number,
      input: { name: string; description?: string | null },
    ): Promise<unknown> =>
      ipcRenderer.invoke('expenseCategories:update', id, input),
    delete: (id: number): Promise<void> =>
      ipcRenderer.invoke('expenseCategories:delete', id),
  },
  staff: {
    list: (): Promise<StaffMember[]> => ipcRenderer.invoke('staff:list'),
    getById: (id: number): Promise<StaffMember | undefined> =>
      ipcRenderer.invoke('staff:getById', id),
    create: (input: CreateStaffMemberInput): Promise<StaffMember> =>
      ipcRenderer.invoke('staff:create', input),
    update: (
      id: number,
      input: Partial<
        CreateStaffMemberInput & { status: 'Actif' | 'Suspendu' | 'Sorti' }
      >,
    ): Promise<StaffMember | undefined> =>
      ipcRenderer.invoke('staff:update', id, input),
    monthlyBalances: (payPeriod: string): Promise<StaffMonthlyBalance[]> =>
      ipcRenderer.invoke('staff:monthlyBalances', payPeriod),
    listPaymentsForStaff: (staffId: number): Promise<StaffPayment[]> =>
      ipcRenderer.invoke('staff:listPaymentsForStaff', staffId),
    createPayment: (input: CreateStaffPaymentInput): Promise<StaffPayment> =>
      ipcRenderer.invoke('staff:createPayment', input),
    cancelPayment: (id: number, reason: string): Promise<void> =>
      ipcRenderer.invoke('staff:cancelPayment', id, reason),
    delete: (id: number): Promise<void> =>
      ipcRenderer.invoke('staff:delete', id),
    deletePayment: (id: number): Promise<void> =>
      ipcRenderer.invoke('staff:deletePayment', id),
    nextStaffNo: (): Promise<string> => ipcRenderer.invoke('staff:nextStaffNo'),
  },
  treasury: {
    monthlySummary: (
      filters: CashflowFilters = {},
    ): Promise<MonthlyCashflow[]> =>
      ipcRenderer.invoke('treasury:monthlySummary', filters),
    totals: (filters: CashflowFilters = {}): Promise<CashflowTotals> =>
      ipcRenderer.invoke('treasury:totals', filters),
    exportExcel: (filters: CashflowFilters = {}): Promise<PrintResult> =>
      ipcRenderer.invoke('treasury:exportExcel', filters),
  },
  backup: {
    createNow: (): Promise<BackupResult> =>
      ipcRenderer.invoke('backup:createNow'),
    getStatus: (): Promise<BackupStatus> =>
      ipcRenderer.invoke('backup:getStatus'),
    restore: (): Promise<BackupRestoreResult> =>
      ipcRenderer.invoke('backup:restore'),
  },
  dataCleanup: {
    preview: (): Promise<ClearCounts> =>
      ipcRenderer.invoke('dataCleanup:preview'),
    clear: (selection: ClearSelection): Promise<ClearResult> =>
      ipcRenderer.invoke('dataCleanup:clear', selection),
    loadFixtures: (
      profileId: FixtureProfileId,
      keepSettings: boolean,
    ): Promise<LoadFixturesResult> =>
      ipcRenderer.invoke('dataCleanup:loadFixtures', profileId, keepSettings),
  },
  system: {
    openExternal: (url: string): Promise<boolean> =>
      ipcRenderer.invoke('system:openExternal', url),
    ipcReady: (): Promise<{ ready: true; channels?: string[] }> =>
      ipcRenderer.invoke('system:ipcReady'),
    getLogTail: (
      maxLines?: number,
    ): Promise<{ path: string | null; tail: string }> =>
      ipcRenderer.invoke('system:getLogTail', maxLines),
    openLogsFolder: (): Promise<boolean> =>
      ipcRenderer.invoke('system:openLogsFolder'),
  },
};

export type AppApi = typeof api;

contextBridge.exposeInMainWorld('api', api);
