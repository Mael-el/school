// Wires all services to ipcMain handlers. Only called from the main
// process. Every handler receives already-validated, structurally-typed
// input from the renderer via the contextBridge API (see preload.ts) —
// still uses parameterized queries only (via Kysely), never string
// concatenation, per the security baseline in docs/electron-app-plan.md.
import {
  ipcMain,
  dialog,
  shell,
  app,
  BrowserWindow,
  type IpcMainInvokeEvent,
} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../db/schema-types';
import { StudentService, type CreateStudentInput } from './StudentService';
import {
  EnrollmentService,
  type CreateEnrollmentInput,
  type UpdateEnrollmentInput,
} from './EnrollmentService';
import { PaymentService, type CreatePaymentInput } from './PaymentService';
import { SettingsService } from './SettingsService';
import { getLogoDataUrl, getSchoolBranding } from './branding';
import { ReportService } from './ReportService';
import { PrintService, pdfOptionsForPaperFormat } from './PrintService';
import type { ReceiptPaperFormat } from './print-labels';
import { SchoolYearService } from './SchoolYearService';
import {
  ClassLevelService,
  type UpsertClassLevelInput,
} from './ClassLevelService';
import {
  RegistrationService,
  type RegisterStudentInput,
} from './RegistrationService';
import { upsertClassFee } from './ClassFeeService';
import { BackupService } from './BackupService';
import { ReferenceDataService } from './ReferenceDataService';
import {
  ExpenseService,
  type CreateExpenseInput,
  type ExpenseFilters,
} from './ExpenseService';
import {
  StaffService,
  type CreateStaffMemberInput,
  type CreateStaffPaymentInput,
} from './StaffService';
import { TreasuryService, type CashflowFilters } from './TreasuryService';
import { DataCleanupService, type ClearSelection } from './DataCleanupService';
import { FixtureService, type FixtureProfileId } from './FixtureService';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { getLogFilePath, readLogTail } from './logger';

export interface PrintResult {
  canceled: boolean;
  filePath?: string;
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

export interface BackupStatus {
  lastBackupAt: string | null;
  lastAutoBackupAt: string | null;
  reminderDays: number;
  overdue: boolean;
  autoBackupEnabled: boolean;
  autoBackupIntervalDays: number;
}

/**
 * Restricts `shell.openExternal` to a small scheme whitelist — this is only
 * used for pre-filled WhatsApp/e-mail reminder links (see
 * docs/electron-app-plan.md section 10 "Relances impayés"), never for
 * arbitrary renderer-supplied URLs.
 */
function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['https:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Renders `html` to a PDF (via a hidden, throw-away `BrowserWindow` +
 * `webContents.printToPDF`), asks the user where to save it (native save
 * dialog), writes the file, then opens it in the OS default PDF viewer —
 * which doubles as the "aperçu avant impression" (print preview), since the
 * user can print/zoom/save-again from there without us reimplementing a
 * preview UI.
 */
async function printHtmlToPdf(
  html: string,
  defaultFileName: string,
  parent: BrowserWindow | null,
  paperFormat: ReceiptPaperFormat = 'A4',
  footerNote?: string,
): Promise<PrintResult> {
  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  });
  try {
    await pdfWindow.loadURL(
      `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`,
    );
    const pdfBuffer = await pdfWindow.webContents.printToPDF(
      pdfOptionsForPaperFormat(paperFormat, footerNote),
    );

    const dialogOptions = {
      title: 'Enregistrer le PDF',
      defaultPath: defaultFileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    };
    const result = parent
      ? await dialog.showSaveDialog(parent, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    await fs.writeFile(result.filePath, pdfBuffer);
    void shell.openPath(result.filePath);
    return { canceled: false, filePath: result.filePath };
  } finally {
    pdfWindow.destroy();
  }
}

// The channel list lives in src/shared/ipc-channels.ts so the renderer can
// verify at startup that this main process build serves every channel it
// expects (stale-main-process detection). Re-exported for existing imports.
export { IPC_CHANNELS };

