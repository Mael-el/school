import { fetchPaymentsForEnrollments } from './dashboard-stats';
import type {
  CashflowFilters,
  CashflowTotals,
  EnrollmentBalance,
  Expense,
  MonthlyCashflow,
  Payment,
  StaffPayment,
} from './types';

function monthInRange(month: string, filters: CashflowFilters): boolean {
  if (filters.from && month < filters.from) return false;
  if (filters.to && month > filters.to) return false;
  return true;
}

/** Pivot payments/expenses/staff payments into monthly cashflow rows. */
export function buildMonthlyCashflow(
  payments: Payment[],
  expenses: Expense[],
  staffPayments: StaffPayment[],
  filters: CashflowFilters = {},
): MonthlyCashflow[] {
  const byPeriod = new Map<string, MonthlyCashflow>();

  const ensure = (period: string): MonthlyCashflow => {
    const existing = byPeriod.get(period);
    if (existing) return existing;
    const entry: MonthlyCashflow = {
      period,
      revenue: 0,
      expenses: 0,
      salaries: 0,
      net: 0,
    };
    byPeriod.set(period, entry);
    return entry;
  };

  for (const payment of payments) {
    if (payment.status !== 'Validé') continue;
    const period = payment.payment_date.slice(0, 7);
    if (!monthInRange(period, filters)) continue;
    ensure(period).revenue += payment.amount;
  }

  for (const expense of expenses) {
    if (expense.status !== 'Validé') continue;
    const period = expense.expense_date.slice(0, 7);
    if (!monthInRange(period, filters)) continue;
    ensure(period).expenses += expense.amount;
  }

  for (const staffPayment of staffPayments) {
    if (staffPayment.status !== 'Validé') continue;
    const period = staffPayment.payment_date.slice(0, 7);
    if (!monthInRange(period, filters)) continue;
    ensure(period).salaries += staffPayment.amount;
  }

  const result = [...byPeriod.values()].sort((a, b) =>
    a.period.localeCompare(b.period),
  );
  for (const entry of result) {
    entry.net = entry.revenue - entry.expenses - entry.salaries;
  }
  return result;
}

export function buildCashflowTotals(
  monthly: MonthlyCashflow[],
): CashflowTotals {
  return monthly.reduce<CashflowTotals>(
    (acc, month) => ({
      revenue: acc.revenue + month.revenue,
      expenses: acc.expenses + month.expenses,
      salaries: acc.salaries + month.salaries,
      net: acc.net + month.net,
    }),
    { revenue: 0, expenses: 0, salaries: 0, net: 0 },
  );
}

async function fetchAllEnrollmentBalances(): Promise<EnrollmentBalance[]> {
  const schoolYears = await window.api.reference.schoolYears();
  if (schoolYears.length === 0) return [];
  const lists = await Promise.all(
    schoolYears.map((year) =>
      window.api.enrollments.listBalancesForYear(year),
    ),
  );
  return lists.flat();
}

async function tryListExpenses(filters: CashflowFilters): Promise<Expense[]> {
  try {
    return await window.api.expenses.list({
      from: filters.from ? `${filters.from}-01` : undefined,
      to: filters.to ? `${filters.to}-31` : undefined,
    });
  } catch {
    return [];
  }
}

async function tryListStaffPayments(): Promise<StaffPayment[]> {
  try {
    const staffMembers = await window.api.staff.list();
    if (staffMembers.length === 0) return [];
    const lists = await Promise.all(
      staffMembers.map((member) =>
        window.api.staff.listPaymentsForStaff(member.id),
      ),
    );
    return lists.flat();
  } catch {
    return [];
  }
}

/**
 * Load consolidated treasury data using IPC channels that exist since Phase 2
 * (students/enrollments/payments) plus optional expenses/staff when available.
 * Avoids `treasury:*` handlers so the dashboard works even when the main
 * process has not been restarted after adding Phase 8 code.
 */
export async function loadTreasuryData(
  filters: CashflowFilters = {},
): Promise<{ monthly: MonthlyCashflow[]; totals: CashflowTotals }> {
  const balances = await fetchAllEnrollmentBalances();
  const [payments, expenses, staffPayments] = await Promise.all([
    fetchPaymentsForEnrollments(balances),
    tryListExpenses(filters),
    tryListStaffPayments(),
  ]);

  const monthly = buildMonthlyCashflow(
    payments,
    expenses,
    staffPayments,
    filters,
  );
  return { monthly, totals: buildCashflowTotals(monthly) };
}
