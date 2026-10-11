// Manages `enrollments` (one row = one student enrolled in a class for one
// school year, with the fee snapshotted at enrollment time — see
// docs/electron-app-plan.md section 4.1 for the rationale).
import type { Kysely } from 'kysely';
import type { Database, EnrollmentBalancesView } from '../db/schema-types';
import { incrementCode, schoolYearPrefix } from '../../../shared/next-code';
import { logAudit } from './AuditLog';
import { resolveClassFee, type FeeSection } from './ClassFeeService';

export interface CreateEnrollmentInput {
  student_id: number;
  school_year: string;
  class_level_id: number;
  section?: 'Francophone' | 'Anglophone' | null;
  registration_no?: string | null;
  registration_date?: string | null;
  /** Optional override; if omitted, looked up from `class_fees`. */
  expected_fee?: number;
}

export interface UpdateEnrollmentInput {
  class_level_id?: number;
  section?: 'Francophone' | 'Anglophone' | null;
  registration_no?: string | null;
  registration_date?: string | null;
  status?: 'Actif' | 'Transféré' | 'Retiré';
}

export class EnrollmentService {
  constructor(private readonly db: Kysely<Database>) {}

  async getById(id: number) {
    return this.db
      .selectFrom('enrollments')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async findForStudentAndYear(studentId: number, schoolYear: string) {
    return this.db
      .selectFrom('enrollments')
      .selectAll()
      .where('student_id', '=', studentId)
      .where('school_year', '=', schoolYear)
      .executeTakeFirst();
  }

  async listForStudent(studentId: number) {
    return this.db
      .selectFrom('enrollments')
      .selectAll()
      .where('student_id', '=', studentId)
      .orderBy('school_year', 'desc')
      .execute();
  }

  async nextRegistrationNo(schoolYear: string): Promise<string> {
    const year = schoolYearPrefix(schoolYear);
    const last = await this.db
      .selectFrom('enrollments')
      .select('registration_no')
      .where('school_year', '=', schoolYear)
      .where('registration_no', 'is not', null)
      .where('registration_no', '!=', '')
      .orderBy('id', 'desc')
      .executeTakeFirst();
    return incrementCode(last?.registration_no, `INS-${year}-001`);
  }

  async listForYear(schoolYear: string) {
    return this.db
      .selectFrom('enrollments')
      .selectAll()
      .where('school_year', '=', schoolYear)
      .execute();
  }

  private async resolveFee(
    classLevelId: number,
    schoolYear: string,
    section: FeeSection | null | undefined,
  ): Promise<number> {
    return resolveClassFee(this.db, classLevelId, schoolYear, section);
  }

  async create(input: CreateEnrollmentInput) {
    const expectedFee =
      input.expected_fee ??
      (await this.resolveFee(
        input.class_level_id,
        input.school_year,
        input.section,
      ));

    const now = new Date().toISOString();
    const result = await this.db
      .insertInto('enrollments')
      .values({
        student_id: input.student_id,
        school_year: input.school_year,
        class_level_id: input.class_level_id,
        section: input.section ?? null,
        registration_no: input.registration_no ?? null,
        registration_date: input.registration_date ?? null,
        expected_fee: expectedFee,
        status: 'Actif',
        created_at: now,
        updated_at: now,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const id = Number(result.id);
    await logAudit(this.db, {
      action: 'CREATE',
      entity: 'enrollments',
      entityId: id,
      after: input,
    });
    return this.getById(id);
  }

  async update(id: number, input: UpdateEnrollmentInput) {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Inscription introuvable (id=${id})`);
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.class_level_id !== undefined) {
      updates.class_level_id = input.class_level_id;
    }
    if (input.section !== undefined) {
      updates.section = input.section;
    }
    if (input.class_level_id !== undefined || input.section !== undefined) {
      const classLevelId = input.class_level_id ?? before.class_level_id;
      const section =
        input.section !== undefined ? input.section : before.section;
      updates.expected_fee = await this.resolveFee(
        classLevelId,
        before.school_year,
        section,
      );
    }
    if (input.registration_no !== undefined) {
      updates.registration_no = input.registration_no;
    }
    if (input.registration_date !== undefined) {
      updates.registration_date = input.registration_date;
    }
    if (input.status !== undefined) updates.status = input.status;

    await this.db
      .updateTable('enrollments')
      .set(updates)
      .where('id', '=', id)
      .execute();

    const after = await this.getById(id);
    await logAudit(this.db, {
      action: 'UPDATE',
      entity: 'enrollments',
      entityId: id,
      before,
      after,
    });
    return after;
  }

  async updateStatus(
    id: number,
    status: 'Actif' | 'Transféré' | 'Retiré',
  ): Promise<void> {
    const before = await this.getById(id);
    await this.db
      .updateTable('enrollments')
      .set({ status, updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .execute();
    const after = await this.getById(id);
    await logAudit(this.db, {
      action: 'UPDATE',
      entity: 'enrollments',
      entityId: id,
      before,
      after,
    });
  }

  /** Permanently removes an enrollment and its payments. */
  async delete(id: number): Promise<void> {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Inscription introuvable (id=${id})`);
    }

    await this.db.transaction().execute(async (trx) => {
      const payments = await trx
        .selectFrom('payments')
        .select('id')
        .where('enrollment_id', '=', id)
        .execute();
      const paymentIds = payments.map((p) => p.id);

      await trx
        .deleteFrom('payments')
        .where('enrollment_id', '=', id)
        .execute();

      if (paymentIds.length > 0) {
        await trx
          .deleteFrom('audit_log')
          .where('entity', '=', 'payments')
          .where('entity_id', 'in', paymentIds)
          .execute();
      }

      await trx
        .deleteFrom('audit_log')
        .where('entity', '=', 'enrollments')
        .where('entity_id', '=', id)
        .execute();
      await trx.deleteFrom('enrollments').where('id', '=', id).execute();
    });

    await logAudit(this.db, {
      action: 'DELETE',
      entity: 'enrollments',
      entityId: id,
      before,
    });
  }

  /** Solde par inscription — calculé via la vue `enrollment_balances`. */
  async getBalance(
    enrollmentId: number,
  ): Promise<EnrollmentBalancesView | undefined> {
    return this.db
      .selectFrom('enrollment_balances')
      .selectAll()
      .where('enrollment_id', '=', enrollmentId)
      .executeTakeFirst();
  }

  async listBalancesForYear(
    schoolYear: string,
    includeInactive = false,
  ): Promise<EnrollmentBalancesView[]> {
    const view = includeInactive
      ? 'enrollment_balances_all'
      : 'enrollment_balances';
    return this.db
      .selectFrom(view)
      .selectAll()
      .where('school_year', '=', schoolYear)
      .orderBy('full_name')
      .execute();
  }
}
