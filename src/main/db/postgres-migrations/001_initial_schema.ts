import { Kysely, sql } from 'kysely';

const statements = [
  `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE cashiers (id SERIAL PRIMARY KEY, name TEXT NOT NULL)`,
  `CREATE TABLE class_levels (
    id SERIAL PRIMARY KEY, code TEXT UNIQUE, name TEXT NOT NULL UNIQUE,
    display_order INTEGER NOT NULL
  )`,
  `CREATE TABLE class_level_labels (
    id SERIAL PRIMARY KEY, class_level_id INTEGER NOT NULL REFERENCES class_levels(id) ON DELETE CASCADE,
    section TEXT NOT NULL CHECK (section IN ('Francophone','Anglophone')),
    name TEXT NOT NULL, UNIQUE (class_level_id, section)
  )`,
  `CREATE TABLE class_name_aliases (
    id SERIAL PRIMARY KEY, alias TEXT NOT NULL UNIQUE,
    class_level_id INTEGER NOT NULL REFERENCES class_levels(id) ON DELETE CASCADE,
    section TEXT NOT NULL CHECK (section IN ('Francophone','Anglophone'))
  )`,
  `CREATE TABLE class_fees (
    id SERIAL PRIMARY KEY, class_level_id INTEGER NOT NULL REFERENCES class_levels(id),
    school_year TEXT NOT NULL,
    section TEXT NOT NULL CHECK (section IN ('Francophone','Anglophone')),
    annual_fee INTEGER NOT NULL, UNIQUE (class_level_id, school_year, section)
  )`,
  `CREATE TABLE payment_categories (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT
  )`,
  `CREATE TABLE students (
    id SERIAL PRIMARY KEY, matricule TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('Garçon','Fille')), birth_date TEXT,
    guardian_name TEXT, guardian_phone TEXT, neighborhood TEXT,
    status TEXT NOT NULL DEFAULT 'Actif' CHECK (status IN ('Actif','Archivé')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text
  )`,
  `CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id),
    registration_no TEXT, school_year TEXT NOT NULL,
    class_level_id INTEGER NOT NULL REFERENCES class_levels(id),
    section TEXT CHECK (section IN ('Francophone','Anglophone')),
    expected_fee INTEGER NOT NULL, registration_date TEXT,
    status TEXT NOT NULL DEFAULT 'Actif' CHECK (status IN ('Actif','Transféré','Retiré')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text, UNIQUE (student_id, school_year)
  )`,
  `CREATE INDEX idx_enrollments_student ON enrollments(student_id)`,
  `CREATE INDEX idx_enrollments_class ON enrollments(class_level_id, school_year)`,
  `CREATE TABLE counters (name TEXT PRIMARY KEY, last_value INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE payments (
    id SERIAL PRIMARY KEY, receipt_no TEXT UNIQUE NOT NULL,
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id), payment_date TEXT NOT NULL,
    category_id INTEGER REFERENCES payment_categories(id),
    term TEXT CHECK (term IN ('1er trimestre','2e trimestre','3e trimestre')),
    installment_no INTEGER, amount INTEGER NOT NULL, payment_mode TEXT NOT NULL,
    transaction_ref TEXT, cashier_id INTEGER REFERENCES cashiers(id), note TEXT,
    status TEXT NOT NULL DEFAULT 'Validé' CHECK (status IN ('Validé','Annulé')),
    cancelled_at TEXT, cancelled_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
  )`,
  `CREATE INDEX idx_payments_enrollment ON payments(enrollment_id)`,
  `CREATE TABLE expense_categories (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT
  )`,
  `CREATE TABLE expenses (
    id SERIAL PRIMARY KEY, reference_no TEXT UNIQUE NOT NULL, expense_date TEXT NOT NULL,
    category_id INTEGER REFERENCES expense_categories(id), description TEXT NOT NULL,
    amount INTEGER NOT NULL, payment_mode TEXT NOT NULL, supplier_name TEXT,
    receipt_ref TEXT, approved_by TEXT, note TEXT,
    status TEXT NOT NULL DEFAULT 'Validé' CHECK (status IN ('Validé','Annulé')),
    cancelled_at TEXT, cancelled_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
  )`,
  `CREATE TABLE staff_members (
    id SERIAL PRIMARY KEY, staff_no TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL,
    role TEXT NOT NULL, class_level_id INTEGER REFERENCES class_levels(id),
    phone TEXT, hire_date TEXT, monthly_salary INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Actif' CHECK (status IN ('Actif','Suspendu','Sorti')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text
  )`,
  `CREATE TABLE staff_payments (
    id SERIAL PRIMARY KEY, receipt_no TEXT UNIQUE NOT NULL,
    staff_id INTEGER NOT NULL REFERENCES staff_members(id), payment_date TEXT NOT NULL,
    pay_period TEXT NOT NULL, amount INTEGER NOT NULL,
    payment_type TEXT NOT NULL DEFAULT 'Salaire' CHECK (payment_type IN ('Salaire','Avance','Prime','Autre')),
    payment_mode TEXT NOT NULL, transaction_ref TEXT, cashier_id INTEGER REFERENCES cashiers(id),
    note TEXT, status TEXT NOT NULL DEFAULT 'Validé' CHECK (status IN ('Validé','Annulé')),
    cancelled_at TEXT, cancelled_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
  )`,
  `CREATE INDEX idx_expenses_category ON expenses(category_id)`,
  `CREATE INDEX idx_staff_payments_staff ON staff_payments(staff_id)`,
  `CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY, action TEXT NOT NULL, entity TEXT NOT NULL,
    entity_id INTEGER NOT NULL, before_json TEXT, after_json TEXT, note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
  )`,
  `CREATE INDEX idx_audit_log_entity ON audit_log(entity, entity_id)`,
  `CREATE INDEX idx_audit_log_date ON audit_log(created_at)`,
  `CREATE VIEW enrollment_balances_all AS
    SELECT e.id AS enrollment_id, e.student_id, s.matricule, s.full_name,
      e.school_year, e.class_level_id, e.section, e.registration_no,
      e.status AS enrollment_status, s.status AS student_status, e.expected_fee,
      COALESCE((SELECT cll.name FROM class_level_labels cll
        WHERE cll.class_level_id=e.class_level_id
          AND cll.section=COALESCE(e.section,'Francophone') LIMIT 1),
        (SELECT cll.name FROM class_level_labels cll
          WHERE cll.class_level_id=e.class_level_id LIMIT 1), cl.name) AS class_name,
      COALESCE(SUM(p.amount),0) AS total_paid,
      e.expected_fee-COALESCE(SUM(p.amount),0) AS balance,
      CASE WHEN COALESCE(SUM(p.amount),0)=0 THEN 'Non payé'
        WHEN COALESCE(SUM(p.amount),0)<e.expected_fee THEN 'Paiement partiel'
        WHEN COALESCE(SUM(p.amount),0)=e.expected_fee THEN 'Payé'
        ELSE 'Trop-perçu' END AS status
    FROM enrollments e JOIN students s ON s.id=e.student_id
    JOIN class_levels cl ON cl.id=e.class_level_id
    LEFT JOIN payments p ON p.enrollment_id=e.id AND p.status='Validé'
    GROUP BY e.id, s.id, cl.id`,
  `CREATE VIEW enrollment_balances AS
    SELECT * FROM enrollment_balances_all
    WHERE student_status='Actif' AND enrollment_status='Actif'`,
  `CREATE VIEW staff_payments_by_period AS
    SELECT st.id AS staff_id, st.staff_no, st.full_name, st.monthly_salary,
      sp.pay_period, COALESCE(SUM(sp.amount),0) AS total_paid_for_period
    FROM staff_members st LEFT JOIN staff_payments sp
      ON sp.staff_id=st.id AND sp.status='Validé'
    GROUP BY st.id, sp.pay_period`,
  `CREATE VIEW cashflow_summary AS
    SELECT period, 'Recette frais scolaires' AS type, SUM(amount) AS total
      FROM (SELECT LEFT(payment_date,7) AS period, amount FROM payments
        WHERE status='Validé') t GROUP BY period
    UNION ALL
    SELECT period, 'Dépense' AS type, -SUM(amount) AS total
      FROM (SELECT LEFT(expense_date,7) AS period, amount FROM expenses
        WHERE status='Validé') t GROUP BY period
    UNION ALL
    SELECT period, 'Salaire personnel' AS type, -SUM(amount) AS total
      FROM (SELECT LEFT(payment_date,7) AS period, amount FROM staff_payments
        WHERE status='Validé') t GROUP BY period`,
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const statement of statements) {
    await sql.raw(statement).execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP VIEW IF EXISTS cashflow_summary`.execute(db);
  await sql`DROP VIEW IF EXISTS staff_payments_by_period`.execute(db);
  await sql`DROP VIEW IF EXISTS enrollment_balances`.execute(db);
  await sql`DROP VIEW IF EXISTS enrollment_balances_all`.execute(db);
  for (const table of [
    'audit_log',
    'staff_payments',
    'staff_members',
    'expenses',
    'expense_categories',
    'payments',
    'counters',
    'enrollments',
    'students',
    'payment_categories',
    'class_fees',
    'class_name_aliases',
    'class_level_labels',
    'class_levels',
    'cashiers',
    'settings',
  ]) {
    await sql.raw(`DROP TABLE IF EXISTS ${table} CASCADE`).execute(db);
  }
}
