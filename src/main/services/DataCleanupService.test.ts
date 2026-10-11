import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type AppDatabase } from '../db/connection';
import { StudentService } from './StudentService';
import { EnrollmentService } from './EnrollmentService';
import { PaymentService } from './PaymentService';
import { ExpenseService } from './ExpenseService';
import { StaffService } from './StaffService';
import { SettingsService } from './SettingsService';
import { DataCleanupService } from './DataCleanupService';

describe('DataCleanupService', () => {
  let app: AppDatabase;
  let cleanup: DataCleanupService;
  let students: StudentService;
  let enrollments: EnrollmentService;
  let payments: PaymentService;
  let expenses: ExpenseService;
  let staff: StaffService;
  let settings: SettingsService;
  let classLevelId: number;

  beforeEach(async () => {
    app = await createDatabase(':memory:');
    cleanup = new DataCleanupService(app.db);
    students = new StudentService(app.db);
    enrollments = new EnrollmentService(app.db);
    payments = new PaymentService(app.db);
    expenses = new ExpenseService(app.db);
    staff = new StaffService(app.db);
    settings = new SettingsService(app.db);

    await settings.set('school_name', 'École Test');
    await settings.set('current_school_year', '2026/2027');
    await app.db
      .insertInto('class_levels')
      .values({ name: 'CP', display_order: 1 })
      .execute();
    const level = await app.db
      .selectFrom('class_levels')
      .select('id')
      .executeTakeFirstOrThrow();
    classLevelId = level.id;
    await app.db
      .insertInto('class_fees')
      .values({
        class_level_id: classLevelId,
        school_year: '2026/2027',
        section: 'Francophone',
        annual_fee: 100_000,
      })
      .execute();

    const student = await students.create({
      matricule: 'E001',
      full_name: 'Amina Bello',
    });
    if (!student) throw new Error('student create failed');
    const enrollment = await enrollments.create({
      student_id: student.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
      section: 'Francophone',
    });
    if (!enrollment) throw new Error('enrollment create failed');
    await payments.create(
      {
        enrollment_id: enrollment.id,
        payment_date: '2026-09-01',
        amount: 40_000,
        payment_mode: 'Espèces',
      },
      'REC',
    );
    await expenses.create(
      {
        expense_date: '2026-09-02',
        description: 'Craies',
        amount: 5_000,
        payment_mode: 'Espèces',
      },
      'DEP',
    );
    const member = await staff.create({
      staff_no: 'P001',
      full_name: 'M. Enseignant',
      role: 'Instituteur',
      monthly_salary: 80_000,
    });
    await staff.createPayment(
      {
        staff_id: member.id,
        payment_date: '2026-09-03',
        pay_period: '2026-09',
        amount: 80_000,
        payment_type: 'Salaire',
        payment_mode: 'Espèces',
      },
      'SAL',
    );
  });

  it('previews operational counts without touching settings', async () => {
    const preview = await cleanup.preview();
    expect(preview.students).toBe(1);
    expect(preview.enrollments).toBe(1);
    expect(preview.payments).toBe(1);
    expect(preview.expenses).toBe(1);
    expect(preview.staff).toBe(1);
    expect(preview.staffPayments).toBe(1);
    expect(await settings.get('school_name')).toBe('École Test');
  });

  it('clears payments only and resets the receipt counter', async () => {
    const result = await cleanup.clear({ payments: true });
    expect(result.payments).toBe(1);
    expect(result.students).toBe(0);
    expect(result.enrollments).toBe(0);

    expect(await app.db.selectFrom('students').selectAll().execute()).toHaveLength(
      1,
    );
    expect(
      await app.db.selectFrom('enrollments').selectAll().execute(),
    ).toHaveLength(1);
    expect(await app.db.selectFrom('payments').selectAll().execute()).toHaveLength(
      0,
    );
    expect(await settings.get('school_name')).toBe('École Test');
    expect(await app.db.selectFrom('class_fees').selectAll().execute()).toHaveLength(
      1,
    );
    expect(await app.db.selectFrom('cashiers').selectAll().execute()).toHaveLength(
      1,
    );

    const enrollment = await app.db
      .selectFrom('enrollments')
      .select('id')
      .executeTakeFirstOrThrow();
    const next = await payments.create(
      {
        enrollment_id: enrollment.id,
        payment_date: '2026-09-10',
        amount: 10_000,
        payment_mode: 'Espèces',
      },
      'REC',
    );
    expect(next.receipt_no).toBe('REC-0001');
  });

  it('expands student wipe to enrollments and payments', async () => {
    const result = await cleanup.clear({ students: true });
    expect(result.students).toBe(1);
    expect(result.enrollments).toBe(1);
    expect(result.payments).toBe(1);
    expect(result.staff).toBe(0);
    expect(result.expenses).toBe(0);

    expect(await app.db.selectFrom('students').selectAll().execute()).toHaveLength(
      0,
    );
    expect(await app.db.selectFrom('staff_members').selectAll().execute()).toHaveLength(
      1,
    );
    expect(await app.db.selectFrom('class_levels').selectAll().execute()).toHaveLength(
      1,
    );
  });

  it('rejects an empty selection', async () => {
    await expect(cleanup.clear({})).rejects.toThrow(/Aucune donnée/);
  });

  it('resets school identity and keeps students', async () => {
    await cleanup.clear({ schoolIdentity: true });
    expect(await settings.get('school_name')).toBe('Mon établissement scolaire');
    expect(await settings.get('current_school_year')).toBe('2026/2027');
    expect(await app.db.selectFrom('students').selectAll().execute()).toHaveLength(
      1,
    );
  });

  it('clears everything when all groups are selected', async () => {
    await settings.set('currency', 'EUR');
    await settings.set('receipt_prefix', 'XYZ');

    await cleanup.clear({
      payments: true,
      expenses: true,
      staffPayments: true,
      enrollments: true,
      students: true,
      staff: true,
      audit: true,
      schoolIdentity: true,
      schoolYear: true,
      classes: true,
      fees: true,
      paymentCategories: true,
      expenseCategories: true,
      cashiers: true,
      advancedOptions: true,
    });

    const tables = [
      'payments',
      'expenses',
      'staff_payments',
      'enrollments',
      'students',
      'staff_members',
      'audit_log',
      'class_levels',
      'class_fees',
      'class_name_aliases',
      'class_level_labels',
      'payment_categories',
      'expense_categories',
      'cashiers',
      'counters',
    ] as const;
    for (const table of tables) {
      expect(
        await app.db.selectFrom(table).selectAll().execute(),
        `table ${table} should be empty`,
      ).toHaveLength(0);
    }

    expect(await settings.get('school_name')).toBe('Mon établissement scolaire');
    expect(await settings.get('school_logo_path')).toBeNull();
    expect(await settings.get('currency')).toBe('FCFA');
    expect(await settings.get('receipt_prefix')).toBe('REC');
  });

  it('clears classes and the enrollments that depend on them', async () => {
    const result = await cleanup.clear({ classes: true });
    expect(result.classes).toBe(1);
    expect(result.fees).toBe(1);
    expect(result.enrollments).toBe(1);
    expect(result.payments).toBe(1);
    expect(await app.db.selectFrom('class_levels').selectAll().execute()).toHaveLength(
      0,
    );
    expect(await app.db.selectFrom('students').selectAll().execute()).toHaveLength(
      1,
    );
  });
});
