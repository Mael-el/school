// CRUD for `students` (identity, independent of school year — see
// docs/electron-app-plan.md section 4.1).
import type { Kysely, Selectable } from 'kysely';
import type { Database, StudentsTable } from '../db/schema-types';
import { incrementCode } from '../../../shared/next-code';
import { logAudit } from './AuditLog';

export interface CreateStudentInput {
  matricule: string;
  full_name: string;
  gender?: 'Garçon' | 'Fille' | null;
  birth_date?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  neighborhood?: string | null;
}

export type UpdateStudentInput = Partial<CreateStudentInput>;

export class StudentService {
  constructor(private readonly db: Kysely<Database>) {}

  async list(includeArchived = false): Promise<Selectable<StudentsTable>[]> {
    let query = this.db.selectFrom('students').selectAll();
    if (!includeArchived) {
      query = query.where('status', '=', 'Actif');
    }
    return query.orderBy('full_name').execute() as unknown as Promise<
      Selectable<StudentsTable>[]
    >;
  }

  async getById(id: number) {
    return this.db
      .selectFrom('students')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async nextMatricule(): Promise<string> {
    const last = await this.db
      .selectFrom('students')
      .select('matricule')
      .orderBy('id', 'desc')
      .executeTakeFirst();
    return incrementCode(last?.matricule, 'ELV-001');
  }

  async search(query: string) {
    const like = `%${query}%`;
    return this.db
      .selectFrom('students')
      .selectAll()
      .where('status', '=', 'Actif')
      .where((eb) =>
        eb.or([eb('full_name', 'like', like), eb('matricule', 'like', like)]),
      )
      .orderBy('full_name')
      .execute();
  }

  async create(input: CreateStudentInput) {
    const now = new Date().toISOString();
    const result = await this.db
      .insertInto('students')
      .values({
        matricule: input.matricule,
        full_name: input.full_name,
        gender: input.gender ?? null,
        birth_date: input.birth_date ?? null,
        guardian_name: input.guardian_name ?? null,
        guardian_phone: input.guardian_phone ?? null,
        neighborhood: input.neighborhood ?? null,
        status: 'Actif',
        created_at: now,
        updated_at: now,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const id = Number(result.id);
    await logAudit(this.db, {
      action: 'CREATE',
      entity: 'students',
      entityId: id,
      after: input,
    });
    return this.getById(id);
  }

  async update(id: number, input: UpdateStudentInput) {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Élève introuvable (id=${id})`);
    }

    await this.db
      .updateTable('students')
      .set({ ...input, updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .execute();

    const after = await this.getById(id);
    await logAudit(this.db, {
      action: 'UPDATE',
      entity: 'students',
      entityId: id,
      before,
      after,
    });
    return after;
  }

  /** Soft-delete — marks the student as archived (Phase G). */
  async archive(id: number) {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Élève introuvable (id=${id})`);
    }
    if (before.status === 'Archivé') {
      throw new Error('Cet élève est déjà archivé.');
    }

    await this.db
      .updateTable('students')
      .set({ status: 'Archivé', updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .execute();

    const after = await this.getById(id);
    await logAudit(this.db, {
      action: 'UPDATE',
      entity: 'students',
      entityId: id,
      before,
      after,
    });
    return after;
  }

  /** Restores an archived student to active status. */
  async reactivate(id: number) {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Élève introuvable (id=${id})`);
    }
    if (before.status === 'Actif') {
      throw new Error('Cet élève est déjà actif.');
    }

    await this.db
      .updateTable('students')
      .set({ status: 'Actif', updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .execute();

    const after = await this.getById(id);
    await logAudit(this.db, {
      action: 'UPDATE',
      entity: 'students',
      entityId: id,
      before,
      after,
    });
    return after;
  }

  /** Permanently removes a student and all related enrollments and payments. */
  async delete(id: number): Promise<void> {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Élève introuvable (id=${id})`);
    }

    await this.db.transaction().execute(async (trx) => {
      const enrollments = await trx
        .selectFrom('enrollments')
        .select('id')
        .where('student_id', '=', id)
        .execute();
      const enrollmentIds = enrollments.map((e) => e.id);

      let paymentIds: number[] = [];
      if (enrollmentIds.length > 0) {
        const payments = await trx
          .selectFrom('payments')
          .select('id')
          .where('enrollment_id', 'in', enrollmentIds)
          .execute();
        paymentIds = payments.map((p) => p.id);

        await trx
          .deleteFrom('payments')
          .where('enrollment_id', 'in', enrollmentIds)
          .execute();
      }

      if (paymentIds.length > 0) {
        await trx
          .deleteFrom('audit_log')
          .where('entity', '=', 'payments')
          .where('entity_id', 'in', paymentIds)
          .execute();
      }
      if (enrollmentIds.length > 0) {
        await trx
          .deleteFrom('audit_log')
          .where('entity', '=', 'enrollments')
          .where('entity_id', 'in', enrollmentIds)
          .execute();
        await trx
          .deleteFrom('enrollments')
          .where('student_id', '=', id)
          .execute();
      }

      await trx
        .deleteFrom('audit_log')
        .where('entity', '=', 'students')
        .where('entity_id', '=', id)
        .execute();
      await trx.deleteFrom('students').where('id', '=', id).execute();
    });

    await logAudit(this.db, {
      action: 'DELETE',
      entity: 'students',
      entityId: id,
      before,
    });
  }
}
