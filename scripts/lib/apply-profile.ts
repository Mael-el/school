import type { Kysely } from 'kysely';
import type { Database } from '../../src/main/db/schema-types';
import { TEMPLATE_DEFAULT_SETTINGS } from '../../shared/school-defaults';
import { SettingsService } from '../../src/main/services/SettingsService';
import { StudentService } from '../../src/main/services/StudentService';
import { EnrollmentService } from '../../src/main/services/EnrollmentService';
import { PaymentService } from '../../src/main/services/PaymentService';
import { ExpenseService } from '../../src/main/services/ExpenseService';
import { StaffService } from '../../src/main/services/StaffService';
import {
  ClassLevelService,
  type Section,
} from '../../src/main/services/ClassLevelService';
import { upsertClassFee } from '../../src/main/services/ClassFeeService';
import { incrementCode, schoolYearPrefix } from '../../shared/next-code';
import type {
  ProfileClassLevel,
  ProfileExpense,
  ProfileStaffMember,
  SchoolProfile,
} from './profile-types';

const FIRST_NAMES = [
  'Amina',
  'Junior',
  'Chantal',
  'Paul',
  'Fatima',
  'Blaise',
  'Sandrine',
  'Michel',
  'Aïcha',
  'Serge',
  'Nadège',
  'Yves',
  'Grace',
  'Alain',
  'Rosine',
  'Franck',
  'Divine',
  'Hervé',
  'Carine',
  'Cyrille',
  'Vanessa',
  'Bruno',
  'Estelle',
  'Patrick',
  'Sylvie',
  'Armand',
  'Nadia',
  'Georges',
  'Clarisse',
  'Emmanuel',
  'Bernadette',
  'Thierry',
];

const LAST_NAMES = [
  'Bello',
  'Fotso',
  'Njikam',
  'Mballa',
  'Kamga',
  'Tchoumi',
  'Ngoumou',
  'Belinga',
  'Essomba',
  'Fonkou',
  'Nkolo',
  'Talla',
  'Wandji',
  'Zambo',
  'Djoumessi',
];

const NEIGHBORHOODS = [
  'Baladji',
  'Dang',
  'Joli-Soir',
  'Sabongari',
  'Mardock',
  'Bamyanga',
  'Burkina',
  'Haoussa',
];

const PAYMENT_MODES = [
  'Espèces',
  'MTN Mobile Money',
  'Orange Money',
  'Virement bancaire',
  'Chèque',
];

type Term = '1er trimestre' | '2e trimestre' | '3e trimestre';

type Status = 'Payé' | 'Paiement partiel' | 'Non payé' | 'Trop-perçu';
const STATUS_CYCLE: Status[] = [
  'Payé',
  'Paiement partiel',
  'Non payé',
  'Trop-perçu',
];

function sectionsForLevel(level: ProfileClassLevel): Section[] {
  if (level.labels) {
    const sections: Section[] = [];
    if (level.labels.francophone?.trim()) sections.push('Francophone');
    if (level.labels.anglophone?.trim()) sections.push('Anglophone');
    return sections;
  }
  return [level.section ?? 'Francophone'];
}

function feeForSection(
  level: ProfileClassLevel,
  section: Section,
): number | undefined {
  if (level.fees) {
    const amount =
      section === 'Francophone'
        ? level.fees.francophone
        : level.fees.anglophone;
    if (amount !== undefined) return amount;
  }
  return level.fee;
}

function feeRowsForLevel(
  level: ProfileClassLevel,
): Array<{ section: Section; fee: number }> {
  return sectionsForLevel(level).flatMap((section) => {
    const fee = feeForSection(level, section);
    if (fee === undefined) return [];
    return [{ section, fee }];
  });
}

function normalizedLevel(level: ProfileClassLevel, index: number): {
  code: string;
  display_order: number;
  fee: number;
  labels: { francophone?: string; anglophone?: string };
} {
  if (level.labels || level.code) {
    return {
      code: level.code ?? `L${level.display_order}`,
      display_order: level.display_order,
      fee: level.fee,
      labels: level.labels ?? {},
    };
  }
  const name = level.name ?? `Classe ${index + 1}`;
  const section = level.section ?? 'Francophone';
  return {
    code: level.code ?? name.replace(/\s+/g, '_').toUpperCase(),
    display_order: level.display_order,
    fee: level.fee,
    labels:
      section === 'Anglophone'
        ? { anglophone: name }
        : { francophone: name },
  };
}

