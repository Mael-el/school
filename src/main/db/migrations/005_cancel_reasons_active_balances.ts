// Migration 005 — persist cancel reasons on expenses/staff payments; split
// enrollment_balances (operational) from enrollment_balances_all (admin).
import { Kysely, sql } from 'kysely';

const BALANCE_SELECT = `SELECT
  e.id AS enrollment_id,
  e.student_id,
  s.matricule,
  s.full_name,
  e.school_year,
  e.class_level_id,
  e.section,
  e.registration_no,
  e.status AS enrollment_status,
  s.status AS student_status,
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

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE expenses ADD COLUMN cancelled_at TEXT`.execute(db);
  await sql`ALTER TABLE expenses ADD COLUMN cancelled_reason TEXT`.execute(db);
  await sql`ALTER TABLE staff_payments ADD COLUMN cancelled_at TEXT`.execute(db);
  await sql`ALTER TABLE staff_payments ADD COLUMN cancelled_reason TEXT`.execute(db);

  await sql.raw('DROP VIEW IF EXISTS enrollment_balances').execute(db);
  await sql.raw('DROP VIEW IF EXISTS enrollment_balances_all').execute(db);

  await sql
    .raw(
      `CREATE VIEW enrollment_balances_all AS
${BALANCE_SELECT}`,
    )
    .execute(db);

  await sql
    .raw(
      `CREATE VIEW enrollment_balances AS
${BALANCE_SELECT.replace(
  'GROUP BY e.id',
  "WHERE s.status = 'Actif' AND e.status = 'Actif'\nGROUP BY e.id",
)}`,
    )
    .execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql.raw('DROP VIEW IF EXISTS enrollment_balances').execute(db);
  await sql.raw('DROP VIEW IF EXISTS enrollment_balances_all').execute(db);

  await sql
    .raw(
      `CREATE VIEW enrollment_balances AS
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
GROUP BY e.id`,
    )
    .execute(db);

  // SQLite cannot drop columns easily — leave added columns in place on downgrade.
}
