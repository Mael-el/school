// Read-only aggregation queries backing the Dashboard charts (see
// docs/electron-app-plan.md section 5 "Dashboard" and Phase 3 roadmap).
// Kept separate from EnrollmentService/PaymentService since these are
// cross-entity reporting queries, not single-entity CRUD.
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../db/schema-types';

export interface ClassBalanceSummary {
  class_level_id: number;
  class_name: string;
  expected_total: number;
  paid_total: number;
  balance_total: number;
}

export interface MonthlyCollection {
  /** "YYYY-MM" */
  month: string;
  total: number;
}

export interface OverdueEnrollment {
  enrollment_id: number;
  student_id: number;
  matricule: string;
  full_name: string;
  class_name: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  expected_fee: number;
  total_paid: number;
  balance: number;
}

export interface RecoveryStats {
  school_year: string;
  enrollment_count: number;
  expected_total: number;
  collected_total: number;
  balance_total: number;
  /** 0–100 percentage of expected fees collected */
  recovery_rate: number;
}

export interface YearComparisonRow {
  school_year: string;
  enrollment_count: number;
  expected_total: number;
  collected_total: number;
  recovery_rate: number;
}

export interface DashboardAlerts {
  unpaid_staff_count: number;
  pay_period: string;
  expense_month_total: number;
  expense_budget_limit: number | null;
  expense_budget_exceeded: boolean;
}

export class ReportService {
  constructor(private readonly db: Kysely<Database>) {}

  /** Totaux attendu/encaissé/solde par classe, pour une année scolaire. */
  async classBalancesForYear(
    schoolYear: string,
  ): Promise<ClassBalanceSummary[]> {
    const rows = await this.db
      .selectFrom('enrollment_balances as eb')
      .innerJoin('class_levels as cl', 'cl.id', 'eb.class_level_id')
      .select(({ fn }) => [
        'eb.class_level_id',
        'cl.name as class_name',
        'cl.display_order',
        fn.sum<number>('eb.expected_fee').as('expected_total'),
        fn.sum<number>('eb.total_paid').as('paid_total'),
      ])
      .where('eb.school_year', '=', schoolYear)
      .groupBy(['eb.class_level_id', 'cl.name', 'cl.display_order'])
      .orderBy('cl.display_order')
      .execute();

    return rows.map((r) => ({
      class_level_id: r.class_level_id,
      class_name: r.class_name,
      expected_total: Number(r.expected_total ?? 0),
      paid_total: Number(r.paid_total ?? 0),
      balance_total: Number(r.expected_total ?? 0) - Number(r.paid_total ?? 0),
    }));
  }

  /**
   * Total encaissé par mois (paiements validés uniquement), pour les
   * inscriptions d'une année scolaire donnée. Payment dates use ISO format,
   * so their year-month prefix is portable across SQLite and PostgreSQL.
   */
  async monthlyCollectionsForYear(
    schoolYear: string,
  ): Promise<MonthlyCollection[]> {
    const rows = await this.db
      .selectFrom('payments as p')
      .innerJoin('enrollments as e', 'e.id', 'p.enrollment_id')
      .select(({ fn }) => [
        sql<string>`LEFT(${sql.ref('p.payment_date')}, 7)`.as(
          'month',
        ),
        fn.sum<number>('p.amount').as('total'),
      ])
      .where('e.school_year', '=', schoolYear)
      .where('p.status', '=', 'Validé')
      .groupBy('month')
      .orderBy('month')
      .execute();

    return rows.map((r) => ({ month: r.month, total: Number(r.total ?? 0) }));
  }

  /**
   * Élèves inscrits (statut Actif) avec un solde restant positif pour une
   * année scolaire, triés par solde décroissant — alimente la liste de
   * "relances impayés" (section 10 du plan). Réutilise la vue
   * `enrollment_balances` pour le calcul du solde, en y ajoutant les
   * coordonnées du parent/tuteur et le nom de la classe (absents de la vue).
   */
  async overdueEnrollments(schoolYear: string): Promise<OverdueEnrollment[]> {
    const rows = await this.db
      .selectFrom('enrollment_balances as eb')
      .innerJoin('enrollments as e', 'e.id', 'eb.enrollment_id')
      .innerJoin('students as s', 's.id', 'eb.student_id')
      .select([
        'eb.enrollment_id',
        'eb.student_id',
        'eb.matricule',
        'eb.full_name',
        'eb.class_name',
        's.guardian_name',
        's.guardian_phone',
        'eb.expected_fee',
        'eb.total_paid',
        'eb.balance',
      ])
      .where('eb.school_year', '=', schoolYear)
      .where('e.status', '=', 'Actif')
      .where('eb.balance', '>', 0)
      .orderBy('eb.balance', 'desc')
      .execute();

    return rows.map((r) => ({
      enrollment_id: r.enrollment_id,
      student_id: r.student_id,
      matricule: r.matricule,
      full_name: r.full_name,
      class_name: r.class_name,
      guardian_name: r.guardian_name,
      guardian_phone: r.guardian_phone,
      expected_fee: Number(r.expected_fee),
      total_paid: Number(r.total_paid),
      balance: Number(r.balance),
    }));
  }

