// One-off/repeatable importer: reads the legacy Excel workbook (Élèves,
// Paiements, Paramètres sheets) and populates a fresh SQLite database via
// the same services/migrations used by the Electron app, so the imported
// data goes through the exact same validation/audit/receipt-numbering
// logic as manual entry.
//
// Usage: npx tsx scripts/import-excel.ts <path-to-xlsx> <path-to-sqlite-db>
import path from 'node:path';
import ExcelJS from 'exceljs';
import { createDatabase } from '../src/main/db/connection';
import { SettingsService } from '../src/main/services/SettingsService';
import { StudentService } from '../src/main/services/StudentService';
import { EnrollmentService } from '../src/main/services/EnrollmentService';
import { PaymentService } from '../src/main/services/PaymentService';
import {
  ClassLevelService,
  type Section,
} from '../src/main/services/ClassLevelService';

type CellValue = ExcelJS.CellValue;

function asText(value: CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && 'result' in value) {
    return asText((value as { result: CellValue }).result);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asNumber(value: CellValue): number | null {
  const text = asText(value);
  if (text === null) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function asDate(value: CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && 'result' in value) {
    return asDate((value as { result: CellValue }).result);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return asText(value);
}

const GENDER_MAP: Record<string, 'Garçon' | 'Fille'> = {
  Fille: 'Fille',
  Garçon: 'Garçon',
};

const SECTION_MAP: Record<string, 'Francophone' | 'Anglophone'> = {
  Francophone: 'Francophone',
  Anglophone: 'Anglophone',
};

const ANGLOPHONE_HINTS = new Set([
  'Pre-Nursery',
  'Nursery 1',
  'Nursery 2',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
]);

function inferSection(className: string): Section {
  return ANGLOPHONE_HINTS.has(className) ? 'Anglophone' : 'Francophone';
}

const STATUS_MAP: Record<string, 'Actif' | 'Transféré' | 'Retiré'> = {
  Actif: 'Actif',
  Transféré: 'Transféré',
  Retiré: 'Retiré',
};

async function main(): Promise<void> {
  const [, , xlsxArg, dbArg] = process.argv;
  if (!xlsxArg) {
    console.error(
      'Usage: npx tsx scripts/import-excel.ts <path-to-xlsx> [db-path]',
    );
    process.exitCode = 1;
    return;
  }
  const xlsxPath = path.resolve(xlsxArg);
  const dbPath = path.resolve(
    dbArg ?? path.join(__dirname, '../import-output.sqlite'),
  );

  console.log(`Reading workbook: ${xlsxPath}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  const parametres = workbook.getWorksheet('Paramètres');
  const eleves = workbook.getWorksheet('Élèves');
  const paiements = workbook.getWorksheet('Paiements');
  if (!parametres || !eleves || !paiements) {
    throw new Error(
      'Le classeur doit contenir les feuilles Paramètres, Élèves et Paiements.',
    );
  }

  console.log(`Creating database: ${dbPath}`);
  const { db, sqlite } = await createDatabase(dbPath);
  const settings = new SettingsService(db);
  const classLevelService = new ClassLevelService(db);
  const students = new StudentService(db);
  const enrollments = new EnrollmentService(db);
  const payments = new PaymentService(db);

  const classLevelCache = new Map<string, { id: number; section: Section }>();

  async function resolveClassLevel(
    className: string,
    displayOrder: number,
  ): Promise<{ id: number; section: Section }> {
    const cached = classLevelCache.get(className);
    if (cached) return cached;

    const fromAlias = await classLevelService.resolveFromAlias(className);
    if (fromAlias) {
      const resolved = {
        id: fromAlias.class_level_id,
        section: fromAlias.section,
      };
      classLevelCache.set(className, resolved);
      return resolved;
    }

    const section = inferSection(className);
    const code = `${className.replace(/\s+/g, '_').toUpperCase().slice(0, 24)}_${displayOrder}`;
    const id = await classLevelService.upsertStructured({
      code,
      display_order: displayOrder,
      labels:
        section === 'Anglophone'
          ? { anglophone: className }
          : { francophone: className },
    });
    const resolved = { id, section };
    classLevelCache.set(className, resolved);
    return resolved;
  }

  try {
    // ---- Paramètres: settings (Information/Valeur, rows 4-15) ----
    const SETTINGS_KEY_MAP: Record<string, string> = {
      'Nom de l’école': 'school_name',
      Adresse: 'address',
      Téléphone: 'phone',
      'E-mail': 'email',
      'Année scolaire': 'current_school_year',
      Devise: 'currency',
      'Préfixe des reçus': 'receipt_prefix',
      'Nom du directeur / Directrice': 'director_name',
      'Message sur le reçu': 'receipt_message',
    };
    const cashierNames = new Set<string>();
    for (let r = 4; r <= 15; r += 1) {
      const row = parametres.getRow(r);
      const label = asText(row.getCell(1).value);
      const value = asText(row.getCell(2).value);
      if (!label) continue;
      if (label.startsWith('Caissier')) {
        if (value) cashierNames.add(value);
        continue;
      }
      const key = SETTINGS_KEY_MAP[label];
      if (key) await settings.set(key, value);
    }

    const schoolYear =
      (await settings.get('current_school_year')) ?? '2026/2027';
    const receiptPrefix = (await settings.get('receipt_prefix')) ?? 'REC';
    console.log(`School year: ${schoolYear}, receipt prefix: ${receiptPrefix}`);

    // ---- Paramètres: classes/frais annuels (Classe/Frais annuels, col D/E) ----
    let displayOrder = 0;
    for (let r = 4; r <= 21; r += 1) {
      const row = parametres.getRow(r);
      const className = asText(row.getCell(4).value);
      const annualFee = asNumber(row.getCell(5).value);
      if (!className || annualFee === null) continue;
      displayOrder += 1;

      const { id: classLevelId, section } = await resolveClassLevel(
        className,
        displayOrder,
      );

      await db
        .insertInto('class_fees')
        .values({
          class_level_id: classLevelId,
          school_year: schoolYear,
          section,
          annual_fee: annualFee,
        })
        .onConflict((oc) =>
          oc
            .columns(['class_level_id', 'school_year', 'section'])
            .doUpdateSet({ annual_fee: annualFee }),
        )
        .execute();
    }
    console.log(`Imported ${classLevelCache.size} class levels + fees.`);

    // ---- Paramètres: catégories de paiement (rows 19-28, col A/B) ----
    const categoryIdByName = new Map<string, number>();
    for (let r = 19; r <= 28; r += 1) {
      const row = parametres.getRow(r);
      const name = asText(row.getCell(1).value);
      const description = asText(row.getCell(2).value);
      if (!name) continue;
      const result = await db
        .insertInto('payment_categories')
        .values({ name, description })
        .executeTakeFirstOrThrow();
      categoryIdByName.set(name, Number(result.insertId));
    }
    console.log(`Imported ${categoryIdByName.size} payment categories.`);

    // ---- Cashiers (from settings "Caissier N" + any name found in Paiements) ----
    const cashierIdByName = new Map<string, number>();
    const ensureCashier = async (
      name: string | null,
    ): Promise<number | null> => {
      if (!name) return null;
      let id = cashierIdByName.get(name);
      if (id === undefined) {
        const result = await db
          .insertInto('cashiers')
          .values({ name })
          .executeTakeFirstOrThrow();
        id = Number(result.insertId);
        cashierIdByName.set(name, id);
      }
      return id;
    };
    for (const name of cashierNames) {
      await ensureCashier(name);
    }

    // ---- Élèves: students + enrollments (header row 3, data from row 4) ----
    let studentCount = 0;
    let enrollmentCount = 0;
    for (let r = 4; r <= eleves.rowCount; r += 1) {
      const row = eleves.getRow(r);
      const matricule = asText(row.getCell(1).value);
      if (!matricule) continue;

      const registrationNo = asText(row.getCell(2).value);
      const fullName = asText(row.getCell(3).value) ?? '';
      const genderRaw = asText(row.getCell(4).value);
      const birthDate = asDate(row.getCell(5).value);
      const className = asText(row.getCell(6).value);
      const sectionRaw = asText(row.getCell(7).value);
      const guardianName = asText(row.getCell(8).value);
      const guardianPhone = asText(row.getCell(9).value);
      const neighborhood = asText(row.getCell(10).value);
      const registrationDate = asDate(row.getCell(12).value);
      const statusRaw = asText(row.getCell(13).value);

      const student = await students.create({
        matricule,
        full_name: fullName,
        gender: genderRaw ? (GENDER_MAP[genderRaw] ?? null) : null,
        birth_date: birthDate,
        guardian_name: guardianName,
        guardian_phone: guardianPhone,
        neighborhood,
      });
      if (!student) continue;
      studentCount += 1;

      const classResolved = className
        ? await resolveClassLevel(className, displayOrder)
        : undefined;
      if (!classResolved) {
        console.warn(
          `Ligne Élèves ${r}: classe "${className}" inconnue, inscription ignorée.`,
        );
        continue;
      }

      const enrollment = await enrollments.create({
        student_id: student.id,
        school_year: schoolYear,
        class_level_id: classResolved.id,
        section: sectionRaw
          ? (SECTION_MAP[sectionRaw] ?? classResolved.section)
          : classResolved.section,
        registration_no: registrationNo,
        registration_date: registrationDate,
      });
      if (enrollment && statusRaw && STATUS_MAP[statusRaw] !== 'Actif') {
        await enrollments.updateStatus(enrollment.id, STATUS_MAP[statusRaw]);
      }
      enrollmentCount += 1;
    }
    console.log(
      `Imported ${studentCount} students, ${enrollmentCount} enrollments.`,
    );

    // ---- Paiements: payments (header row 4, data from row 5) ----
    let paymentCount = 0;
    for (let r = 5; r <= paiements.rowCount; r += 1) {
      const row = paiements.getRow(r);
      const studentName = asText(row.getCell(3).value);
      if (!studentName) continue;

      const matricule = asText(row.getCell(4).value);
      const date = asDate(row.getCell(2).value);
      const category = asText(row.getCell(6).value);
      const term = asText(row.getCell(7).value) as
        '1er trimestre' | '2e trimestre' | '3e trimestre' | null;
      const installmentNo = asNumber(row.getCell(8).value);
      const amount = asNumber(row.getCell(10).value);
      const paymentMode = asText(row.getCell(13).value) ?? 'Espèces';
      const transactionRef = asText(row.getCell(14).value);
      const cashierName = asText(row.getCell(15).value);
      const note = asText(row.getCell(16).value);

      if (!matricule || amount === null || !date) {
        console.warn(`Ligne Paiements ${r}: données incomplètes, ignorée.`);
        continue;
      }

      const student = (await students.search(matricule)).find(
        (s) => s.matricule === matricule,
      );
      if (!student) {
        console.warn(
          `Ligne Paiements ${r}: élève "${matricule}" introuvable, ignorée.`,
        );
        continue;
      }
      const enrollment = await enrollments.findForStudentAndYear(
        student.id,
        schoolYear,
      );
      if (!enrollment) {
        console.warn(
          `Ligne Paiements ${r}: inscription introuvable pour "${matricule}", ignorée.`,
        );
        continue;
      }

      const categoryId = category ? categoryIdByName.get(category) : undefined;
      const cashierId = await ensureCashier(cashierName);

      await payments.create(
        {
          enrollment_id: enrollment.id,
          payment_date: date,
          category_id: categoryId ?? null,
          term,
          installment_no: installmentNo,
          amount,
          payment_mode: paymentMode,
          transaction_ref: transactionRef,
          cashier_id: cashierId,
          note,
        },
        receiptPrefix,
      );
      paymentCount += 1;
    }
    console.log(`Imported ${paymentCount} payments.`);
  } finally {
    sqlite.close();
  }

  console.log('Import complete.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
