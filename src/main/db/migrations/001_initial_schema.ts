// Migration 001 — initial schema (docs/electron-app-plan.md, section 4).
// Each statement is executed individually (better-sqlite3 prepared
// statements only support a single SQL statement at a time).
import { Kysely, sql } from 'kysely';

const statements: string[] = [
  `CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  )`,
  `CREATE TABLE cashiers (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`,
  `CREATE TABLE class_levels (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL UNIQUE,
    display_order INTEGER NOT NULL
  )`,
  `CREATE TABLE class_fees (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    class_level_id INTEGER NOT NULL REFERENCES class_levels(id),
    school_year    TEXT NOT NULL,
    annual_fee     INTEGER NOT NULL,
    UNIQUE (class_level_id, school_year)
  )`,
  `CREATE TABLE payment_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
  )`,
  `CREATE TABLE students (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    matricule         TEXT UNIQUE NOT NULL,
    full_name         TEXT NOT NULL,
    gender            TEXT CHECK (gender IN ('Garçon','Fille')),
    birth_date        TEXT,
    guardian_name     TEXT,
    guardian_phone    TEXT,
    neighborhood      TEXT,
    created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at        TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE enrollments (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id        INTEGER NOT NULL REFERENCES students(id),
    registration_no    TEXT,
    school_year       TEXT NOT NULL,
    class_level_id    INTEGER NOT NULL REFERENCES class_levels(id),
    section           TEXT CHECK (section IN ('Francophone','Anglophone')),
    expected_fee      INTEGER NOT NULL,
    registration_date TEXT,
    status            TEXT NOT NULL DEFAULT 'Actif'
                       CHECK (status IN ('Actif','Transféré','Retiré')),
    created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at        TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, school_year)
  )`,
  `CREATE INDEX idx_enrollments_student ON enrollments(student_id)`,
  `CREATE INDEX idx_enrollments_class   ON enrollments(class_level_id, school_year)`,
  `CREATE TABLE counters (
    name           TEXT PRIMARY KEY,
    last_value     INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE payments (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no       TEXT UNIQUE NOT NULL,
    enrollment_id    INTEGER NOT NULL REFERENCES enrollments(id),
    payment_date     TEXT NOT NULL,
    category_id      INTEGER REFERENCES payment_categories(id),
    term             TEXT CHECK (term IN ('1er trimestre','2e trimestre','3e trimestre')),
    installment_no   INTEGER,
    amount           INTEGER NOT NULL,
    payment_mode     TEXT NOT NULL,
    transaction_ref  TEXT,
    cashier_id       INTEGER REFERENCES cashiers(id),
    note             TEXT,
    status           TEXT NOT NULL DEFAULT 'Validé'
                       CHECK (status IN ('Validé','Annulé')),
    cancelled_at     TEXT,
    cancelled_reason TEXT,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX idx_payments_enrollment ON payments(enrollment_id)`,
  `CREATE TABLE expense_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
  )`,
  `CREATE TABLE expenses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_no    TEXT UNIQUE NOT NULL,
    expense_date    TEXT NOT NULL,
    category_id     INTEGER REFERENCES expense_categories(id),
    description     TEXT NOT NULL,
    amount          INTEGER NOT NULL,
    payment_mode    TEXT NOT NULL,
    supplier_name   TEXT,
    receipt_ref     TEXT,
    approved_by     TEXT,
    note            TEXT,
    status          TEXT NOT NULL DEFAULT 'Validé'
                      CHECK (status IN ('Validé','Annulé')),
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE staff_members (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_no          TEXT UNIQUE NOT NULL,
    full_name         TEXT NOT NULL,
    role              TEXT NOT NULL,
    class_level_id    INTEGER REFERENCES class_levels(id),
    phone             TEXT,
    hire_date         TEXT,
    monthly_salary    INTEGER NOT NULL,
    status            TEXT NOT NULL DEFAULT 'Actif'
                       CHECK (status IN ('Actif','Suspendu','Sorti')),
    created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at        TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE staff_payments (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no       TEXT UNIQUE NOT NULL,
    staff_id         INTEGER NOT NULL REFERENCES staff_members(id),
    payment_date     TEXT NOT NULL,
    pay_period       TEXT NOT NULL,
    amount           INTEGER NOT NULL,
    payment_type     TEXT NOT NULL DEFAULT 'Salaire'
                       CHECK (payment_type IN ('Salaire','Avance','Prime','Autre')),
    payment_mode     TEXT NOT NULL,
    transaction_ref  TEXT,
    cashier_id       INTEGER REFERENCES cashiers(id),
    note             TEXT,
    status           TEXT NOT NULL DEFAULT 'Validé'
                       CHECK (status IN ('Validé','Annulé')),
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX idx_expenses_category    ON expenses(category_id)`,
  `CREATE INDEX idx_staff_payments_staff ON staff_payments(staff_id)`,
  `CREATE TABLE audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT NOT NULL,
    entity      TEXT NOT NULL,
    entity_id   INTEGER NOT NULL,
    before_json TEXT,
    after_json  TEXT,
    note        TEXT,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX idx_audit_log_entity ON audit_log(entity, entity_id)`,
  `CREATE INDEX idx_audit_log_date   ON audit_log(created_at)`,
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
  `CREATE VIEW staff_payments_by_period AS
   SELECT
     st.id AS staff_id, st.staff_no, st.full_name, st.monthly_salary,
     sp.pay_period,
     COALESCE(SUM(sp.amount), 0) AS total_paid_for_period
   FROM staff_members st
   LEFT JOIN staff_payments sp
     ON sp.staff_id = st.id AND sp.status = 'Validé'
   GROUP BY st.id, sp.pay_period`,
  `CREATE VIEW cashflow_summary AS
   SELECT period, 'Recette frais scolaires' AS type, SUM(amount) AS total
   FROM (
     SELECT strftime('%Y-%m', payment_date) AS period, amount
     FROM payments WHERE status = 'Validé'
   ) GROUP BY period
   UNION ALL
   SELECT period, 'Dépense' AS type, -SUM(amount) AS total
   FROM (
     SELECT strftime('%Y-%m', expense_date) AS period, amount
     FROM expenses WHERE status = 'Validé'
   ) GROUP BY period
   UNION ALL
   SELECT period, 'Salaire personnel' AS type, -SUM(amount) AS total
   FROM (
     SELECT strftime('%Y-%m', payment_date) AS period, amount
     FROM staff_payments WHERE status = 'Validé'
   ) GROUP BY period`,
];

const dropStatements: string[] = [
  'DROP VIEW IF EXISTS cashflow_summary',
  'DROP VIEW IF EXISTS staff_payments_by_period',
  'DROP VIEW IF EXISTS enrollment_balances',
  'DROP TABLE IF EXISTS audit_log',
  'DROP TABLE IF EXISTS staff_payments',
  'DROP TABLE IF EXISTS staff_members',
  'DROP TABLE IF EXISTS expenses',
  'DROP TABLE IF EXISTS expense_categories',
  'DROP TABLE IF EXISTS payments',
  'DROP TABLE IF EXISTS counters',
  'DROP TABLE IF EXISTS enrollments',
  'DROP TABLE IF EXISTS students',
  'DROP TABLE IF EXISTS payment_categories',
  'DROP TABLE IF EXISTS class_fees',
  'DROP TABLE IF EXISTS class_levels',
  'DROP TABLE IF EXISTS cashiers',
  'DROP TABLE IF EXISTS settings',
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const statement of statements) {
    await sql.raw(statement).execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const statement of dropStatements) {
    await sql.raw(statement).execute(db);
  }
}
