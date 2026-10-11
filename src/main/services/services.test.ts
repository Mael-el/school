import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type AppDatabase } from '../db/connection';
import { StudentService } from './StudentService';
import { EnrollmentService } from './EnrollmentService';
import { PaymentService } from './PaymentService';
import { SettingsService } from './SettingsService';
import { ExpenseService } from './ExpenseService';
import { StaffService } from './StaffService';
import { TreasuryService } from './TreasuryService';
import { ReportService } from './ReportService';

async function seedReferenceData(app: AppDatabase) {
  await app.db
    .insertInto('class_levels')
    .values({ name: 'Petite Section', display_order: 1 })
    .execute();
  const classLevel = await app.db
    .selectFrom('class_levels')
    .select('id')
    .where('name', '=', 'Petite Section')
    .executeTakeFirstOrThrow();

  await app.db
    .insertInto('class_fees')
    .values({
      class_level_id: classLevel.id,
      school_year: '2026/2027',
      section: 'Francophone',
      annual_fee: 182000,
    })
    .execute();

  return { classLevelId: classLevel.id };
}

describe('data layer services', () => {
  let app: AppDatabase;
  let students: StudentService;
  let enrollments: EnrollmentService;
  let payments: PaymentService;
  let settings: SettingsService;

  beforeEach(async () => {
    app = await createDatabase(':memory:');
    students = new StudentService(app.db);
    enrollments = new EnrollmentService(app.db);
    payments = new PaymentService(app.db);
    settings = new SettingsService(app.db);
  });

  it('creates and reads settings', async () => {
    await settings.set('current_school_year', '2026/2027');
    expect(await settings.getCurrentSchoolYear()).toBe('2026/2027');

    // upsert overwrites the existing value
    await settings.set('current_school_year', '2027/2028');
    expect(await settings.get('current_school_year')).toBe('2027/2028');
  });

  it('creates a student', async () => {
    const student = await students.create({
      matricule: 'E001',
      full_name: 'Amina Bello',
      gender: 'Fille',
    });
    expect(student?.matricule).toBe('E001');

    const found = await students.search('Amina');
    expect(found).toHaveLength(1);
  });

  it('creates an enrollment with the fee snapshotted from class_fees', async () => {
    const { classLevelId } = await seedReferenceData(app);
    const student = await students.create({
      matricule: 'E001',
      full_name: 'Amina Bello',
    });

    const enrollment = await enrollments.create({
      student_id: student!.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
      section: 'Francophone',
    });

    expect(enrollment?.expected_fee).toBe(182000);
  });

  it('full E2E flow: student -> enrollment -> payment -> balance (Amina Bello case)', async () => {
    const { classLevelId } = await seedReferenceData(app);
    const student = await students.create({
      matricule: 'E001',
      full_name: 'Amina Bello',
      gender: 'Fille',
    });
    const enrollment = await enrollments.create({
      student_id: student!.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
      section: 'Francophone',
    });

    const payment = await payments.create(
      {
        enrollment_id: enrollment!.id,
        payment_date: '2026-09-08',
        amount: 182000,
        payment_mode: 'Espèces',
        note: 'Paiement complet',
      },
      'REC',
    );

    expect(payment.receipt_no).toBe('REC-0001');

    const balance = await enrollments.getBalance(enrollment!.id);
    expect(balance?.total_paid).toBe(182000);
    expect(balance?.balance).toBe(0);
    expect(balance?.status).toBe('Payé');
  });

  it('cancelling a payment excludes it from the balance', async () => {
    const { classLevelId } = await seedReferenceData(app);
    const student = await students.create({
      matricule: 'E002',
      full_name: 'Jean Test',
    });
    const enrollment = await enrollments.create({
      student_id: student!.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
    });
    const payment = await payments.create(
      {
        enrollment_id: enrollment!.id,
        payment_date: '2026-09-08',
        amount: 50000,
        payment_mode: 'Espèces',
      },
      'REC',
    );

    await payments.cancel(payment.id, 'Erreur de saisie');

    const balance = await enrollments.getBalance(enrollment!.id);
    expect(balance?.total_paid).toBe(0);
    expect(balance?.status).toBe('Non payé');
  });

  it('receipt numbers increment monotonically across payments', async () => {
    const { classLevelId } = await seedReferenceData(app);
    const student = await students.create({
      matricule: 'E003',
      full_name: 'Deux Paiements',
    });
    const enrollment = await enrollments.create({
      student_id: student!.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
    });

    const first = await payments.create(
      {
        enrollment_id: enrollment!.id,
        payment_date: '2026-09-08',
        amount: 100000,
        payment_mode: 'Espèces',
      },
      'REC',
    );
    const second = await payments.create(
      {
        enrollment_id: enrollment!.id,
        payment_date: '2026-10-08',
        amount: 82000,
        payment_mode: 'Espèces',
      },
      'REC',
    );

    expect(first.receipt_no).toBe('REC-0001');
    expect(second.receipt_no).toBe('REC-0002');
  });

  it('archiving a student excludes them from active enrollment balances', async () => {
    const { classLevelId } = await seedReferenceData(app);
    const student = await students.create({
      matricule: 'E010',
      full_name: 'Archive Test',
    });
    await enrollments.create({
      student_id: student!.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
    });

    const before = await enrollments.listBalancesForYear('2026/2027');
    expect(before).toHaveLength(1);

    await students.archive(student!.id);

    const after = await enrollments.listBalancesForYear('2026/2027');
    expect(after).toHaveLength(0);

    const all = await enrollments.listBalancesForYear('2026/2027', true);
    expect(all).toHaveLength(1);
    expect(all[0].student_status).toBe('Archivé');
  });

  it('reactivating a student restores them to active enrollment balances', async () => {
    const { classLevelId } = await seedReferenceData(app);
    const student = await students.create({
      matricule: 'E011',
      full_name: 'Reactivate Test',
    });
    await enrollments.create({
      student_id: student!.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
    });

    await students.archive(student!.id);
    expect(await enrollments.listBalancesForYear('2026/2027')).toHaveLength(0);

    await students.reactivate(student!.id);
    const restored = await enrollments.listBalancesForYear('2026/2027');
    expect(restored).toHaveLength(1);
    expect(restored[0].student_status).toBe('Actif');
  });

  it('deleting a student removes enrollments and payments', async () => {
    const { classLevelId } = await seedReferenceData(app);
    const student = await students.create({
      matricule: 'E013',
      full_name: 'Delete Test',
    });
    const enrollment = await enrollments.create({
      student_id: student!.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
    });
    await payments.create(
      {
        enrollment_id: enrollment!.id,
        payment_date: '2026-09-08',
        amount: 50000,
        payment_mode: 'Espèces',
      },
      'REC',
    );

    await students.delete(student!.id);

    expect(await students.getById(student!.id)).toBeUndefined();
    expect(await enrollments.getById(enrollment!.id)).toBeUndefined();
    const paymentRows = await app.db.selectFrom('payments').selectAll().execute();
    expect(paymentRows).toHaveLength(0);
  });

  it('withdrawn enrollments are excluded from active balances but visible when including inactive', async () => {
    const { classLevelId } = await seedReferenceData(app);
    const student = await students.create({
      matricule: 'E012',
      full_name: 'Withdraw Test',
    });
    const enrollment = await enrollments.create({
      student_id: student!.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
    });

    await enrollments.updateStatus(enrollment!.id, 'Retiré');

    expect(await enrollments.listBalancesForYear('2026/2027')).toHaveLength(0);

    const all = await enrollments.listBalancesForYear('2026/2027', true);
    expect(all).toHaveLength(1);
    expect(all[0].enrollment_status).toBe('Retiré');
  });
});

