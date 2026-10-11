// Migration 002 — bilingual class structure (V2 Phase C).
// Adds logical class levels with per-section display names, import aliases,
// and extends enrollment_balances with section, class_name, registration_no.
import { Kysely, sql } from 'kysely';

const ANGLOPHONE_CLASS_NAMES = new Set([
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

function slugCode(name: string, id: number): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
  return base || `L${id}`;
}

const ENROLLMENT_BALANCES_VIEW = `CREATE VIEW enrollment_balances AS
SELECT
  e.id AS enrollment_id,
  e.student_id,
  s.matricule,
  s.full_name,
  e.school_year,
  e.class_level_id,
  e.section,
  e.registration_no,
  e.expected_fee,
  COALESCE(
    (
      SELECT cll.name
      FROM class_level_labels cll
      WHERE cll.class_level_id = e.class_level_id
        AND cll.section = COALESCE(e.section, 'Francophone')
      LIMIT 1
    ),
    (
      SELECT cll.name
      FROM class_level_labels cll
      WHERE cll.class_level_id = e.class_level_id
      LIMIT 1
    ),
    cl.name
  ) AS class_name,
  COALESCE(SUM(p.amount), 0) AS total_paid,
  e.expected_fee - COALESCE(SUM(p.amount), 0) AS balance,
  CASE
    WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'Non payé'
    WHEN COALESCE(SUM(p.amount), 0) < e.expected_fee THEN 'Paiement partiel'
    WHEN COALESCE(SUM(p.amount), 0) = e.expected_fee THEN 'Payé'
    ELSE 'Trop-perçu'
  END AS status
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN class_levels cl ON cl.id = e.class_level_id
LEFT JOIN payments p ON p.enrollment_id = e.id AND p.status = 'Validé'
GROUP BY e.id`;

// Minimal schema snapshot for the typed queries below — migrations must not
// depend on the evolving application schema types.
interface MigrationDb {
  class_levels: { id: number; code: string | null; name: string };
  class_level_labels: {
    class_level_id: number;
    section: string;
    name: string;
  };
  class_name_aliases: {
    alias: string;
    class_level_id: number;
    section: string;
  };
}

export async function up(db: Kysely<unknown>): Promise<void> {
  const tdb = db as Kysely<MigrationDb>;
  await sql`ALTER TABLE class_levels ADD COLUMN code TEXT`.execute(db);

  await sql
    .raw(
      `CREATE TABLE class_level_labels (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        class_level_id INTEGER NOT NULL REFERENCES class_levels(id) ON DELETE CASCADE,
        section        TEXT NOT NULL CHECK (section IN ('Francophone','Anglophone')),
        name           TEXT NOT NULL,
        UNIQUE (class_level_id, section)
      )`,
    )
    .execute(db);

  await sql
    .raw(
      `CREATE TABLE class_name_aliases (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        alias          TEXT NOT NULL UNIQUE,
        class_level_id INTEGER NOT NULL REFERENCES class_levels(id) ON DELETE CASCADE,
        section        TEXT NOT NULL CHECK (section IN ('Francophone','Anglophone'))
      )`,
    )
    .execute(db);

  const levels = await tdb
    .selectFrom('class_levels')
    .select(['id', 'name'])
    .execute();

  for (const level of levels) {
    const code = slugCode(level.name, level.id);
    await tdb
      .updateTable('class_levels')
      .set({ code })
      .where('id', '=', level.id)
      .execute();

    const section = ANGLOPHONE_CLASS_NAMES.has(level.name)
      ? 'Anglophone'
      : 'Francophone';

    await tdb
      .insertInto('class_level_labels')
      .values({
        class_level_id: level.id,
        section,
        name: level.name,
      })
      .execute();

    await tdb
      .insertInto('class_name_aliases')
      .values({
        alias: level.name,
        class_level_id: level.id,
        section,
      })
      .execute();
  }

  await sql
    .raw(`CREATE UNIQUE INDEX idx_class_levels_code ON class_levels(code)`)
    .execute(db);

  await sql.raw('DROP VIEW IF EXISTS enrollment_balances').execute(db);
  await sql.raw(ENROLLMENT_BALANCES_VIEW).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql.raw('DROP VIEW IF EXISTS enrollment_balances').execute(db);

  await sql
    .raw(
      `CREATE VIEW enrollment_balances AS
       SELECT
         e.id AS enrollment_id, e.student_id, s.matricule, s.full_name,
         e.school_year, e.class_level_id, e.expected_fee,
         COALESCE(SUM(p.amount), 0) AS total_paid,
         e.expected_fee - COALESCE(SUM(p.amount), 0) AS balance,
         CASE
           WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'Non payé'
           WHEN COALESCE(SUM(p.amount), 0) < e.expected_fee THEN 'Paiement partiel'
           WHEN COALESCE(SUM(p.amount), 0) = e.expected_fee THEN 'Payé'
           ELSE 'Trop-perçu'
         END AS status
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       LEFT JOIN payments p ON p.enrollment_id = e.id AND p.status = 'Validé'
       GROUP BY e.id`,
    )
    .execute(db);

  await sql.raw('DROP TABLE IF EXISTS class_name_aliases').execute(db);
  await sql.raw('DROP TABLE IF EXISTS class_level_labels').execute(db);
  await sql`DROP INDEX IF EXISTS idx_class_levels_code`.execute(db);
  // SQLite cannot drop columns easily — leave code column on rollback.
}
