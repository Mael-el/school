// Écran "Rapport élève" (Phase 4 — see docs/electron-app-plan.md section
// 5/8): sélection d'un élève inscrit pour l'année scolaire courante, puis
// relevé complet (identité, classe, historique des paiements, solde) avec
// génération PDF via `webContents.printToPDF` (voir PrintService côté main).
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { FileText, Printer, UserRound } from 'lucide-react';
import type {
  EnrollmentBalance,
  OverdueEnrollment,
  Payment,
} from '../lib/types';
import { Button } from '../components/ui/button';
import { Combobox } from '../components/ui/combobox';
import { Card, CardContent } from '../components/ui/card';
import { DataGrid } from '../components/ui/data-grid';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import {
  PageToolbar,
  TableSearchField,
  ToolbarField,
} from '../components/ui/page-toolbar';
import { PaymentStatusBadge } from '../components/ui/payment-status-badge';
import { PageIntro } from '../components/ui/page-intro';
import { StatusPill, transactionTone } from '../components/ui/status-pill';
import { StudentBalancePreview } from '../components/ui/student-balance-preview';
import { invokePrint, printErrorMessage } from '../lib/print';
import { OverdueReminders } from '../components/reports/overdue-reminders';
import { fmtCurrency } from '../lib/format';
import {
  translatePaymentMode,
  translateSection,
  translateTransactionStatus,
} from '../lib/i18n-domain';
import { cancelReasonColumnDef } from '../components/ui/cancel-reason-cell';

