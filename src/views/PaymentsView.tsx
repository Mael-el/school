import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { CircleX, Plus, Printer, Receipt, Trash2, Wallet } from 'lucide-react';
import type {
  Cashier,
  EnrollmentBalance,
  Payment,
  PaymentCategory,
} from '../lib/types';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Combobox } from '../components/ui/combobox';
import { DataGrid } from '../components/ui/data-grid';
import { EmptyState } from '../components/ui/empty-state';
import { PageToolbar, TableSearchField, ToolbarField } from '../components/ui/page-toolbar';
import { PageIntro } from '../components/ui/page-intro';
import { StatusPill, transactionTone } from '../components/ui/status-pill';
import { StudentBalancePreview } from '../components/ui/student-balance-preview';
import { formatDateFr, DISPLAY_DATE_SHORT } from '../lib/dates';
import { fmtCurrency } from '../lib/format';
import {
  translatePaymentMode,
  translateTransactionStatus,
} from '../lib/i18n-domain';
import { invokePrint, printErrorMessage } from '../lib/print';
import { useCancelReason } from '../hooks/use-cancel-reason';
import { useConfirmDialog } from '../hooks/use-confirm-dialog';
import { cancelReasonColumnDef } from '../components/ui/cancel-reason-cell';
import {
  TableActionButton,
  TableActionGroup,
} from '../components/ui/table-action-button';
import { notify } from '../lib/notify';
import { PaymentFormView } from './PaymentFormView';

export function PaymentsView({ schoolYear }: { schoolYear: string }) {
  const { t } = useTranslation();
  const cancelReason = useCancelReason();
  const confirm = useConfirmDialog();
  const [balances, setBalances] = useState<EnrollmentBalance[]>([]);
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [query, setQuery] = useState('');

  const loadReference = async () => {
    if (!schoolYear) {
      setBalances([]);
      return;
    }
    const [list, cats, casharr] = await Promise.all([
      window.api.enrollments.listBalancesForYear(schoolYear),
      window.api.reference.paymentCategories(),
      window.api.reference.cashiers(),
    ]);
    setBalances(list);
    setCategories(cats);
    setCashiers(casharr);
  };

  const loadPayments = async (id: string) => {
    if (!id) {
      setPayments([]);
      return;
    }
    const list = await window.api.payments.listForEnrollment(Number(id));
    setPayments(list);
  };

  useEffect(() => {
    void loadReference();
  }, [schoolYear]);

  useEffect(() => {
    void loadPayments(enrollmentId);
  }, [enrollmentId]);

  const enrollmentOptions = useMemo(
    () =>
      balances.map((b) => ({
        value: String(b.enrollment_id),
        label: `${b.full_name} (${b.matricule}) — ${b.class_name} — ${fmtCurrency(b.balance)}`,
        keywords: `${b.full_name} ${b.matricule} ${b.class_name}`,
      })),
    [balances],
  );

  const cancelPayment = async (payment: Payment) => {
    const reason = await cancelReason.ask(t('payments.cancelReason'));
    if (!reason) return;
    await window.api.payments.cancel(payment.id, reason);
    await Promise.all([loadReference(), loadPayments(enrollmentId)]);
  };

  const printReceipt = async (payment: Payment) => {
    try {
      await invokePrint(
        () => window.api.print.paymentReceipt(payment.id),
        t('payments.receiptGenerated'),
      );
    } catch (err) {
      setError(printErrorMessage(err));
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
      await Promise.all([loadReference(), loadPayments(enrollmentId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const columns = useMemo<ColumnDef<Payment>[]>(
    () => [
      {
        accessorKey: 'receipt_no',
        header: t('payments.columns.receipt'),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'payment_date',
        header: t('payments.columns.date'),
        cell: ({ getValue }) =>
          formatDateFr(getValue<string>(), DISPLAY_DATE_SHORT),
      },
      {
        accessorKey: 'amount',
        header: t('payments.columns.amount'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
      {
        id: 'payment_mode',
        accessorFn: (row) => row.payment_mode,
        header: t('payments.columns.mode'),
        cell: ({ row }) => translatePaymentMode(row.original.payment_mode, t),
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: t('payments.columns.status'),
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
          const p = row.original;
          return (
            <TableActionGroup>
              {p.status === 'Validé' && (
                <TableActionButton
                  icon={Printer}
                  label={t('common.print')}
                  tone="primary"
                  onClick={() => void printReceipt(p)}
                />
              )}
              {p.status === 'Validé' && (
                <TableActionButton
                  icon={CircleX}
                  label={t('common.cancel')}
                  tone="warning"
                  onClick={() => void cancelPayment(p)}
                />
              )}
              <TableActionButton
                icon={Trash2}
                label={t('common.delete')}
                tone="destructive"
                onClick={() => void deletePayment(p)}
              />
            </TableActionGroup>
          );
        },
      },
    ],
    [t, enrollmentId],
  );

  const filteredPayments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) => {
      const haystack =
        `${p.receipt_no} ${p.payment_date} ${p.amount} ${p.payment_mode} ${p.transaction_ref ?? ''} ${p.status}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [payments, query]);

  if (!schoolYear) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('payments.needSchoolYear')}
      </p>
    );
  }

  if (showForm) {
    return (
      <>
        <PaymentFormView
          balances={balances}
          categories={categories}
          cashiers={cashiers}
          initialEnrollmentId={enrollmentId}
          onBack={() => setShowForm(false)}
          onSaved={async () => {
            await loadReference();
            await loadPayments(enrollmentId);
          }}
        />
        {confirm.dialog}
        {cancelReason.dialog}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        icon={Wallet}
        title={t('payments.pageIntro.title')}
        description={t('payments.pageIntro.description')}
      />
      <PageToolbar
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> {t('payments.addPayment')}
          </Button>
        }
      >
        <ToolbarField
          label={t('payments.enrollment')}
          className="min-w-[18rem] flex-1 basis-[18rem] max-w-xl"
        >
          <Combobox
            options={enrollmentOptions}
            value={enrollmentId}
            onChange={setEnrollmentId}
            placeholder={t('common.selectPlaceholder')}
            searchPlaceholder={t('students.searchPlaceholder')}
            emptyLabel={t('enrollments.empty')}
          />
        </ToolbarField>
        <ToolbarField
          label={t('common.search')}
          htmlFor="payments-search"
          className="min-w-[16rem] flex-1 basis-[16rem] max-w-lg"
        >
          <TableSearchField
            id="payments-search"
            value={query}
            onChange={setQuery}
            placeholder={t('payments.searchPlaceholder')}
            className="max-w-none"
          />
        </ToolbarField>
      </PageToolbar>

      <StudentBalancePreview
        balance={balances.find((b) => String(b.enrollment_id) === enrollmentId)}
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {filteredPayments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t('payments.selectStudentHint')}
              actionLabel={enrollmentId ? t('payments.addPayment') : undefined}
              onAction={enrollmentId ? () => setShowForm(true) : undefined}
            />
          ) : (
            <DataGrid
              columns={columns}
              data={filteredPayments}
              getRowId={(p) => String(p.id)}
            />
          )}
        </CardContent>
      </Card>
      {confirm.dialog}
      {cancelReason.dialog}
    </div>
  );
}