describe('ExpenseService', () => {
  let app: AppDatabase;
  let expenses: ExpenseService;

  beforeEach(async () => {
    app = await createDatabase(':memory:');
    expenses = new ExpenseService(app.db);
  });

  it('creates an expense with an incrementing reference number', async () => {
    const first = await expenses.create(
      {
        expense_date: '2026-09-08',
        description: 'Achat de craie',
        amount: 15000,
        payment_mode: 'Espèces',
      },
      'DEP',
    );
    const second = await expenses.create(
      {
        expense_date: '2026-09-10',
        description: 'Réparation photocopieur',
        amount: 40000,
        payment_mode: 'Espèces',
      },
      'DEP',
    );

    expect(first.reference_no).toBe('DEP-0001');
    expect(second.reference_no).toBe('DEP-0002');
  });

  it('never deletes an expense: cancellation marks it Annulé', async () => {
    const expense = await expenses.create(
      {
        expense_date: '2026-09-08',
        description: 'Fournitures',
        amount: 20000,
        payment_mode: 'Espèces',
      },
      'DEP',
    );

    await expenses.cancel(expense.id, 'Doublon');

    const cancelled = await expenses.getById(expense.id);
    expect(cancelled?.status).toBe('Annulé');
    expect(cancelled?.cancelled_reason).toBe('Doublon');
    expect(cancelled?.cancelled_at).toBeTruthy();

    const list = await expenses.list();
    expect(list).toHaveLength(1);
  });

  it('computes totals by category, excluding cancelled expenses', async () => {
    await app.db
      .insertInto('expense_categories')
      .values({ name: 'Fournitures', description: null })
      .execute();
    const category = await app.db
      .selectFrom('expense_categories')
      .select('id')
      .where('name', '=', 'Fournitures')
      .executeTakeFirstOrThrow();

    await expenses.create(
      {
        expense_date: '2026-09-08',
        category_id: category.id,
        description: 'Craie',
        amount: 15000,
        payment_mode: 'Espèces',
      },
      'DEP',
    );
    const toCancel = await expenses.create(
      {
        expense_date: '2026-09-09',
        category_id: category.id,
        description: 'Erreur',
        amount: 99999,
        payment_mode: 'Espèces',
      },
      'DEP',
    );
    await expenses.cancel(toCancel.id, 'Doublon');

    const totals = await expenses.totalsByCategory();
    expect(totals).toHaveLength(1);
    expect(totals[0].total).toBe(15000);
  });
});

