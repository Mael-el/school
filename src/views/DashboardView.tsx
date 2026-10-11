import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  GraduationCap,
  HandCoins,
  Target,
  UserPlus,
  ReceiptText,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Coins,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import { StatCard } from '../components/dashboard/stat-card';
import {
  OverdueListPanel,
  RecentPaymentsPanel,
} from '../components/dashboard/side-panels';
import { ClassBalancesChart } from '../components/dashboard/class-balances-chart';
import { PaymentStatusChart } from '../components/dashboard/payment-status-chart';
import { MonthlyCollectionsChart } from '../components/dashboard/monthly-collections-chart';
import { TreasuryChart } from '../components/dashboard/treasury-chart';
import {
  buildClassBalanceSummaries,
  buildMonthlyCollections,
  fetchPaymentsForEnrollments,
} from '../lib/dashboard-stats';
import { formatDisplayDate } from '../lib/dates';
import { fmtCurrency, fmtNumber } from '../lib/format';
import { loadTreasuryData } from '../lib/treasury-stats';
import type {
  BackupStatus,
  CashflowTotals,
  ClassBalanceSummary,
  DashboardAlerts,
  EnrollmentBalance,
  MonthlyCashflow,
  MonthlyCollection,
  OverdueEnrollment,
  Payment,
  RecoveryStats,
  YearComparisonRow,
} from '../lib/types';

type ViewId = 'students' | 'enrollments' | 'payments' | 'report';

interface Branding {
  schoolName: string;
  logoDataUrl: string | null;
}

async function loadYearScopedData(schoolYear: string): Promise<{
  balances: EnrollmentBalance[];
  payments: Payment[];
  classBalances: ClassBalanceSummary[];
  monthlyCollections: MonthlyCollection[];
}> {
  const [balanceRows, classLevels] = await Promise.all([
    window.api.enrollments.listBalancesForYear(schoolYear),
    window.api.reference.classLevels(),
  ]);

  const payments = await fetchPaymentsForEnrollments(balanceRows);

  return {
    balances: balanceRows,
    payments,
    classBalances: buildClassBalanceSummaries(balanceRows, classLevels),
    monthlyCollections: buildMonthlyCollections(payments),
  };
}

