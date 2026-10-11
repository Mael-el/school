import type {
  ClassBalanceSummary,
  ClassLevel,
  EnrollmentBalance,
  MonthlyCollection,
  Payment,
} from './types';

/** Aggregate per-class totals from enrollment balances + class level metadata. */
export function buildClassBalanceSummaries(
  balances: EnrollmentBalance[],
  classLevels: ClassLevel[],
): ClassBalanceSummary[] {
  const nameById = new Map(classLevels.map((c) => [c.id, c.name]));
  const orderById = new Map(classLevels.map((c) => [c.id, c.display_order]));
  const byClass = new Map<number, ClassBalanceSummary>();

  for (const balance of balances) {
    const existing = byClass.get(balance.class_level_id);
    if (existing) {
      existing.expected_total += balance.expected_fee;
      existing.paid_total += balance.total_paid;
      existing.balance_total += balance.balance;
      continue;
    }

    byClass.set(balance.class_level_id, {
      class_level_id: balance.class_level_id,
      class_name:
        balance.class_name ??
        nameById.get(balance.class_level_id) ??
        `Classe ${balance.class_level_id}`,
      expected_total: balance.expected_fee,
      paid_total: balance.total_paid,
      balance_total: balance.balance,
    });
  }

  return [...byClass.values()].sort(
    (a, b) =>
      (orderById.get(a.class_level_id) ?? 0) -
      (orderById.get(b.class_level_id) ?? 0),
  );
}

/** Sum validated payments by calendar month (YYYY-MM). */
export function buildMonthlyCollections(
  payments: Payment[],
): MonthlyCollection[] {
  const byMonth = new Map<string, number>();

  for (const payment of payments) {
    if (payment.status !== 'Validé') continue;
    const month = payment.payment_date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + payment.amount);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));
}

/** Fetch all validated payments for enrollments in parallel. */
export async function fetchPaymentsForEnrollments(
  balances: EnrollmentBalance[],
): Promise<Payment[]> {
  if (balances.length === 0) return [];

  const lists = await Promise.all(
    balances.map((b) => window.api.payments.listForEnrollment(b.enrollment_id)),
  );
  return lists.flat();
}
