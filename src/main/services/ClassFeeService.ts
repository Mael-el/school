import type { Kysely } from 'kysely';
import type { Database } from '../db/schema-types';

export type FeeSection = 'Francophone' | 'Anglophone';

/** Resolves the annual fee for a class level, year, and section. */
export async function resolveClassFee(
  db: Kysely<Database>,
  classLevelId: number,
  schoolYear: string,
  section: FeeSection | null | undefined,
): Promise<number> {
  const candidates: FeeSection[] = section
    ? [section]
    : ['Francophone', 'Anglophone'];

  for (const candidate of candidates) {
    const row = await db
      .selectFrom('class_fees')
      .select('annual_fee')
      .where('class_level_id', '=', classLevelId)
      .where('school_year', '=', schoolYear)
      .where('section', '=', candidate)
      .executeTakeFirst();
    if (row) return row.annual_fee;
  }

  throw new Error(
    `Aucun tarif défini pour la classe ${classLevelId} (${section ?? 'section ?'}) en ${schoolYear}`,
  );
}

export async function upsertClassFee(
  db: Kysely<Database>,
  input: {
    class_level_id: number;
    school_year: string;
    section: FeeSection;
    annual_fee: number;
  },
): Promise<void> {
  await db
    .insertInto('class_fees')
    .values(input)
    .onConflict((oc) =>
      oc
        .columns(['class_level_id', 'school_year', 'section'])
        .doUpdateSet({ annual_fee: input.annual_fee }),
    )
    .execute();
}