describe('StaffService', () => {
  let app: AppDatabase;
  let staff: StaffService;

  beforeEach(async () => {
    app = await createDatabase(':memory:');
    staff = new StaffService(app.db);
  });

  it('creates a staff member', async () => {
    const member = await staff.create({
      staff_no: 'P001',
      full_name: 'Jean Enseignant',
      role: 'Enseignant',
      monthly_salary: 150000,
    });
    expect(member.staff_no).toBe('P001');
    expect(member.status).toBe('Actif');
  });

  it('creates staff payments with incrementing receipt numbers', async () => {
    const member = await staff.create({
      staff_no: 'P002',
      full_name: 'Awa Comptable',
      role: 'Personnel administratif',
      monthly_salary: 120000,
    });

    const first = await staff.createPayment(
      {
        staff_id: member.id,
        payment_date: '2026-09-05',
        pay_period: '2026-09',
        amount: 60000,
        payment_type: 'Salaire',
        payment_mode: 'Espèces',
      },
      'SAL',
    );
    const second = await staff.createPayment(
      {
        staff_id: member.id,
        payment_date: '2026-09-20',
        pay_period: '2026-09',
        amount: 60000,
        payment_type: 'Salaire',
        payment_mode: 'Espèces',
      },
      'SAL',
    );

    expect(first.receipt_no).toBe('SAL-0001');
    expect(second.receipt_no).toBe('SAL-0002');
  });

  it('never deletes a staff payment: cancellation marks it Annulé', async () => {
    const member = await staff.create({
      staff_no: 'P003',
      full_name: 'Marie Surveillante',
      role: 'Surveillant',
      monthly_salary: 90000,
    });
    const payment = await staff.createPayment(
      {
        staff_id: member.id,
        payment_date: '2026-09-05',
        pay_period: '2026-09',
        amount: 90000,
        payment_type: 'Salaire',
        payment_mode: 'Espèces',
      },
      'SAL',
    );

    await staff.cancelPayment(payment.id, 'Erreur de saisie');

    const list = await staff.listPaymentsForStaff(member.id);
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('Annulé');
    expect(list[0].cancelled_reason).toBe('Erreur de saisie');
    expect(list[0].cancelled_at).toBeTruthy();
  });

  it('computes monthly balances including staff with no payment for the period', async () => {
    const paid = await staff.create({
      staff_no: 'P004',
      full_name: 'Paul Payé',
      role: 'Enseignant',
      monthly_salary: 100000,
    });
    await staff.create({
      staff_no: 'P005',
      full_name: 'Sara Non-payée',
      role: 'Enseignant',
      monthly_salary: 100000,
    });

    await staff.createPayment(
      {
        staff_id: paid.id,
        payment_date: '2026-09-05',
        pay_period: '2026-09',
        amount: 100000,
        payment_type: 'Salaire',
        payment_mode: 'Espèces',
      },
      'SAL',
    );

    const balances = await staff.monthlyBalances('2026-09');
    expect(balances).toHaveLength(2);

    const paidBalance = balances.find((b) => b.staff_no === 'P004');
    const unpaidBalance = balances.find((b) => b.staff_no === 'P005');
    expect(paidBalance?.paid).toBe(100000);
    expect(paidBalance?.balance).toBe(0);
    expect(unpaidBalance?.paid).toBe(0);
    expect(unpaidBalance?.balance).toBe(100000);
  });
});