function currentIsoMonth(reference = new Date()): string {
  const month = String(reference.getMonth() + 1).padStart(2, '0');
  return `${reference.getFullYear()}-${month}`;
}

function termForDate(isoDate: string): Term {
  const month = Number(isoDate.slice(5, 7));
  if (month >= 9 || month <= 11) return '1er trimestre';
  if (month <= 2 || month === 12) return '2e trimestre';
  return '3e trimestre';
}

async function ensureNamedRow(
  db: Kysely<Database>,
  table: 'cashiers' | 'payment_categories' | 'expense_categories',
  name: string,
): Promise<number> {
  const existing = await db
    .selectFrom(table)
    .select('id')
    .where('name', '=', name)
    .executeTakeFirst();
  if (existing) return existing.id;

  const values =
    table === 'cashiers'
      ? { name }
      : { name, description: null };
  const result = await db
    .insertInto(table)
    .values(values)
    .executeTakeFirstOrThrow();
  return Number(result.insertId);
}

export async function resetTransactionalData(
  db: Kysely<Database>,
): Promise<void> {
  await db.deleteFrom('staff_payments').execute();
  await db.deleteFrom('expenses').execute();
  await db.deleteFrom('payments').execute();
  await db.deleteFrom('enrollments').execute();
  await db.deleteFrom('class_fees').execute();
  await db.deleteFrom('class_name_aliases').execute();
  await db.deleteFrom('class_level_labels').execute();
  await db.deleteFrom('staff_members').execute();
  await db.deleteFrom('class_levels').execute();
  await db.deleteFrom('students').execute();
  await db.deleteFrom('expense_categories').execute();
  await db.deleteFrom('cashiers').execute();
  await db.deleteFrom('payment_categories').execute();
  await db.deleteFrom('counters').execute();
  await db.deleteFrom('audit_log').execute();
}

export interface ApplyProfileResult {
  classCount: number;
  studentCount: number;
  enrollmentCount: number;
  paymentCount: number;
  staffCount: number;
  staffPaymentCount: number;
  expenseCount: number;
  settingCount: number;
}

async function seedStaffAndSalaries(
  db: Kysely<Database>,
  profile: SchoolProfile,
  cashierIds: number[],
): Promise<{ staffCount: number; staffPaymentCount: number }> {
  const staffRows = profile.staff ?? [];
  if (staffRows.length === 0) {
    return { staffCount: 0, staffPaymentCount: 0 };
  }

  const staff = new StaffService(db);
  const prefix =
    profile.settings.staff_receipt_prefix ??
    TEMPLATE_DEFAULT_SETTINGS.staff_receipt_prefix ??
    'SAL';
  const period = currentIsoMonth();
  const today = new Date().toISOString().slice(0, 10);
  let staffPaymentCount = 0;

  for (const [index, member] of staffRows.entries()) {
    const created = await staff.create({
      staff_no: member.staff_no,
      full_name: member.full_name,
      role: member.role,
      phone: member.phone ?? null,
      hire_date: member.hire_date ?? null,
      monthly_salary: member.monthly_salary,
    });

    const payments: ProfileStaffMember['payments'] =
      member.payments ??
      (index < staffRows.length - 1
        ? [{ pay_period: period, amount: member.monthly_salary }]
        : []);

    for (const payment of payments ?? []) {
      await staff.createPayment(
        {
          staff_id: created.id,
          payment_date: payment.payment_date ?? today,
          pay_period: payment.pay_period,
          amount: payment.amount ?? member.monthly_salary,
          payment_type: payment.payment_type ?? 'Salaire',
          payment_mode:
            payment.payment_mode ??
            PAYMENT_MODES[index % PAYMENT_MODES.length],
          cashier_id:
            cashierIds.length > 0
              ? cashierIds[index % cashierIds.length]
              : null,
        },
        prefix,
      );
      staffPaymentCount += 1;
    }
  }

  return { staffCount: staffRows.length, staffPaymentCount };
}

