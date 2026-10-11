import type { Kysely } from 'kysely';
import type { Database } from '../db/schema-types';
import { EnrollmentService, type CreateEnrollmentInput } from './EnrollmentService';
import {
  StudentService,
  type CreateStudentInput,
} from './StudentService';

export interface RegisterStudentInput extends CreateStudentInput {
  school_year: string;
  class_level_id: number;
  section?: 'Francophone' | 'Anglophone' | null;
  registration_no?: string | null;
  registration_date?: string | null;
}

/** Atomically creates a student and their enrollment for the current year. */
export class RegistrationService {
  constructor(private readonly db: Kysely<Database>) {}

  async register(input: RegisterStudentInput) {
    if (!input.school_year?.trim()) {
      throw new Error("L'année scolaire est obligatoire pour l'inscription.");
    }
    if (!input.class_level_id) {
      throw new Error("La classe est obligatoire pour l'inscription.");
    }

    return this.db.transaction().execute(async (trx) => {
      const students = new StudentService(trx);
      const enrollments = new EnrollmentService(trx);

      const student = await students.create(input);
      if (!student) {
        throw new Error("Impossible de créer l'élève.");
      }

      const enrollmentInput: CreateEnrollmentInput = {
        student_id: student.id,
        school_year: input.school_year.trim(),
        class_level_id: input.class_level_id,
        section: input.section ?? null,
        registration_no: input.registration_no ?? null,
        registration_date: input.registration_date ?? null,
      };

      const enrollment = await enrollments.create(enrollmentInput);
      return { student, enrollment };
    });
  }
}
