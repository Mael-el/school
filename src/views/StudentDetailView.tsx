import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Archive, CircleX, GraduationCap, Printer, RotateCcw, Trash2 } from 'lucide-react';
import type { Enrollment, Payment, Student } from '../lib/types';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { PaymentStatusBadge } from '../components/ui/payment-status-badge';
import type { BalanceStatus } from '../components/ui/payment-status-badge';
import { PageBackHeader } from '../components/ui/page-back-header';
import { SummaryCallout } from '../components/ui/summary-callout';
import { DataGrid } from '../components/ui/data-grid';
import { EmptyState } from '../components/ui/empty-state';
import { PrintPreviewView } from './PrintPreviewView';
import {
  translatePaymentMode,
  translateSection,
  translateTransactionStatus,
} from '../lib/i18n-domain';
import { fmtCurrency } from '../lib/format';
import { printErrorMessage } from '../lib/print';
import { notify } from '../lib/notify';
import { usePrintPreview } from '../hooks/use-print-preview';
import { useCancelReason } from '../hooks/use-cancel-reason';
import { useConfirmDialog } from '../hooks/use-confirm-dialog';
import { cancelReasonColumnDef } from '../components/ui/cancel-reason-cell';
import { StatusPill, transactionTone } from '../components/ui/status-pill';
import {
  TableActionButton,
  TableActionGroup,
} from '../components/ui/table-action-button';

interface EnrollmentWithPayments extends Enrollment {
  payments: Payment[];
}

type DetailScreen = 'main' | 'print';

function paymentBalanceStatus(
  expectedFee: number,
  totalPaid: number,
): BalanceStatus {
  if (totalPaid <= 0) return 'Non payé';
  if (totalPaid < expectedFee) return 'Paiement partiel';
  if (totalPaid > expectedFee) return 'Trop-perçu';
  return 'Payé';
}

