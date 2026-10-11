import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Receipt, UserRound } from 'lucide-react';
import type {
  EnrollmentBalance,
  OverdueEnrollment,
  Payment,
} from '../../lib/types';
import { formatDisplayDate } from '../../lib/dates';
import { fmtCurrency } from '../../lib/format';
import { ChartPanel, ChartEmptyState } from './chart-panel';

const MAX_ROWS = 6;

/** Ranked list of the largest outstanding balances for the current year. */
export function OverdueListPanel({
  overdue,
  onSeeAll,
}: {
  overdue: OverdueEnrollment[] | null;
  onSeeAll: () => void;
}) {
  const { t } = useTranslation();

  const top = useMemo(
    () =>
      overdue === null
        ? null
        : [...overdue].sort((a, b) => b.balance - a.balance).slice(0, MAX_ROWS),
    [overdue],
  );

  return (
    <ChartPanel
      title={t('dashboard.panels.overdueTitle')}
      subtitle={t('dashboard.panels.overdueSubtitle')}
    >
      {top === null ? (
        <ChartEmptyState message={t('common.loading')} />
      ) : top.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-white/50">
          <CheckCircle2 className="h-8 w-8 text-emerald-400/70" />
          {t('dashboard.panels.overdueEmpty')}
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <ul className="flex flex-col divide-y divide-white/5">
            {top.map((row) => (
              <li
                key={row.enrollment_id}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/25">
                  <UserRound className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {row.full_name}
                  </p>
                  <p className="truncate text-xs text-white/50">
                    {row.class_name} · {row.matricule}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-amber-300">
                    {fmtCurrency(row.balance)}
                  </p>
                  <p className="text-[11px] text-white/45">
                    {t('dashboard.panels.overduePaidOf', {
                      paid: fmtCurrency(row.total_paid),
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onSeeAll}
            className="mt-3 flex items-center justify-center gap-1.5 self-end rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t('dashboard.panels.seeAll')}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </ChartPanel>
  );
}

/** Feed of the most recent validated payments (student, date, amount). */
export function RecentPaymentsPanel({
  payments,
  balances,
  onSeeAll,
}: {
  payments: Payment[] | null;
  balances: EnrollmentBalance[] | null;
  onSeeAll: () => void;
}) {
  const { t } = useTranslation();

  const recent = useMemo(() => {
    if (payments === null || balances === null) return null;
    const studentByEnrollment = new Map(
      balances.map((b) => [b.enrollment_id, b]),
    );
    return payments
      .filter((p) => p.status === 'Validé')
      .sort(
        (a, b) =>
          b.payment_date.localeCompare(a.payment_date) || b.id - a.id,
      )
      .slice(0, MAX_ROWS)
      .map((p) => ({
        payment: p,
        student: studentByEnrollment.get(p.enrollment_id) ?? null,
      }));
  }, [payments, balances]);

  return (
    <ChartPanel
      title={t('dashboard.panels.recentTitle')}
      subtitle={t('dashboard.panels.recentSubtitle')}
    >
      {recent === null ? (
        <ChartEmptyState message={t('common.loading')} />
      ) : recent.length === 0 ? (
        <ChartEmptyState message={t('dashboard.panels.recentEmpty')} />
      ) : (
        <div className="flex h-full flex-col">
          <ul className="flex flex-col divide-y divide-white/5">
            {recent.map(({ payment, student }) => (
              <li key={payment.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
                  <Receipt className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {student?.full_name ?? payment.receipt_no}
                  </p>
                  <p className="truncate text-xs text-white/50">
                    {formatDisplayDate(payment.payment_date)} ·{' '}
                    {payment.payment_mode}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-emerald-300">
                  +{fmtCurrency(payment.amount)}
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onSeeAll}
            className="mt-3 flex items-center justify-center gap-1.5 self-end rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t('dashboard.panels.seeAll')}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </ChartPanel>
  );
}
