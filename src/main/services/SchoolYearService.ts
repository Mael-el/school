// Handles the "Clôture / ouverture d'année scolaire" action (Phase 5 — see
// docs/electron-app-plan.md section 5/8): duplicates the current year's
// class fees as a starting point for the new year, then mass-re-enrolls
// students who were 'Actif' in the source year into the new year (same
// class/section — staff can still adjust manually afterwards), WITHOUT ever
// touching past years' `enrollments`/`class_fees` rows (append-only).
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema-types';
import { logAudit } from './AuditLog';
import { resolveClassFee } from './ClassFeeService';

export interface CloseoutResult {
  feesCopied: number;
  feesSkippedExisting: number;
  enrollmentsCreated: number;
  enrollmentsSkippedExisting: number;
}

export class SchoolYearService {
  constructor(private readonly db: Kysely<Database>) {}

  /** Distinct school years found across `class_fees`/`enrollments`, most
   * recent first — used to populate the "année source" dropdown. */
  async listSchoolYears(): Promise<string[]> {
    const [feeYears, enrollmentYears] = await Promise.all([
      this.db
        .selectFrom('class_fees')
        .select('school_year')
        .distinct()
        .execute(),
      this.db
        .selectFrom('enrollments')
        .select('school_year')
        .distinct()
        .execute(),
    ]);
    const years = new Set<string>();
    for (const row of feeYears) years.add(row.school_year);
    for (const row of enrollmentYears) years.add(row.school_year);
    return [...years].sort().reverse();
  }

  /**
   * Copies `class_fees` from `fromYear` to `toYear` (skipping classes that
   * already have a fee row for `toYear`, so re-running is safe), then
   * creates a new `enrollments` row for every 'Actif' enrollment in
   * `fromYear` whose student doesn't already have an enrollment in
   * `toYear` — same class/section, fee snapshotted from the just-copied
   * `class_fees` row for `toYear`.
   */
  async closeout(fromYear: string, toYear: string): Promise<CloseoutResult> {
    if (fromYear === toYear) {
      throw new Error(
        "L'année source et l'année cible doivent être différentes.",
      );
    }

    return this.db.transaction().execute(async (trx) => {
      const sourceFees = await trx
        .selectFrom('class_fees')
        .selectAll()
        .where('school_year', '=', fromYear)
        .execute();

      let feesCopied = 0;
      let feesSkippedExisting = 0;
      for (const fee of sourceFees) {
        const existing = await trx
          .selectFrom('class_fees')
          .select('id')
          .where('class_level_id', '=', fee.class_level_id)
          .where('school_year', '=', toYear)
          .where('section', '=', fee.section)
          .executeTakeFirst();
        if (existing) {
          feesSkippedExisting += 1;
          continue;
        }
        await trx
          .insertInto('class_fees')
          .values({
            class_level_id: fee.class_level_id,
            school_year: toYear,
            section: fee.section,
            annual_fee: fee.annual_fee,
          })
          .execute();
        feesCopied += 1;
      }

      const sourceEnrollments = await trx
        .selectFrom('enrollments')
        .selectAll()
        .where('school_year', '=', fromYear)
        .where('status', '=', 'Actif')
        .execute();

      let enrollmentsCreated = 0;
      let enrollmentsSkippedExisting = 0;
      const now = new Date().toISOString();
      for (const enrollment of sourceEnrollments) {
        const existing = await trx
          .selectFrom('enrollments')
          .select('id')
          .where('student_id', '=', enrollment.student_id)
          .where('school_year', '=', toYear)
          .executeTakeFirst();
        if (existing) {
          enrollmentsSkippedExisting += 1;
          continue;
        }

        let expectedFee: number;
        try {
          expectedFee = await resolveClassFee(
            trx,
            enrollment.class_level_id,
            toYear,
            enrollment.section ?? 'Francophone',
          );
        } catch {
          enrollmentsSkippedExisting += 1;
          continue;
        }

        await trx
          .insertInto('enrollments')
          .values({
            student_id: enrollment.student_id,
            school_year: toYear,
            class_level_id: enrollment.class_level_id,
            section: enrollment.section,
            registration_no: null,
            registration_date: null,
            expected_fee: expectedFee,
            status: 'Actif',
            created_at: now,
            updated_at: now,
          })
          .execute();
        enrollmentsCreated += 1;
      }

      const result: CloseoutResult = {
        feesCopied,
        feesSkippedExisting,
        enrollmentsCreated,
        enrollmentsSkippedExisting,
      };

      await logAudit(trx, {
        action: 'CREATE',
        entity: 'school_year_closeout',
        entityId: 0,
        after: { fromYear, toYear, ...result },
        note: `Clôture ${fromYear} → ${toYear}`,
      });

      return result;
    });
  }
}
