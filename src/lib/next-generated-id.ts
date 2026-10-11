import { incrementCode, schoolYearPrefix } from '../../shared/next-code';
import { isMissingIpcHandlerError } from './print';

async function withMissingHandlerFallback<T>(
  action: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (err) {
    if (!isMissingIpcHandlerError(err)) throw err;
    return fallback();
  }
}

export async function nextStudentMatricule(): Promise<string> {
  return withMissingHandlerFallback(
    () => window.api.students.nextMatricule(),
    async () => {
      const list = await window.api.students.list();
      const last = [...list].sort((a, b) => b.id - a.id)[0];
      return incrementCode(last?.matricule, 'ELV-001');
    },
  );
}

export async function nextStaffNumber(): Promise<string> {
  return withMissingHandlerFallback(
    () => window.api.staff.nextStaffNo(),
    async () => {
      const list = await window.api.staff.list();
      const last = [...list].sort((a, b) => b.id - a.id)[0];
      return incrementCode(last?.staff_no, 'PER-001');
    },
  );
}

export async function nextRegistrationNumber(
  schoolYear: string,
): Promise<string> {
  const fallback = `INS-${schoolYearPrefix(schoolYear)}-001`;
  return withMissingHandlerFallback(
    () => window.api.enrollments.nextRegistrationNo(schoolYear),
    async () => {
      const list = await window.api.enrollments.listForYear(schoolYear);
      const last = [...list]
        .filter((row) => row.registration_no?.trim())
        .sort((a, b) => b.id - a.id)[0];
      return incrementCode(last?.registration_no, fallback);
    },
  );
}