export function ReportView({ schoolYear }: { schoolYear: string }) {
  const { t } = useTranslation();
  const [balances, setBalances] = useState<EnrollmentBalance[]>([]);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentQuery, setPaymentQuery] = useState('');
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overdue, setOverdue] = useState<OverdueEnrollment[]>([]);
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const name = await window.api.settings.get('school_name');
      if (!cancelled) setSchoolName(name?.trim() || t('report.fallbackSchool'));
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!schoolYear) {
        setBalances([]);
        return;
      }
      const list = await window.api.enrollments.listBalancesForYear(schoolYear);
      if (!cancelled) setBalances(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolYear]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!schoolYear) {
        setOverdue([]);
        return;
      }
      const list = await window.api.reports.overdueEnrollments(schoolYear);
      if (!cancelled) setOverdue(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolYear]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!enrollmentId) {
        setPayments([]);
        return;
      }
      const list = await window.api.payments.listForEnrollment(
        Number(enrollmentId),
      );
      if (!cancelled) setPayments(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [enrollmentId]);

  useEffect(() => {
    setPaymentQuery('');
  }, [enrollmentId]);

  const selected = balances.find(
    (b) => String(b.enrollment_id) === enrollmentId,
  );

  const paymentColumns = useMemo<ColumnDef<Payment>[]>(
    () => [
      {
        accessorKey: 'receipt_no',
        header: t('report.columns.receipt'),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      { accessorKey: 'payment_date', header: t('report.columns.date') },
      {
        accessorKey: 'amount',
        header: t('report.columns.amount'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
      {
        id: 'payment_mode',
        accessorFn: (row) => row.payment_mode,
        header: t('report.columns.mode'),
        cell: ({ row }) => translatePaymentMode(row.original.payment_mode, t),
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: t('report.columns.status'),
        cell: ({ row }) => (
          <StatusPill
            tone={transactionTone(row.original.status)}
            label={translateTransactionStatus(row.original.status, t)}
          />
        ),
      },
      cancelReasonColumnDef<Payment>(t),
    ],
    [t],
  );

  const enrollmentOptions = useMemo(
    () =>
      balances.map((b) => ({
        value: String(b.enrollment_id),
        label: `${b.full_name} (${b.matricule}) — ${b.class_name}`,
        keywords: `${b.full_name} ${b.matricule} ${b.class_name} ${b.registration_no ?? ''}`,
      })),
    [balances],
  );

  const filteredPayments = useMemo(() => {
    const q = paymentQuery.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((payment) => {
      const haystack =
        `${payment.receipt_no} ${payment.payment_date} ${payment.amount} ${payment.payment_mode} ${payment.transaction_ref ?? ''} ${payment.status}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [payments, paymentQuery]);

  const handlePrint = async () => {
    if (!enrollmentId) return;
    setError(null);
    setPrinting(true);
    try {
      await invokePrint(
        () => window.api.print.studentStatement(Number(enrollmentId)),
        t('report.statementGenerated'),
      );
    } catch (err) {
      setError(printErrorMessage(err));
    } finally {
      setPrinting(false);
    }
  };

  if (!schoolYear) {
    return (
      <EmptyState
        icon={FileText}
        title={t('report.needSchoolYear')}
        description={t('shell.schoolYearPlaceholder')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        icon={FileText}
        title={t('report.pageIntro.title')}
        description={t('report.pageIntro.description')}
      />
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white/95">
              {t('nav.report')}
            </h2>
            <p className="mt-1 text-sm text-white/55">
              {t('nav.descriptions.report')}
            </p>
          </div>

          <PageToolbar
            actions={
              <Button
                onClick={() => void handlePrint()}
                disabled={!selected || printing}
              >
                <Printer className="mr-2 h-4 w-4" />
                {printing ? t('report.generating') : t('report.printPdf')}
              </Button>
            }
          >
            <ToolbarField
              label={t('report.student')}
              htmlFor="report-student"
              className="min-w-[18rem] flex-1 basis-[18rem] max-w-xl"
            >
              <Combobox
                options={enrollmentOptions}
                value={enrollmentId}
                onChange={setEnrollmentId}
                placeholder={t('common.selectStudent')}
                searchPlaceholder={t('students.searchPlaceholder')}
                emptyLabel={t('enrollments.empty')}
              />
            </ToolbarField>
            <ToolbarField
              label={t('shell.schoolYear')}
              htmlFor="report-school-year"
              className="w-40"
            >
              <Input
                id="report-school-year"
                value={schoolYear}
                readOnly
                className="bg-white/[0.04] text-white/80"
              />
            </ToolbarField>
          </PageToolbar>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <StudentBalancePreview balance={selected} />

          {selected && (
            <div className="flex flex-wrap gap-2 text-xs text-white/55">
              {selected.section && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  {translateSection(selected.section, t)}
                </span>
              )}
              {selected.registration_no && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  {t('enrollments.registrationNo')}: {selected.registration_no}
                </span>
              )}
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                {t('report.studentSummary', {
                  matricule: selected.matricule,
                  year: schoolYear,
                })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white/90">
                {t('report.paymentHistory')}
              </h3>
              {selected && (
                <p className="mt-1 text-xs text-white/45">
                  {t('report.paymentCount', { count: payments.length })}
                </p>
              )}
            </div>
            {selected && <PaymentStatusBadge status={selected.status} />}
          </div>

          {!selected ? (
            <EmptyState
              icon={UserRound}
              title={t('report.selectStudentTitle')}
              description={t('report.selectStudentHint')}
              className="py-10"
            />
          ) : (
            <>
              {payments.length > 0 && (
                <TableSearchField
                  id="report-payments-search"
                  value={paymentQuery}
                  onChange={setPaymentQuery}
                  placeholder={t('report.searchPayments')}
                  className="max-w-lg"
                />
              )}
              {payments.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={t('report.noPayments')}
                  className="py-10"
                />
              ) : filteredPayments.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={t('report.noSearchResults')}
                  className="py-10"
                />
              ) : (
                <DataGrid
                  columns={paymentColumns}
                  data={filteredPayments}
                  paginate={false}
                  getRowId={(row) => String(row.id)}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <OverdueReminders overdue={overdue} schoolName={schoolName} />
    </div>
  );
}