export function StudentDetailView({
  student: initialStudent,
  onBack,
  onArchived,
  onReactivated,
  onDeleted,
}: {
  student: Student;
  onBack: () => void;
  onArchived?: () => void;
  onReactivated?: () => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const cancelReason = useCancelReason();
  const confirm = useConfirmDialog();
  const [student, setStudent] = useState(initialStudent);
  const [enrollments, setEnrollments] = useState<EnrollmentWithPayments[]>([]);
  const [screen, setScreen] = useState<DetailScreen>('main');
  const { preview, openPreview, closePreview, confirmPreview } =
    usePrintPreview();

  const loadEnrollments = useCallback(async () => {
    const list = await window.api.enrollments.listForStudent(student.id);
    const withPayments = await Promise.all(
      list.map(async (enrollment) => ({
        ...enrollment,
        payments: await window.api.payments.listForEnrollment(enrollment.id),
      })),
    );
    setEnrollments(withPayments);
  }, [student.id]);

  useEffect(() => {
    setStudent(initialStudent);
  }, [initialStudent]);

  useEffect(() => {
    void loadEnrollments();
  }, [loadEnrollments]);

  const cancelPayment = async (payment: Payment) => {
    const reason = await cancelReason.ask(t('studentDetail.cancelReason'));
    if (!reason) return;
    try {
      await window.api.payments.cancel(payment.id, reason);
      notify.success(t('studentDetail.paymentCancelled'));
      await loadEnrollments();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const deletePayment = async (payment: Payment) => {
    const ok = await confirm.ask({
      title: t('payments.deleteTitle'),
      description: t('payments.deleteDescription', {
        receipt: payment.receipt_no,
      }),
      confirmLabel: t('payments.deleteConfirm'),
    });
    if (!ok) return;
    try {
      await window.api.payments.delete(payment.id);
      notify.success(t('payments.deleted'));
      await loadEnrollments();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const paymentColumns = useMemo<ColumnDef<Payment>[]>(
    () => [
      {
        accessorKey: 'receipt_no',
        header: t('studentDetail.columns.receipt'),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      { accessorKey: 'payment_date', header: t('studentDetail.columns.date') },
      {
        accessorKey: 'amount',
        header: t('studentDetail.columns.amount'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
      {
        id: 'payment_mode',
        accessorFn: (row) => row.payment_mode,
        header: t('studentDetail.columns.mode'),
        cell: ({ row }) => translatePaymentMode(row.original.payment_mode, t),
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: t('studentDetail.columns.status'),
        cell: ({ row }) => (
          <StatusPill
            tone={transactionTone(row.original.status)}
            label={translateTransactionStatus(row.original.status, t)}
          />
        ),
      },
      cancelReasonColumnDef<Payment>(t),
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        size: 280,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const payment = row.original;
          return (
            <TableActionGroup>
              {payment.status === 'Validé' && (
                <TableActionButton
                  icon={CircleX}
                  label={t('common.cancel')}
                  tone="warning"
                  onClick={() => void cancelPayment(payment)}
                />
              )}
              <TableActionButton
                icon={Trash2}
                label={t('common.delete')}
                tone="destructive"
                onClick={() => void deletePayment(payment)}
              />
            </TableActionGroup>
          );
        },
      },
    ],
    [t],
  );

  const isArchived = student.status === 'Archivé';

  const confirmArchive = async () => {
    const ok = await confirm.ask({
      title: t('students.archiveTitle'),
      description: t('students.archiveDescription', {
        name: student.full_name,
      }),
      confirmLabel: t('students.archiveConfirm'),
    });
    if (!ok) return;
    try {
      await window.api.students.archive(student.id);
      notify.success(t('students.archived'));
      onArchived?.();
      onBack();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmReactivate = async () => {
    const ok = await confirm.ask({
      title: t('students.reactivateTitle'),
      description: t('students.reactivateDescription', {
        name: student.full_name,
      }),
      confirmLabel: t('students.reactivateConfirm'),
      destructive: false,
    });
    if (!ok) return;
    try {
      const updated = await window.api.students.reactivate(student.id);
      if (updated) setStudent(updated);
      notify.success(t('students.reactivated'));
      onReactivated?.();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmDelete = async () => {
    const ok = await confirm.ask({
      title: t('studentDetail.deleteTitle'),
      description: t('studentDetail.deleteDescription', {
        name: student.full_name,
      }),
      confirmLabel: t('studentDetail.deleteConfirm'),
    });
    if (!ok) return;
    try {
      await window.api.students.delete(student.id);
      notify.success(t('studentDetail.deleted'));
      onDeleted?.();
      onBack();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  if (screen === 'print' && preview) {
    return (
      <>
        <PrintPreviewView
          title={t('studentDetail.printStatement')}
          html={preview.html}
          defaultFileName={preview.defaultFileName}
          onBack={() => {
            closePreview();
            setScreen('main');
          }}
          onSave={async () => {
            await confirmPreview(t('studentDetail.statementGenerated'));
            setScreen('main');
          }}
        />
        {confirm.dialog}
        {cancelReason.dialog}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageBackHeader
        title={`${t('nav.students')} / ${student.full_name} (${student.matricule})${isArchived ? ` — ${t('students.archivedBadge')}` : ''}`}
        onBack={onBack}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isArchived ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void confirmReactivate()}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t('common.reactivate')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                title={t('students.archive')}
                onClick={() => void confirmArchive()}
              >
                <Archive className="mr-2 h-4 w-4" />
                {t('students.archive')}
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('common.delete')}
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          {enrollments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('studentDetail.noEnrollments')}
            </p>
          )}
          {enrollments.map((enrollment) => {
            const totalPaid = enrollment.payments
              .filter((p) => p.status === 'Validé')
              .reduce((sum, p) => sum + p.amount, 0);
            const remaining = enrollment.expected_fee - totalPaid;
            const status = paymentBalanceStatus(
              enrollment.expected_fee,
              totalPaid,
            );

            return (
              <div
                key={enrollment.id}
                className="overflow-hidden rounded-2xl border border-white/10"
              >
                <div className="flex flex-col gap-3 p-4">
                  <SummaryCallout
                    icon={GraduationCap}
                    variant={remaining > 0 ? 'warning' : 'ready'}
                    title={t('studentDetail.yearLine', {
                      year: enrollment.school_year,
                    })}
                    description={[
                      translateSection(enrollment.section, t),
                      enrollment.registration_no,
                      enrollment.status !== 'Actif'
                        ? t(`enum.enrollmentStatus.${enrollment.status === 'Transféré' ? 'transferred' : 'withdrawn'}`)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    hint={t('studentDetail.enrollmentHint')}
                    stats={[
                      {
                        label: t('report.expectedFee'),
                        value: fmtCurrency(enrollment.expected_fee),
                      },
                      {
                        label: t('report.totalPaid'),
                        value: fmtCurrency(totalPaid),
                      },
                      {
                        label: t('payments.preview.balance'),
                        value: fmtCurrency(remaining),
                      },
                    ]}
                  />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <PaymentStatusBadge status={status} />
                    <Button
                      variant="outline"
                      title={t('studentDetail.printStatement')}
                      aria-label={t('studentDetail.printStatementAria')}
                      onClick={() =>
                        void openPreview(() =>
                          window.api.print.studentStatementHtml(enrollment.id),
                        )
                          .then(() => setScreen('print'))
                          .catch((err) => notify.error(printErrorMessage(err)))
                      }
                    >
                      <Printer className="h-4 w-4" />
                      {t('studentDetail.printStatement')}
                    </Button>
                  </div>
                </div>
                {enrollment.payments.length === 0 ? (
                  <EmptyState
                    title={t('studentDetail.noPayments')}
                    className="py-8"
                  />
                ) : (
                  <DataGrid
                    columns={paymentColumns}
                    data={enrollment.payments}
                    paginate={false}
                    getRowId={(row) => String(row.id)}
                  />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
      {confirm.dialog}
      {cancelReason.dialog}
    </div>
  );
}