describe('TreasuryService', () => {
  let app: AppDatabase;
  let students: StudentService;
  let enrollments: EnrollmentService;
  let payments: PaymentService;
  let expenses: ExpenseService;
  let staff: StaffService;
  let treasury: TreasuryService;

  beforeEach(async () => {
    app = await createDatabase(':memory:');
    students = new StudentService(app.db);
    enrollments = new EnrollmentService(app.db);
    payments = new PaymentService(app.db);
    expenses = new ExpenseService(app.db);
    staff = new StaffService(app.db);
    treasury = new TreasuryService(app.db);
  });

  it('combines payments, expenses and staff payments into a consolidated monthly summary', async () => {
    const { classLevelId } = await seedReferenceData(app);
    const student = await students.create({
      matricule: 'E010',
      full_name: 'Trésorerie Test',
    });
    const enrollment = await enrollments.create({
      student_id: student!.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
    });
    await payments.create(
      {
        enrollment_id: enrollment!.id,
        payment_date: '2026-09-08',
        amount: 100000,
        payment_mode: 'Espèces',
      },
      'REC',
    );
    await expenses.create(
      {
        expense_date: '2026-09-10',
        description: 'Fournitures',
        amount: 20000,
        payment_mode: 'Espèces',
      },
      'DEP',
    );
    const member = await staff.create({
      staff_no: 'P010',
      full_name: 'Salarié Test',
      role: 'Enseignant',
      monthly_salary: 30000,
    });
    await staff.createPayment(
      {
        staff_id: member.id,
        payment_date: '2026-09-15',
        pay_period: '2026-09',
        amount: 30000,
        payment_type: 'Salaire',
        payment_mode: 'Espèces',
      },
      'SAL',
    );

    const monthly = await treasury.monthlySummary();
    expect(monthly).toHaveLength(1);
    expect(monthly[0].period).toBe('2026-09');
    expect(monthly[0].revenue).toBe(100000);
    expect(monthly[0].expenses).toBe(20000);
    expect(monthly[0].salaries).toBe(30000);
    expect(monthly[0].net).toBe(50000);

    const totals = await treasury.totals();
    expect(totals.revenue).toBe(100000);
    expect(totals.expenses).toBe(20000);
    expect(totals.salaries).toBe(30000);
    expect(totals.net).toBe(50000);
  });

  it('excludes cancelled expenses and staff payments from the summary', async () => {
    const expense = await expenses.create(
      {
        expense_date: '2026-09-10',
        description: 'Erreur',
        amount: 99999,
        payment_mode: 'Espèces',
      },
      'DEP',
    );
    await expenses.cancel(expense.id, 'Doublon');

    const monthly = await treasury.monthlySummary();
    const september = monthly.find((m) => m.period === '2026-09');
    expect(september?.expenses ?? 0).toBe(0);
  });

  it('filters the summary by a from/to period range', async () => {
    const { classLevelId } = await seedReferenceData(app);
    const student = await students.create({
      matricule: 'E011',
      full_name: 'Filtre Test',
    });
    const enrollment = await enrollments.create({
      student_id: student!.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
    });
    await payments.create(
      {
        enrollment_id: enrollment!.id,
        payment_date: '2026-08-01',
        amount: 10000,
        payment_mode: 'Espèces',
      },
      'REC',
    );
    await payments.create(
      {
        enrollment_id: enrollment!.id,
        payment_date: '2026-09-01',
        amount: 20000,
        payment_mode: 'Espèces',
      },
      'REC',
    );

    const filtered = await treasury.monthlySummary({ from: '2026-09' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].period).toBe('2026-09');
    expect(filtered[0].revenue).toBe(20000);
  });
});