export function DashboardView({
  schoolYear,
  schoolYearReady,
  isActive,
  onNavigate,
}: {
  schoolYear: string;
  schoolYearReady: boolean;
  isActive: boolean;
  onNavigate: (view: ViewId) => void;
}) {
  const { t, i18n } = useTranslation();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [balances, setBalances] = useState<EnrollmentBalance[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [overdue, setOverdue] = useState<OverdueEnrollment[] | null>(null);
  const [classBalances, setClassBalances] = useState<
    ClassBalanceSummary[] | null
  >(null);
  const [monthlyCollections, setMonthlyCollections] = useState<
    MonthlyCollection[] | null
  >(null);
  const [treasuryTotals, setTreasuryTotals] = useState<CashflowTotals | null>(
    null,
  );
  const [treasuryMonthly, setTreasuryMonthly] = useState<
    MonthlyCashflow[] | null
  >(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [recoveryStats, setRecoveryStats] = useState<RecoveryStats | null>(
    null,
  );
  const [yearComparison, setYearComparison] = useState<
    YearComparisonRow[] | null
  >(null);
  const [alerts, setAlerts] = useState<DashboardAlerts | null>(null);

  const currentPayPeriod = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const currentExpenseMonth = useMemo(
    () => currentPayPeriod.slice(0, 7),
    [currentPayPeriod],
  );

  const todayLabel = useMemo(() => {
    const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR';
    const label = new Date().toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [i18n.language]);

  const loadDashboard = useCallback(async () => {
    if (!schoolYearReady || !isActive) return;

    setLoadError(null);

    try {
      const treasury = await loadTreasuryData();
      setTreasuryTotals(treasury.totals);
      setTreasuryMonthly(treasury.monthly);

      if (!schoolYear) {
        setBalances([]);
        setPayments([]);
        setOverdue([]);
        setClassBalances([]);
        setMonthlyCollections([]);
        setRecoveryStats(null);
        setYearComparison(null);
        setAlerts(null);
        return;
      }

      const [data, recovery, comparison, dashboardAlerts, overdueRows] =
        await Promise.all([
          loadYearScopedData(schoolYear),
          window.api.reports.recoveryStats(schoolYear),
          window.api.reports.yearOverYear(),
          window.api.reports.dashboardAlerts(
            currentPayPeriod,
            currentExpenseMonth,
          ),
          window.api.reports.overdueEnrollments(schoolYear),
        ]);
      setBalances(data.balances);
      setPayments(data.payments);
      setOverdue(overdueRows);
      setClassBalances(data.classBalances);
      setMonthlyCollections(data.monthlyCollections);
      setRecoveryStats(recovery);
      setYearComparison(comparison);
      setAlerts(dashboardAlerts);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [
    schoolYear,
    schoolYearReady,
    isActive,
    currentPayPeriod,
    currentExpenseMonth,
  ]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard, refreshToken]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await window.api.settings.getBranding();
        if (!cancelled) {
          setBranding({
            schoolName: data.schoolName,
            logoDataUrl: data.logoDataUrl,
          });
        }
      } catch {
        // Branding is decorative; ignore load failures.
      }
    };
    void load();
    const unsubscribe = window.api.settings.onBrandingUpdated(() => {
      void load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await window.api.backup.getStatus();
      if (!cancelled) setBackupStatus(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  useEffect(() => {
    const refresh = () => setRefreshToken((token) => token + 1);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
    return () => {
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const enrollmentCount = balances?.length ?? null;
  const priorYearRecovery = useMemo(() => {
    if (!yearComparison || !schoolYear) return null;
    const idx = yearComparison.findIndex((y) => y.school_year === schoolYear);
    if (idx <= 0) return null;
    return yearComparison[idx - 1]?.recovery_rate ?? null;
  }, [yearComparison, schoolYear]);
  const totalCollected =
    balances === null
      ? null
      : balances.reduce((sum, b) => sum + Number(b.total_paid), 0);
  const totalOutstanding =
    balances === null
      ? null
      : balances.reduce((sum, b) => sum + Math.max(0, Number(b.balance)), 0);
  const pendingCount =
    balances === null
      ? null
      : balances.filter((b) => b.status !== 'Payé').length;

  const statusCounts = useMemo(() => {
    if (!balances) return null;
    const counts: Record<EnrollmentBalance['status'], number> = {
      Payé: 0,
      'Paiement partiel': 0,
      'Non payé': 0,
      'Trop-perçu': 0,
    };
    for (const b of balances) counts[b.status] += 1;
    return counts;
  }, [balances]);

  const yearScopedLoading =
    !schoolYearReady || (schoolYear && balances === null);

  const alertItems = useMemo(() => {
    const items: { tone: 'red' | 'amber'; text: string }[] = [];
    if (backupStatus?.overdue) {
      items.push({
        tone: 'amber',
        text: `${
          backupStatus.lastBackupAt
            ? t('dashboard.backupLast', {
                date: formatDisplayDate(backupStatus.lastBackupAt),
              })
            : t('dashboard.backupNone')
        } ${t('dashboard.backupReminder')}`,
      });
    }
    if (alerts && alerts.unpaid_staff_count > 0) {
      items.push({
        tone: 'amber',
        text: t('dashboard.alerts.unpaidStaff', {
          count: alerts.unpaid_staff_count,
          period: alerts.pay_period,
        }),
      });
    }
    if (alerts?.expense_budget_exceeded) {
      items.push({
        tone: 'red',
        text: t('dashboard.alerts.expenseBudget', {
          total: fmtCurrency(alerts.expense_month_total),
          limit: fmtCurrency(alerts.expense_budget_limit ?? 0),
        }),
      });
    }
    return items;
  }, [backupStatus, alerts, t]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero banner ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/25 via-slate-900/30 to-slate-950/40 p-6 shadow-lg shadow-black/20 backdrop-blur-xl sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-inner">
              {branding?.logoDataUrl ? (
                <img
                  src={branding.logoDataUrl}
                  alt=""
                  className="h-full w-full object-contain p-1.5"
                />
              ) : (
                <GraduationCap className="h-8 w-8 text-white/80" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-white/60">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {todayLabel}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 font-semibold text-white/85">
                  {schoolYearReady
                    ? t('dashboard.schoolYearTitle', {
                        year: schoolYear || t('common.dash'),
                      })
                    : t('dashboard.schoolYearTitle', {
                        year: t('common.ellipsis'),
                      })}
                </span>
              </div>
              <h2 className="mt-1.5 truncate text-2xl font-bold text-white sm:text-3xl">
                {branding?.schoolName ?? t('shell.fallbackSchoolName')}
              </h2>
              <p className="mt-1 text-sm text-white/65">
                {t('dashboard.welcome')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('students')}
              className="flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-colors hover:bg-white"
            >
              <UserPlus className="h-4 w-4" />
              {t('dashboard.newStudent')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              <ReceiptText className="h-4 w-4" />
              {t('dashboard.newPayment')}
            </button>
            <button
              type="button"
              onClick={() => setRefreshToken((token) => token + 1)}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              title={t('common.refreshTitle')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('common.refresh')}
            </button>
          </div>
        </div>
      </section>

      {loadError && (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {t('dashboard.loadError', { error: loadError })}
        </p>
      )}

      {!schoolYearReady && (
        <p className="text-sm text-white/60">
          {t('dashboard.loadingSchoolYear')}
        </p>
      )}

      {schoolYearReady && !schoolYear && (
        <p className="text-sm text-amber-200/90">{t('dashboard.noSchoolYear')}</p>
      )}

      {/* ── Alerts ──────────────────────────────────────────────────── */}
      {alertItems.length > 0 && (
        <section className="rounded-3xl border border-amber-400/20 bg-amber-500/[0.06] p-5 backdrop-blur-xl">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-200/90">
            <ShieldAlert className="h-4 w-4" />
            {t('dashboard.alertsTitle')}
          </h3>
          <ul className="flex flex-col gap-2">
            {alertItems.map((item, index) => (
              <li
                key={index}
                className={
                  item.tone === 'red'
                    ? 'flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-100'
                    : 'flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-100'
                }
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Year KPIs ───────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/60">
          {t('dashboard.sections.year')}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t('dashboard.cards.studentsEnrolled')}
            value={
              yearScopedLoading
                ? t('common.ellipsis')
                : fmtNumber(enrollmentCount ?? 0)
            }
            hint={t('dashboard.cards.studentsHint', {
              year: schoolYear || t('common.dash'),
            })}
            icon={Users}
            tone="sky"
            onClick={() => onNavigate('students')}
          />
          <StatCard
            label={t('dashboard.cards.collected')}
            value={
              yearScopedLoading
                ? t('common.ellipsis')
                : fmtCurrency(totalCollected ?? 0)
            }
            hint={
              recoveryStats
                ? t('dashboard.cards.collectedOf', {
                    total: fmtCurrency(recoveryStats.expected_total),
                  })
                : t('dashboard.cards.paymentsHint')
            }
            hintIcon={TrendingUp}
            icon={Wallet}
            tone="emerald"
            onClick={() => onNavigate('payments')}
          />
          <StatCard
            label={t('dashboard.cards.outstanding')}
            value={
              yearScopedLoading
                ? t('common.ellipsis')
                : fmtCurrency(totalOutstanding ?? 0)
            }
            hint={
              pendingCount === 0
                ? t('dashboard.cards.allPaid')
                : t('dashboard.cards.outstandingHint', {
                    count: pendingCount ?? 0,
                  })
            }
            hintIcon={pendingCount === 0 ? CheckCircle2 : AlertTriangle}
            icon={HandCoins}
            tone="amber"
            onClick={() => onNavigate('enrollments')}
          />
          <StatCard
            label={t('dashboard.cards.recoveryRate')}
            value={
              recoveryStats === null
                ? t('common.ellipsis')
                : `${recoveryStats.recovery_rate}%`
            }
            progress={recoveryStats?.recovery_rate ?? 0}
            hint={
              priorYearRecovery === null
                ? t('dashboard.cards.recoveryHint')
                : t('dashboard.cards.recoveryYoY', {
                    prior: priorYearRecovery,
                    delta: Math.round(
                      (recoveryStats?.recovery_rate ?? 0) - priorYearRecovery,
                    ),
                  })
            }
            icon={Target}
            tone="violet"
            onClick={() => onNavigate('payments')}
          />
        </div>
      </section>

      {/* ── Treasury ────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/60">
          {t('dashboard.treasuryGlobal')}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t('dashboard.cards.revenue')}
            value={
              treasuryTotals === null
                ? t('common.ellipsis')
                : fmtCurrency(treasuryTotals.revenue)
            }
            hint={t('dashboard.cards.revenueHint')}
            icon={TrendingUp}
            tone="emerald"
          />
          <StatCard
            label={t('dashboard.cards.expenses')}
            value={
              treasuryTotals === null
                ? t('common.ellipsis')
                : fmtCurrency(treasuryTotals.expenses)
            }
            hint={t('dashboard.cards.expensesHint')}
            icon={TrendingDown}
            tone="rose"
          />
          <StatCard
            label={t('dashboard.cards.staff')}
            value={
              treasuryTotals === null
                ? t('common.ellipsis')
                : fmtCurrency(treasuryTotals.salaries)
            }
            hint={t('dashboard.cards.staffHint')}
            icon={Coins}
            tone="amber"
          />
          <StatCard
            label={t('dashboard.cards.netBalance')}
            value={
              treasuryTotals === null
                ? t('common.ellipsis')
                : fmtCurrency(treasuryTotals.net)
            }
            hint={t('dashboard.cards.netBalanceHint')}
            icon={Scale}
            tone={
              treasuryTotals !== null && treasuryTotals.net < 0
                ? 'rose'
                : 'emerald'
            }
          />
        </div>
      </section>

      {/* ── Analytics ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">
          {t('dashboard.sections.analytics')}
        </h3>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ClassBalancesChart data={yearScopedLoading ? null : classBalances} />
          <PaymentStatusChart counts={yearScopedLoading ? null : statusCounts} />
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <MonthlyCollectionsChart
            data={yearScopedLoading ? null : monthlyCollections}
          />
          <OverdueListPanel
            overdue={yearScopedLoading ? null : overdue}
            onSeeAll={() => onNavigate('report')}
          />
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <TreasuryChart data={treasuryMonthly} />
          <RecentPaymentsPanel
            payments={yearScopedLoading ? null : payments}
            balances={yearScopedLoading ? null : balances}
            onSeeAll={() => onNavigate('payments')}
          />
        </div>
      </section>
    </div>
  );
}
