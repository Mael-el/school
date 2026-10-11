import { Kysely, sql } from 'kysely';

/**
 * Adds `section` to `class_fees` so Francophone and Anglophone tracks can
 * have different annual fees for the same logical level (V2).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql
    .raw(
      `CREATE TABLE class_fees_new (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        class_level_id INTEGER NOT NULL REFERENCES class_levels(id),
        school_year    TEXT NOT NULL,
        section        TEXT NOT NULL CHECK (section IN ('Francophone','Anglophone')),
        annual_fee     INTEGER NOT NULL,
        UNIQUE (class_level_id, school_year, section)
      )`,
    )
    .execute(db);

  await sql
    .raw(
      `INSERT INTO class_fees_new (class_level_id, school_year, section, annual_fee)
       SELECT class_level_id, school_year, 'Francophone', annual_fee FROM class_fees`,
    )
    .execute(db);

  await sql
    .raw(
      `INSERT INTO class_fees_new (class_level_id, school_year, section, annual_fee)
       SELECT class_level_id, school_year, 'Anglophone', annual_fee FROM class_fees`,
    )
    .execute(db);

  await sql.raw('DROP TABLE class_fees').execute(db);
  await sql.raw('ALTER TABLE class_fees_new RENAME TO class_fees').execute(db);
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // Intentional no-op — collapsing section rows is lossy.
}