describe('ReportService.overdueEnrollments', () => {
  let app: AppDatabase;
  let students: StudentService;
  let enrollments: EnrollmentService;
  let payments: PaymentService;
  let reports: ReportService;

  beforeEach(async () => {
    app = await createDatabase(':memory:');
    students = new StudentService(app.db);
    enrollments = new EnrollmentService(app.db);
    payments = new PaymentService(app.db);
    reports = new ReportService(app.db);
  });

  it('lists actively-enrolled students with a positive balance, with guardian contact and class name', async () => {
    const { classLevelId } = await seedReferenceData(app);
    const student = await students.create({
      matricule: 'E020',
      full_name: 'Impayé Test',
      guardian_name: 'Parent Test',
      guardian_phone: '699000000',
    });
    const enrollment = await enrollments.create({
      student_id: student!.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
    });
    await payments.create(
      {
        enrollment_id: enrollment!.id,
        payment_date: '2026-09-08',
        amount: 50000,
        payment_mode: 'Espèces',
      },
      'REC',
    );

    const overdue = await reports.overdueEnrollments('2026/2027');
    expect(overdue).toHaveLength(1);
    expect(overdue[0].full_name).toBe('Impayé Test');
    expect(overdue[0].class_name).toBe('Petite Section');
    expect(overdue[0].guardian_phone).toBe('699000000');
    expect(overdue[0].balance).toBe(132000);
  });

  it('excludes enrollments already fully paid', async () => {
    const { classLevelId } = await seedReferenceData(app);
    const student = await students.create({
      matricule: 'E021',
      full_name: 'Payé Test',
    });
    const enrollment = await enrollments.create({
      student_id: student!.id,
      school_year: '2026/2027',
      class_level_id: classLevelId,
    });
    await payments.create(
      {
        enrollment_id: enrollment!.id,
        payment_date: '2026-09-08',
        amount: 182000,
        payment_mode: 'Espèces',
      },
      'REC',
    );

    const overdue = await reports.overdueEnrollments('2026/2027');
    expect(overdue).toHaveLength(0);
  });
});