type RegisteredIpcHandler = Parameters<typeof ipcMain.handle>[1];
const webHandlers = new Map<string, RegisteredIpcHandler>();
const registerIpcHandler = ipcMain.handle.bind(ipcMain);
ipcMain.handle = ((channel, listener) => {
  webHandlers.set(channel, listener);
  return registerIpcHandler(channel, listener);
}) as typeof ipcMain.handle;

export function dispatchWebRequest(
  channel: string,
  args: unknown[],
): Promise<unknown> {
  const handler = webHandlers.get(channel);
  if (!handler) throw new Error(`Unknown API operation: ${channel}`);
  return Promise.resolve(handler({} as IpcMainInvokeEvent, ...args));
}

export function unregisterIpcHandlers(): void {
  for (const channel of IPC_CHANNELS) {
    ipcMain.removeHandler(channel);
    webHandlers.delete(channel);
  }
}

export type IpcRuntime = {
  getMainWindow: () => BrowserWindow | null;
  dbPath?: string;
  userDataPath?: string;
  closeDatabase?: () => void;
};

export function registerIpcHandlers(
  db: Kysely<Database>,
  runtime: IpcRuntime | (() => BrowserWindow | null) = () => null,
): void {
  const getMainWindow =
    typeof runtime === 'function' ? runtime : runtime.getMainWindow;
  const dbPath =
    typeof runtime === 'object' && runtime.dbPath
      ? runtime.dbPath
      : path.join(app.getPath('userData'), 'complex-scolaire.sqlite');
  const closeDatabase =
    typeof runtime === 'object' ? runtime.closeDatabase : undefined;
  // ipcMain.handle throws if the channel is already bound. Clear first so
  // bootstrap / activate / HMR can call this more than once.
  unregisterIpcHandlers();
  const students = new StudentService(db);
  const enrollments = new EnrollmentService(db);
  const payments = new PaymentService(db);
  const settings = new SettingsService(db);
  const reports = new ReportService(db);
  const printing = new PrintService(db);
  const schoolYears = new SchoolYearService(db);
  const expenses = new ExpenseService(db);
  const staff = new StaffService(db);
  const treasury = new TreasuryService(db);
  const dataCleanup = new DataCleanupService(db);
  const fixtures = new FixtureService(db);
  const classLevels = new ClassLevelService(db);
  const registration = new RegistrationService(db);
  const reference = new ReferenceDataService(db);
  const backups = new BackupService(db, dbPath, settings);

  ipcMain.handle('students:list', (_event, includeArchived = false) =>
    students.list(includeArchived),
  );
  ipcMain.handle('students:search', (_event, query: string) =>
    students.search(query),
  );
  ipcMain.handle('students:getById', (_event, id: number) =>
    students.getById(id),
  );
  ipcMain.handle('students:create', (_event, input: CreateStudentInput) =>
    students.create(input),
  );
  ipcMain.handle('students:register', (_event, input: RegisterStudentInput) =>
    registration.register(input),
  );
  ipcMain.handle(
    'students:update',
    (_event, id: number, input: Partial<CreateStudentInput>) =>
      students.update(id, input),
  );
  ipcMain.handle('students:archive', (_event, id: number) =>
    students.archive(id),
  );
  ipcMain.handle('students:reactivate', (_event, id: number) =>
    students.reactivate(id),
  );
  ipcMain.handle('students:delete', (_event, id: number) =>
    students.delete(id),
  );
  ipcMain.handle('students:nextMatricule', () => students.nextMatricule());

  ipcMain.handle('enrollments:listForStudent', (_event, studentId: number) =>
    enrollments.listForStudent(studentId),
  );
  ipcMain.handle('enrollments:listForYear', (_event, schoolYear: string) =>
    enrollments.listForYear(schoolYear),
  );
  ipcMain.handle('enrollments:create', (_event, input: CreateEnrollmentInput) =>
    enrollments.create(input),
  );
  ipcMain.handle(
    'enrollments:update',
    (_event, id: number, input: UpdateEnrollmentInput) =>
      enrollments.update(id, input),
  );
  ipcMain.handle('enrollments:delete', (_event, id: number) =>
    enrollments.delete(id),
  );
  ipcMain.handle('enrollments:getBalance', (_event, enrollmentId: number) =>
    enrollments.getBalance(enrollmentId),
  );
  ipcMain.handle(
    'enrollments:nextRegistrationNo',
    (_event, schoolYear: string) => enrollments.nextRegistrationNo(schoolYear),
  );
  ipcMain.handle(
    'enrollments:listBalancesForYear',
    (_event, schoolYear: string, includeInactive = false) =>
      enrollments.listBalancesForYear(schoolYear, includeInactive),
  );

  ipcMain.handle('payments:listForEnrollment', (_event, enrollmentId: number) =>
    payments.listForEnrollment(enrollmentId),
  );
  ipcMain.handle(
    'payments:create',
    async (_event, input: CreatePaymentInput) => {
      const prefix = (await settings.get('receipt_prefix')) ?? 'REC';
      return payments.create(input, prefix);
    },
  );
  ipcMain.handle('payments:cancel', (_event, id: number, reason: string) =>
    payments.cancel(id, reason),
  );
  ipcMain.handle('payments:delete', (_event, id: number) =>
    payments.delete(id),
  );

  ipcMain.handle('settings:getAll', () => settings.getAll());
  ipcMain.handle('settings:get', (_event, key: string) => settings.get(key));
  ipcMain.handle('settings:set', (_event, key: string, value: string | null) =>
    settings.set(key, value),
  );
  ipcMain.handle('settings:getBranding', () => getSchoolBranding(db));
  ipcMain.handle('settings:getLogoDataUrl', () => getLogoDataUrl(db));

  // Read-only reference data used to populate dropdowns in the renderer.
  ipcMain.handle('reference:classLevels', () =>
    db
      .selectFrom('class_levels')
      .selectAll()
      .orderBy('display_order')
      .execute(),
  );
  ipcMain.handle('reference:paymentCategories', () =>
    db.selectFrom('payment_categories').selectAll().orderBy('name').execute(),
  );
  ipcMain.handle('reference:cashiers', () =>
    db.selectFrom('cashiers').selectAll().orderBy('name').execute(),
  );
  ipcMain.handle('reference:schoolYears', async () => {
    const rows = await db
      .selectFrom('enrollments')
      .select('school_year')
      .distinct()
      .orderBy('school_year', 'desc')
      .execute();
    return rows.map((r) => r.school_year);
  });

  ipcMain.handle('reports:classBalancesForYear', (_event, schoolYear: string) =>
    reports.classBalancesForYear(schoolYear),
  );
  ipcMain.handle(
    'reports:monthlyCollectionsForYear',
    (_event, schoolYear: string) =>
      reports.monthlyCollectionsForYear(schoolYear),
  );
  ipcMain.handle('reports:overdueEnrollments', (_event, schoolYear: string) =>
    reports.overdueEnrollments(schoolYear),
  );
  ipcMain.handle('reports:recoveryStats', (_event, schoolYear: string) =>
    reports.recoveryStats(schoolYear),
  );
  ipcMain.handle('reports:yearOverYear', () =>
    reports.yearOverYearComparison(),
  );
  ipcMain.handle(
    'reports:dashboardAlerts',
    async (_event, payPeriod: string, expenseMonth: string) => {
      const raw = await settings.get('expense_budget_limit');
      const limit = raw != null && raw !== '' ? Number(raw) : null;
      return reports.dashboardAlerts(
        payPeriod,
        expenseMonth,
        Number.isFinite(limit) ? limit : null,
      );
    },
  );

  ipcMain.handle('system:openExternal', async (_event, url: string) => {
    if (!isSafeExternalUrl(url)) return false;
    await shell.openExternal(url);
    return true;
  });
  ipcMain.handle('system:ipcReady', () => ({
    ready: true as const,
    channels: [...IPC_CHANNELS],
  }));
  ipcMain.handle('system:getLogTail', (_event, maxLines?: number) => ({
    path: getLogFilePath(),
    tail: readLogTail(maxLines ?? 200),
  }));
  ipcMain.handle('system:openLogsFolder', async () => {
    const logPath = getLogFilePath();
    if (!logPath) return false;
    await shell.openPath(path.dirname(logPath));
    return true;
  });

  ipcMain.handle('backup:createNow', async (): Promise<BackupResult> => {
    const parent = getMainWindow();
    // Flush the WAL into the main database file so the copied snapshot is
    // self-contained (no separate -wal/-shm sidecar files needed).
    await sql`PRAGMA wal_checkpoint(FULL)`.execute(db);

    const stamp = new Date().toISOString().slice(0, 10);
    const dialogOptions = {
      title: 'Enregistrer la sauvegarde',
      defaultPath: `sauvegarde-complex-scolaire-${stamp}.sqlite`,
      filters: [{ name: 'Base de données SQLite', extensions: ['sqlite'] }],
    };
    const result = parent
      ? await dialog.showSaveDialog(parent, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    await fs.copyFile(dbPath, result.filePath);
    const backedUpAt = new Date().toISOString();
    await settings.set('last_backup_at', backedUpAt);
    return { canceled: false, filePath: result.filePath, backedUpAt };
  });

  ipcMain.handle('backup:getStatus', async (): Promise<BackupStatus> => {
    const [
      lastBackupAt,
      lastAutoBackupAt,
      reminderDaysRaw,
      autoEnabled,
      autoInterval,
    ] = await Promise.all([
      settings.get('last_backup_at'),
      settings.get('last_auto_backup_at'),
      settings.get('backup_reminder_days'),
      settings.get('auto_backup_enabled'),
      settings.get('auto_backup_interval_days'),
    ]);
    const reminderDays = Number(reminderDaysRaw) || 7;
    const autoBackupIntervalDays = Number(autoInterval) || 1;
    const overdue = lastBackupAt
      ? (Date.now() - new Date(lastBackupAt).getTime()) / 86_400_000 >=
        reminderDays
      : true;
    return {
      lastBackupAt,
      lastAutoBackupAt,
      reminderDays,
      overdue,
      autoBackupEnabled: autoEnabled === '1',
      autoBackupIntervalDays,
    };
  });

  ipcMain.handle('backup:restore', async (): Promise<BackupRestoreResult> => {
    const parent = getMainWindow();
    const dialogOptions: Electron.OpenDialogOptions = {
      title: 'Restaurer une sauvegarde',
      filters: [
        { name: 'Base de données SQLite', extensions: ['sqlite', 'db'] },
      ],
      properties: ['openFile'],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    await backups.prepareRestoreFrom(result.filePaths[0]);
    closeDatabase?.();
    app.relaunch();
    app.exit(0);
    return { success: true };
  });

  ipcMain.handle(
    'print:studentStatement',
    async (_event, enrollmentId: number) => {
      const doc = await printing.buildStudentStatementHtml(enrollmentId);
      return printHtmlToPdf(
        doc.html,
        doc.defaultFileName,
        getMainWindow(),
        doc.paperFormat,
        doc.footerNote,
      );
    },
  );
  ipcMain.handle('print:paymentReceipt', async (_event, paymentId: number) => {
    const doc = await printing.buildPaymentReceiptHtml(paymentId);
    return printHtmlToPdf(
      doc.html,
      doc.defaultFileName,
      getMainWindow(),
      doc.paperFormat,
      doc.footerNote,
    );
  });
  ipcMain.handle(
    'print:studentStatementHtml',
    async (_event, enrollmentId: number) =>
      printing.buildStudentStatementHtml(enrollmentId),
  );
  ipcMain.handle(
    'print:paymentReceiptHtml',
    async (_event, paymentId: number) =>
      printing.buildPaymentReceiptHtml(paymentId),
  );
  ipcMain.handle(
    'print:classRosterHtml',
    async (
      _event,
      schoolYear: string,
      filters: {
        classLevelId?: number;
        section?: 'Francophone' | 'Anglophone';
      } = {},
    ) => printing.buildClassRosterHtml(schoolYear, filters),
  );
  ipcMain.handle(
    'print:savePdfFromHtml',
    async (
      _event,
      html: string,
      defaultFileName: string,
      paperFormat?: ReceiptPaperFormat,
      footerNote?: string,
    ) =>
      printHtmlToPdf(
        html,
        defaultFileName,
        getMainWindow(),
        paperFormat ?? (await printing.getPaperFormat()),
        footerNote,
      ),
  );

  // Reference-data CRUD (class_levels/class_fees/payment_categories/
  // cashiers have no dedicated service class — same precedent as
  // scripts/import-excel.ts and scripts/seed-fixtures.ts).
  ipcMain.handle(
    'classLevels:create',
    (_event, input: { name: string; display_order: number }) =>
      db.insertInto('class_levels').values(input).executeTakeFirstOrThrow(),
  );
  ipcMain.handle(
    'classLevels:update',
    (
      _event,
      id: number,
      input: Partial<{ name: string; display_order: number }>,
    ) =>
      db.updateTable('class_levels').set(input).where('id', '=', id).execute(),
  );
  ipcMain.handle('classLevels:listStructured', () =>
    classLevels.listStructured(),
  );
  ipcMain.handle(
    'classLevels:upsertStructured',
    (_event, input: UpsertClassLevelInput) =>
      classLevels.upsertStructured(input),
  );
  ipcMain.handle(
    'classLevels:removeSectionClass',
    (
      _event,
      input: { class_level_id: number; section: 'Francophone' | 'Anglophone' },
    ) => classLevels.removeSectionClass(input.class_level_id, input.section),
  );
  ipcMain.handle(
    'classFees:upsert',
    (
      _event,
      input: {
        class_level_id: number;
        school_year: string;
        section: 'Francophone' | 'Anglophone';
        annual_fee: number;
      },
    ) => upsertClassFee(db, input),
  );
  ipcMain.handle('classFees:listForYear', (_event, schoolYear: string) =>
    db
      .selectFrom('class_fees')
      .selectAll()
      .where('school_year', '=', schoolYear)
      .execute(),
  );
  ipcMain.handle(
    'paymentCategories:create',
    (_event, input: { name: string; description: string | null }) =>
      reference.createPaymentCategory(input),
  );
  ipcMain.handle(
    'paymentCategories:update',
    (
      _event,
      id: number,
      input: { name: string; description?: string | null },
    ) =>
      db
        .updateTable('payment_categories')
        .set({
          name: input.name,
          description: input.description ?? null,
        })
        .where('id', '=', id)
        .execute(),
  );
  ipcMain.handle('paymentCategories:delete', async (_event, id: number) => {
    const used = await db
      .selectFrom('payments')
      .select('id')
      .where('category_id', '=', id)
      .executeTakeFirst();
    if (used) {
      throw new Error(
        'Impossible de supprimer cette rubrique : des paiements y sont rattachés.',
      );
    }
    await db.deleteFrom('payment_categories').where('id', '=', id).execute();
  });
  ipcMain.handle('cashiers:create', (_event, input: { name: string }) =>
    reference.createCashier(input),
  );
  ipcMain.handle(
    'cashiers:update',
    (_event, id: number, input: { name: string }) =>
      db.updateTable('cashiers').set(input).where('id', '=', id).execute(),
  );
  ipcMain.handle('cashiers:delete', async (_event, id: number) => {
    const usedPayment = await db
      .selectFrom('payments')
      .select('id')
      .where('cashier_id', '=', id)
      .executeTakeFirst();
    const usedStaff = await db
      .selectFrom('staff_payments')
      .select('id')
      .where('cashier_id', '=', id)
      .executeTakeFirst();
    if (usedPayment || usedStaff) {
      throw new Error(
        'Impossible de supprimer ce caissier : des opérations y sont rattachées.',
      );
    }
    await db.deleteFrom('cashiers').where('id', '=', id).execute();
  });

  // Opens a native file picker, copies the chosen image into userData/branding
  // (so it survives regardless of where the original file lives), and stores
  // the copied path in `settings.school_logo_path`.
  ipcMain.handle('settings:pickLogo', async () => {
    const parent = getMainWindow();
    const dialogOptions: Electron.OpenDialogOptions = {
      title: "Choisir le logo de l'école",
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
      properties: ['openFile'],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const sourcePath = result.filePaths[0];
    const brandingDir = path.join(app.getPath('userData'), 'branding');
    await fs.mkdir(brandingDir, { recursive: true });
    const ext = path.extname(sourcePath) || '.png';
    const destPath = path.join(brandingDir, `school-logo${ext}`);
    await fs.copyFile(sourcePath, destPath);

    await settings.set('school_logo_path', destPath);
    return destPath;
  });

  ipcMain.handle('schoolYears:list', () => schoolYears.listSchoolYears());
  ipcMain.handle(
    'schoolYears:closeout',
    (_event, fromYear: string, toYear: string) =>
      schoolYears.closeout(fromYear, toYear),
  );

  ipcMain.handle('expenses:list', (_event, filters: ExpenseFilters) =>
    expenses.list(filters),
  );
  ipcMain.handle(
    'expenses:create',
    async (_event, input: CreateExpenseInput) => {
      const prefix = (await settings.get('expense_reference_prefix')) ?? 'DEP';
      return expenses.create(input, prefix);
    },
  );
  ipcMain.handle(
    'expenses:update',
    (_event, id: number, input: Partial<CreateExpenseInput>) =>
      expenses.update(id, input),
  );
  ipcMain.handle('expenses:cancel', (_event, id: number, reason: string) =>
    expenses.cancel(id, reason),
  );
  ipcMain.handle('expenses:delete', (_event, id: number) =>
    expenses.delete(id),
  );
  ipcMain.handle(
    'expenses:totalsByCategory',
    (_event, filters: ExpenseFilters) => expenses.totalsByCategory(filters),
  );
  ipcMain.handle(
    'expenseCategories:create',
    (_event, input: { name: string; description: string | null }) =>
      reference.createExpenseCategory(input),
  );
  ipcMain.handle(
    'expenseCategories:update',
    (
      _event,
      id: number,
      input: { name: string; description?: string | null },
    ) =>
      db
        .updateTable('expense_categories')
        .set({
          name: input.name,
          description: input.description ?? null,
        })
        .where('id', '=', id)
        .execute(),
  );
  ipcMain.handle('expenseCategories:delete', async (_event, id: number) => {
    const used = await db
      .selectFrom('expenses')
      .select('id')
      .where('category_id', '=', id)
      .executeTakeFirst();
    if (used) {
      throw new Error(
        'Impossible de supprimer cette catégorie : des dépenses y sont rattachées.',
      );
    }
    await db.deleteFrom('expense_categories').where('id', '=', id).execute();
  });
  ipcMain.handle('reference:expenseCategories', () =>
    db.selectFrom('expense_categories').selectAll().orderBy('name').execute(),
  );

  ipcMain.handle(
    'print:expenseRegister',
    async (
      _event,
      filters: { from?: string; to?: string; categoryId?: number },
    ) => {
      const doc = await printing.buildExpenseRegisterHtml(filters);
      return printHtmlToPdf(
        doc.html,
        doc.defaultFileName,
        getMainWindow(),
        doc.paperFormat,
        doc.footerNote,
      );
    },
  );
  ipcMain.handle(
    'print:expenseRegisterHtml',
    async (_event, filters: ExpenseFilters) =>
      printing.buildExpenseRegisterHtml(filters),
  );

  ipcMain.handle(
    'expenses:exportExcel',
    async (_event, filters: ExpenseFilters) => {
      const rows = await expenses.list(filters);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Dépenses');
      sheet.columns = [
        { header: 'Référence', key: 'reference_no', width: 16 },
        { header: 'Date', key: 'expense_date', width: 12 },
        { header: 'Description', key: 'description', width: 32 },
        { header: 'Montant', key: 'amount', width: 14 },
        { header: 'Mode de paiement', key: 'payment_mode', width: 18 },
        { header: 'Fournisseur', key: 'supplier_name', width: 20 },
        { header: 'Statut', key: 'status', width: 12 },
      ];
      for (const row of rows) sheet.addRow(row);

      const parent = getMainWindow();
      const dialogOptions = {
        title: 'Exporter les dépenses',
        defaultPath: 'depenses.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      };
      const result = parent
        ? await dialog.showSaveDialog(parent, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);
      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      await workbook.xlsx.writeFile(result.filePath);
      void shell.openPath(result.filePath);
      return { canceled: false, filePath: result.filePath };
    },
  );

  ipcMain.handle('staff:list', () => staff.list());
  ipcMain.handle('staff:getById', (_event, id: number) => staff.getById(id));
  ipcMain.handle('staff:create', (_event, input: CreateStaffMemberInput) =>
    staff.create(input),
  );
  ipcMain.handle(
    'staff:update',
    (_event, id: number, input: Partial<CreateStaffMemberInput>) =>
      staff.update(id, input),
  );
  ipcMain.handle('staff:monthlyBalances', (_event, payPeriod: string) =>
    staff.monthlyBalances(payPeriod),
  );
  ipcMain.handle('staff:listPaymentsForStaff', (_event, staffId: number) =>
    staff.listPaymentsForStaff(staffId),
  );
  ipcMain.handle(
    'staff:createPayment',
    async (_event, input: CreateStaffPaymentInput) => {
      const prefix = (await settings.get('staff_receipt_prefix')) ?? 'SAL';
      return staff.createPayment(input, prefix);
    },
  );
  ipcMain.handle('staff:cancelPayment', (_event, id: number, reason: string) =>
    staff.cancelPayment(id, reason),
  );
  ipcMain.handle('staff:delete', (_event, id: number) => staff.delete(id));
  ipcMain.handle('staff:deletePayment', (_event, id: number) =>
    staff.deletePayment(id),
  );
  ipcMain.handle('staff:nextStaffNo', () => staff.nextStaffNo());

  ipcMain.handle(
    'print:staffPaymentReceipt',
    async (_event, paymentId: number) => {
      const doc = await printing.buildStaffPaymentReceiptHtml(paymentId);
      return printHtmlToPdf(
        doc.html,
        doc.defaultFileName,
        getMainWindow(),
        doc.paperFormat,
        doc.footerNote,
      );
    },
  );
  ipcMain.handle(
    'print:staffPaymentReceiptHtml',
    async (_event, paymentId: number) =>
      printing.buildStaffPaymentReceiptHtml(paymentId),
  );

  ipcMain.handle(
    'treasury:monthlySummary',
    (_event, filters: CashflowFilters) => treasury.monthlySummary(filters),
  );
  ipcMain.handle('treasury:totals', (_event, filters: CashflowFilters) =>
    treasury.totals(filters),
  );
  ipcMain.handle(
    'print:financialReport',
    async (_event, filters: CashflowFilters) => {
      const doc = await printing.buildFinancialReportHtml(filters);
      return printHtmlToPdf(
        doc.html,
        doc.defaultFileName,
        getMainWindow(),
        doc.paperFormat,
        doc.footerNote,
      );
    },
  );
  ipcMain.handle(
    'print:financialReportHtml',
    async (_event, filters: CashflowFilters) =>
      printing.buildFinancialReportHtml(filters),
  );
  ipcMain.handle(
    'treasury:exportExcel',
    async (_event, filters: CashflowFilters) => {
      const rows = await treasury.monthlySummary(filters);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Trésorerie');
      sheet.columns = [
        { header: 'Mois', key: 'period', width: 12 },
        { header: 'Recettes', key: 'revenue', width: 16 },
        { header: 'Dépenses', key: 'expenses', width: 16 },
        { header: 'Salaires', key: 'salaries', width: 16 },
        { header: 'Solde net', key: 'net', width: 16 },
      ];
      for (const row of rows) sheet.addRow(row);

      const parent = getMainWindow();
      const dialogOptions = {
        title: 'Exporter le rapport financier',
        defaultPath: 'rapport-financier.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      };
      const result = parent
        ? await dialog.showSaveDialog(parent, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);
      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      await workbook.xlsx.writeFile(result.filePath);
      void shell.openPath(result.filePath);
      return { canceled: false, filePath: result.filePath };
    },
  );

  ipcMain.handle('dataCleanup:preview', () => dataCleanup.preview());
  ipcMain.handle(
    'dataCleanup:clear',
    async (_event, selection: ClearSelection) => {
      const result = await dataCleanup.clear(selection);
      getMainWindow()?.webContents.send('branding:updated');
      return result;
    },
  );
  ipcMain.handle(
    'dataCleanup:loadFixtures',
    async (_event, profileId: FixtureProfileId, keepSettings: boolean) => {
      const result = await fixtures.loadDemo(profileId, keepSettings);
      getMainWindow()?.webContents.send('branding:updated');
      return result;
    },
  );
}