  /** Taux de recouvrement pour une année scolaire (% encaissé / attendu). */
  async recoveryStats(schoolYear: string): Promise<RecoveryStats> {
    const rows = await this.db
      .selectFrom('enrollment_balances')
      .select(({ fn }) => [
        fn.count<number>('enrollment_id').as('enrollment_count'),
        fn.sum<number>('expected_fee').as('expected_total'),
        fn.sum<number>('total_paid').as('collected_total'),
        fn.sum<number>('balance').as('balance_total'),
      ])
      .where('school_year', '=', schoolYear)
      .executeTakeFirst();

    const expected = Number(rows?.expected_total ?? 0);
    const collected = Number(rows?.collected_total ?? 0);
    const recoveryRate =
      expected > 0 ? Math.round((collected / expected) * 1000) / 10 : 100;

    return {
      school_year: schoolYear,
      enrollment_count: Number(rows?.enrollment_count ?? 0),
      expected_total: expected,
      collected_total: collected,
      balance_total: Number(rows?.balance_total ?? 0),
      recovery_rate: recoveryRate,
    };
  }

  /** Comparatif année par année (taux de recouvrement). */
  async yearOverYearComparison(): Promise<YearComparisonRow[]> {
    const rows = await this.db
      .selectFrom('enrollment_balances')
      .select(({ fn }) => [
        'school_year',
        fn.count<number>('enrollment_id').as('enrollment_count'),
        fn.sum<number>('expected_fee').as('expected_total'),
        fn.sum<number>('total_paid').as('collected_total'),
      ])
      .groupBy('school_year')
      .orderBy('school_year')
      .execute();

    return rows.map((r) => {
      const expected = Number(r.expected_total ?? 0);
      const collected = Number(r.collected_total ?? 0);
      return {
        school_year: r.school_year,
        enrollment_count: Number(r.enrollment_count ?? 0),
        expected_total: expected,
        collected_total: collected,
        recovery_rate:
          expected > 0
            ? Math.round((collected / expected) * 1000) / 10
            : 100,
      };
    });
  }

  /**
   * Alertes opérationnelles pour le tableau de bord : personnel impayé ce mois,
   * dépassement budget dépenses du mois en cours.
   */
  async dashboardAlerts(
    payPeriod: string,
    expenseMonth: string,
    expenseBudgetLimit: number | null,
  ): Promise<DashboardAlerts> {
    const staffBalances = await this.db
      .selectFrom('staff_members as st')
      .leftJoin('staff_payments as sp', (join) =>
        join
          .onRef('sp.staff_id', '=', 'st.id')
          .on('sp.pay_period', '=', payPeriod)
          .on('sp.status', '=', 'Validé'),
      )
      .select(({ fn }) => [
        'st.id',
        'st.monthly_salary',
        fn.sum<number>('sp.amount').as('paid'),
      ])
      .where('st.status', '=', 'Actif')
      .groupBy(['st.id', 'st.monthly_salary'])
      .execute();

    const unpaidStaff = staffBalances.filter((row) => {
      const paid = Number(row.paid ?? 0);
      const salary = Number(row.monthly_salary ?? 0);
      return salary > 0 && paid < salary;
    }).length;

    const expenseRow = await this.db
      .selectFrom('expenses')
      .select(({ fn }) => [fn.sum<number>('amount').as('total')])
      .where('status', '=', 'Validé')
      .where('expense_date', 'like', `${expenseMonth}%`)
      .executeTakeFirst();

    const expenseMonthTotal = Number(expenseRow?.total ?? 0);
    const exceeded =
      expenseBudgetLimit !== null &&
      expenseBudgetLimit > 0 &&
      expenseMonthTotal > expenseBudgetLimit;

    return {
      unpaid_staff_count: unpaidStaff,
      pay_period: payPeriod,
      expense_month_total: expenseMonthTotal,
      expense_budget_limit: expenseBudgetLimit,
      expense_budget_exceeded: exceeded,
    };
  }
}