async function seedExpenses(
  db: Kysely<Database>,
  profile: SchoolProfile,
  categoryIdsByName: Map<string, number>,
): Promise<number> {
  const rows: ProfileExpense[] = profile.expenses ?? [];
  if (rows.length === 0) return 0;

  const expenses = new ExpenseService(db);
  const prefix =
    profile.settings.expense_reference_prefix ??
    TEMPLATE_DEFAULT_SETTINGS.expense_reference_prefix ??
    'DEP';
  const approver =
    profile.settings.expense_approver_name ??
    profile.settings.director_name ??
    null;

  let count = 0;
  for (const row of rows) {
    await expenses.create(
      {
        expense_date: row.expense_date,
        category_id: categoryIdsByName.get(row.category) ?? null,
        description: row.description,
        amount: row.amount,
        payment_mode: row.payment_mode ?? 'Espèces',
        supplier_name: row.supplier_name ?? null,
        receipt_ref: row.receipt_ref ?? null,
        approved_by: row.approved_by ?? approver,
        note: row.note ?? null,
      },
      prefix,
    );
    count += 1;
  }
  return count;
}

export async function applySchoolProfile(
  db: Kysely<Database>,
  profile: SchoolProfile,
  options: { reset: boolean },
): Promise<ApplyProfileResult> {
  const settings = new SettingsService(db);
  const classLevels = new ClassLevelService(db);
  const students = new StudentService(db);
  const enrollments = new EnrollmentService(db);
  const payments = new PaymentService(db);

  if (options.reset) {
    await resetTransactionalData(db);
  }

  const mergedSettings = {
    ...TEMPLATE_DEFAULT_SETTINGS,
    ...profile.settings,
  };
  await settings.setMany(mergedSettings);

  const cashierIds: number[] = [];
  for (const name of profile.cashiers ?? []) {
    cashierIds.push(await ensureNamedRow(db, 'cashiers', name));
  }

  const categoryIds: number[] = [];
  for (const name of profile.paymentCategories ?? []) {
    categoryIds.push(await ensureNamedRow(db, 'payment_categories', name));
  }

  const expenseCategoryIds = new Map<string, number>();
  for (const name of profile.expenseCategories ?? []) {
    expenseCategoryIds.set(
      name,
      await ensureNamedRow(db, 'expense_categories', name),
    );
  }

  const schoolYear =
    profile.demo?.school_year ??
    mergedSettings.current_school_year ??
    (await settings.get('current_school_year')) ??
    '2026/2027';
  const receiptPrefix = mergedSettings.receipt_prefix ?? 'REC';
  const matriculePrefix =
    profile.demo?.matricule_prefix ?? receiptPrefix ?? 'ELV';
  const firstNamesFr = profile.demo?.first_names ?? FIRST_NAMES;
  const firstNamesEn =
    profile.demo?.first_names_anglophone ?? firstNamesFr;
  const lastNames = profile.demo?.last_names ?? LAST_NAMES;
  const neighborhoods = profile.demo?.neighborhoods ?? NEIGHBORHOODS;

  let lastMatricule: string | null = null;
  let lastRegistrationNo: string | null = null;
  let studentCount = 0;
  let enrollmentCount = 0;
  let paymentCount = 0;

  const existingStudent = await db
    .selectFrom('students')
    .select('id')
    .executeTakeFirst();
  const studentsPerClass = profile.demo?.students_per_class ?? 0;
  const seedStudents =
    Boolean(profile.demo) &&
    studentsPerClass > 0 &&
    (options.reset || !existingStudent);

  for (const [index, rawLevel] of profile.classLevels.entries()) {
    const level = normalizedLevel(rawLevel, index);
    const classLevelId = await classLevels.upsertStructured({
      code: level.code,
      display_order: level.display_order,
      labels: level.labels,
    });

    for (const { section, fee } of feeRowsForLevel(rawLevel)) {
      await upsertClassFee(db, {
        class_level_id: classLevelId,
        school_year: schoolYear,
        section,
        annual_fee: fee,
      });
    }

    if (!seedStudents) continue;

    for (const section of sectionsForLevel(rawLevel)) {
      for (let i = 0; i < studentsPerClass; i += 1) {
        const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
        const firstPool = section === 'Anglophone' ? firstNamesEn : firstNamesFr;
        const firstName =
          firstPool[(level.display_order * 3 + i) % firstPool.length];
        const lastName =
          lastNames[(level.display_order * 5 + i) % lastNames.length];
        const matricule = incrementCode(
          lastMatricule,
          `${matriculePrefix}-001`,
        );
        lastMatricule = matricule;
        const birthYear = 2019 - ((level.display_order + i) % 8);
        const birthMonth = String(((i * 3 + level.display_order) % 12) + 1).padStart(
          2,
          '0',
        );

        const student = await students.create({
          matricule,
          full_name: `${firstName} ${lastName}`,
          gender: i % 2 === 0 ? 'Fille' : 'Garçon',
          birth_date: `${birthYear}-${birthMonth}-12`,
          guardian_name: `Parent de ${firstName}`,
          guardian_phone: `6${String(70000000 + studentCount + 1).slice(-8)}`,
          neighborhood:
            neighborhoods[(level.display_order + i) % neighborhoods.length],
        });
        if (!student) continue;
        studentCount += 1;

        const registrationNo = incrementCode(
          lastRegistrationNo,
          `INS-${schoolYearPrefix(schoolYear)}-001`,
        );
        lastRegistrationNo = registrationNo;

        const levelFee = feeForSection(rawLevel, section);
        const enrollment = await enrollments.create({
          student_id: student.id,
          school_year: schoolYear,
          class_level_id: classLevelId,
          section,
          registration_no: registrationNo,
          registration_date: `${schoolYear.slice(0, 4)}-09-02`,
          expected_fee: levelFee,
        });
        if (!enrollment) continue;
        enrollmentCount += 1;

        const fee = levelFee ?? level.fee;
        let schedule: Array<{ date: string; amount: number }> = [];
        if (status === 'Payé') {
          schedule = [
            {
              date: `${schoolYear.slice(0, 4)}-09-10`,
              amount: Math.round(fee * 0.5),
            },
            {
              date: `${schoolYear.slice(0, 4)}-11-15`,
              amount: fee - Math.round(fee * 0.5),
            },
          ];
        } else if (status === 'Paiement partiel') {
          schedule = [
            {
              date: `${schoolYear.slice(0, 4)}-10-05`,
              amount: Math.round(fee * 0.4),
            },
          ];
        } else if (status === 'Trop-perçu') {
          schedule = [
            {
              date: `${schoolYear.slice(0, 4)}-09-12`,
              amount: Math.round(fee * 0.6),
            },
            {
              date: `${schoolYear.slice(0, 4)}-12-20`,
              amount: fee - Math.round(fee * 0.6) + 5000,
            },
          ];
        }

        const cashierId =
          cashierIds.length > 0
            ? cashierIds[(level.display_order + i) % cashierIds.length]
            : undefined;
        const categoryId =
          categoryIds.length > 0
            ? categoryIds[(level.display_order + i) % categoryIds.length]
            : undefined;
        const paymentMode =
          PAYMENT_MODES[(level.display_order + i) % PAYMENT_MODES.length];

        for (const [installment, { date, amount }] of schedule.entries()) {
          if (amount <= 0) continue;
          await payments.create(
            {
              enrollment_id: enrollment.id,
              payment_date: date,
              category_id: categoryId,
              term: termForDate(date),
              installment_no: installment + 1,
              amount,
              payment_mode: paymentMode,
              cashier_id: cashierId,
            },
            receiptPrefix,
          );
          paymentCount += 1;
        }
      }
    }
  }

  const existingStaff = await db
    .selectFrom('staff_members')
    .select('id')
    .executeTakeFirst();
  const shouldSeedOps = options.reset || !existingStaff;
  let staffCount = 0;
  let staffPaymentCount = 0;
  let expenseCount = 0;
  if (shouldSeedOps) {
    const staffResult = await seedStaffAndSalaries(db, profile, cashierIds);
    staffCount = staffResult.staffCount;
    staffPaymentCount = staffResult.staffPaymentCount;
    expenseCount = await seedExpenses(db, profile, expenseCategoryIds);
  }

  return {
    classCount: profile.classLevels.length,
    studentCount,
    enrollmentCount,
    paymentCount,
    staffCount,
    staffPaymentCount,
    expenseCount,
    settingCount: Object.keys(mergedSettings).length,
  };
}
