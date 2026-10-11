import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarRange, CircleX, Pencil, Plus, Printer, RotateCcw, Trash2, UserCog, UserMinus, Wallet } from 'lucide-react';
import type {
  Cashier,
  StaffMember,
  StaffMonthlyBalance,
  StaffPayment,
} from '../lib/types';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { MonthPicker } from '../components/ui/month-picker';
import { Card, CardContent } from '../components/ui/card';
import { DataGrid } from '../components/ui/data-grid';
import { EmptyState } from '../components/ui/empty-state';
import {
  PageToolbar,
  TableSearchField,
  ToolbarField,
} from '../components/ui/page-toolbar';
import { StaffSalaryPreview } from '../components/ui/staff-salary-preview';
import { SummaryCallout } from '../components/ui/summary-callout';
import { PageIntro } from '../components/ui/page-intro';
import { Tabs } from '../components/ui/tabs';
import {
  StatusPill,
  staffTone,
  transactionTone,
} from '../components/ui/status-pill';
import { FormField } from '../components/forms';
import { todayIsoMonth } from '../lib/dates';
import { notify } from '../lib/notify';
import { invokePrint, printErrorMessage } from '../lib/print';
import { fmtCurrency } from '../lib/format';
import {
  translateStaffPaymentType,
  translateTransactionStatus,
} from '../lib/i18n-domain';
import { useCancelReason } from '../hooks/use-cancel-reason';
import { useConfirmDialog } from '../hooks/use-confirm-dialog';
import { cancelReasonColumnDef } from '../components/ui/cancel-reason-cell';
import {
  TableActionButton,
  TableActionGroup,
} from '../components/ui/table-action-button';
import { StaffMemberFormView } from './StaffMemberFormView';
import { StaffPaymentFormView } from './StaffPaymentFormView';

type Tab = 'staff' | 'payments' | 'monthly';
type FormMode = 'member' | 'payment' | null;

export function StaffView() {
  const { t } = useTranslation();
  const cancelReason = useCancelReason();
  const confirm = useConfirmDialog();
  const [tab, setTab] = useState<Tab>('staff');
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [payments, setPayments] = useState<StaffPayment[]>([]);

  const [monthlyPeriod, setMonthlyPeriod] = useState(todayIsoMonth());
  const [monthlyBalances, setMonthlyBalances] = useState<StaffMonthlyBalance[]>(
    [],
  );
  const [salaryMode, setSalaryMode] = useState<'fixe' | 'variable'>('fixe');
  const [memberQuery, setMemberQuery] = useState('');
  const [paymentQuery, setPaymentQuery] = useState('');
  const [monthlyQuery, setMonthlyQuery] = useState('');

  const isFixedSalary = salaryMode === 'fixe';

  const filteredStaff = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter((s) =>
      `${s.full_name} ${s.staff_no} ${s.role} ${s.phone ?? ''}`.toLowerCase().includes(q),
    );
  }, [staffList, memberQuery]);

  const filteredPayments = useMemo(() => {
    const q = paymentQuery.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) =>
      `${p.receipt_no} ${p.payment_date} ${p.pay_period} ${p.amount} ${p.payment_type} ${p.status}`.toLowerCase().includes(
        q,
      ),
    );
  }, [payments, paymentQuery]);

  const filteredMonthly = useMemo(() => {
    const q = monthlyQuery.trim().toLowerCase();
    if (!q) return monthlyBalances;
    return monthlyBalances.filter((row) =>
      `${row.full_name} ${row.staff_no} ${row.role}`.toLowerCase().includes(q),
    );
  }, [monthlyBalances, monthlyQuery]);

  const loadStaff = async () => {
    const [list, casharr] = await Promise.all([
      window.api.staff.list(),
      window.api.reference.cashiers(),
    ]);
    setStaffList(list);
    setCashiers(casharr);
  };

  const loadPayments = async (staffId: string) => {
    if (!staffId) {
      setPayments([]);
      return;
    }
    const list = await window.api.staff.listPaymentsForStaff(Number(staffId));
    setPayments(list);
  };

  const loadMonthlyBalances = async (period: string) => {
    if (!period) {
      setMonthlyBalances([]);
      return;
    }
    const list = await window.api.staff.monthlyBalances(period);
    setMonthlyBalances(list);
  };

  useEffect(() => {
    void loadStaff();
    void (async () => {
      const mode = await window.api.settings.get('staff_salary_mode');
      setSalaryMode(mode === 'variable' ? 'variable' : 'fixe');
    })();
  }, []);

  useEffect(() => {
    void loadPayments(selectedStaffId);
  }, [selectedStaffId]);

  useEffect(() => {
    void loadMonthlyBalances(monthlyPeriod);
  }, [monthlyPeriod]);

  const cancelPayment = async (payment: StaffPayment) => {
    const reason = await cancelReason.ask(t('staff.cancelReason'));
    if (!reason) return;
    await window.api.staff.cancelPayment(payment.id, reason);
    await Promise.all([
      loadPayments(selectedStaffId),
      loadMonthlyBalances(monthlyPeriod),
    ]);
  };

  const printReceipt = async (payment: StaffPayment) => {
    try {
      await invokePrint(
        () => window.api.print.staffPaymentReceipt(payment.id),
        t('staff.salaryReceiptGenerated'),
      );
    } catch (err) {
      setError(printErrorMessage(err));
    }
  };

  const deactivateMember = async (member: StaffMember) => {
    const ok = await confirm.ask({
      title: t('staff.deactivateTitle'),
      description: t('staff.deactivateDescription', {
        name: member.full_name,
      }),
      confirmLabel: t('staff.deactivateConfirm'),
    });
    if (!ok) return;
    try {
      await window.api.staff.update(member.id, { status: 'Sorti' });
      notify.success(t('staff.deactivated'));
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const reactivateMember = async (member: StaffMember) => {
    const ok = await confirm.ask({
      title: t('staff.reactivateTitle'),
      description: t('staff.reactivateDescription', {
        name: member.full_name,
      }),
      confirmLabel: t('staff.reactivateConfirm'),
      destructive: false,
    });
    if (!ok) return;
    try {
      await window.api.staff.update(member.id, { status: 'Actif' });
      notify.success(t('staff.reactivated'));
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteMember = async (member: StaffMember) => {
    const ok = await confirm.ask({
      title: t('staff.deleteMemberTitle'),
      description: t('staff.deleteMemberDescription', {
        name: member.full_name,
      }),
      confirmLabel: t('staff.deleteMemberConfirm'),
    });
    if (!ok) return;
    try {
      await window.api.staff.delete(member.id);
      notify.success(t('staff.memberDeleted'));
      if (selectedStaffId === String(member.id)) {
        setSelectedStaffId('');
      }
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteStaffPayment = async (payment: StaffPayment) => {
    const ok = await confirm.ask({
      title: t('staff.deletePaymentTitle'),
      description: t('staff.deletePaymentDescription', {
        receipt: payment.receipt_no,
      }),
      confirmLabel: t('staff.deletePaymentConfirm'),
    });
    if (!ok) return;
    try {
      await window.api.staff.deletePayment(payment.id);
      notify.success(t('staff.paymentDeleted'));
      await Promise.all([
        loadPayments(selectedStaffId),
        loadMonthlyBalances(monthlyPeriod),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const staffColumns = useMemo<ColumnDef<StaffMember>[]>(() => {
    const cols: ColumnDef<StaffMember>[] = [
      {
        accessorKey: 'staff_no',
        header: t('staff.memberColumns.matricule'),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'full_name',
        header: t('staff.memberColumns.name'),
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      { accessorKey: 'role', header: t('staff.memberColumns.role') },
    ];
    if (isFixedSalary) {
      cols.push({
        accessorKey: 'monthly_salary',
        header: t('staff.memberColumns.monthlySalary'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      });
    }
    cols.push(
      {
        accessorKey: 'status',
        header: t('staff.memberColumns.status'),
        cell: ({ row }) => (
          <StatusPill
            tone={staffTone(row.original.status)}
            label={row.original.status}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        size: 260,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const member = row.original;
          return (
            <TableActionGroup>
              <TableActionButton
                icon={Pencil}
                label={t('common.edit')}
                onClick={() => {
                  setEditingMember(member);
                  setFormMode('member');
                }}
              />
              {member.status === 'Actif' ? (
                <TableActionButton
                  icon={UserMinus}
                  label={t('staff.deactivate')}
                  tone="warning"
                  onClick={() => void deactivateMember(member)}
                />
              ) : (
                <TableActionButton
                  icon={RotateCcw}
                  label={t('staff.reactivate')}
                  tone="primary"
                  onClick={() => void reactivateMember(member)}
                />
              )}
              <TableActionButton
                icon={Trash2}
                label={t('common.delete')}
                tone="destructive"
                onClick={() => void deleteMember(member)}
              />
            </TableActionGroup>
          );
        },
      },
    );
    return cols;
  }, [t, isFixedSalary]);

  const staffPaymentColumns = useMemo<ColumnDef<StaffPayment>[]>(
    () => [
      {
        accessorKey: 'receipt_no',
        header: t('staff.paymentColumns.receipt'),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      { accessorKey: 'payment_date', header: t('staff.paymentColumns.date') },
      { accessorKey: 'pay_period', header: t('staff.paymentColumns.period') },
      {
        id: 'payment_type',
        accessorFn: (row) => row.payment_type,
        header: t('staff.paymentColumns.type'),
        cell: ({ row }) =>
          translateStaffPaymentType(row.original.payment_type, t),
      },
      {
        accessorKey: 'amount',
        header: t('staff.paymentColumns.amount'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: t('staff.paymentColumns.status'),
        cell: ({ row }) => (
          <StatusPill
            tone={transactionTone(row.original.status)}
            label={translateTransactionStatus(row.original.status, t)}
          />
        ),
      },
      cancelReasonColumnDef<StaffPayment>(t),
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        size: 320,
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
                onClick={() => void deleteStaffPayment(p)}
              />
            </TableActionGroup>
          );
        },
      },
    ],
    [t, selectedStaffId, monthlyPeriod],
  );

  const monthlyColumns = useMemo<ColumnDef<StaffMonthlyBalance>[]>(() => {
    const cols: ColumnDef<StaffMonthlyBalance>[] = [
      {
        accessorKey: 'staff_no',
        header: t('staff.monthlyColumns.matricule'),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'full_name',
        header: t('staff.monthlyColumns.name'),
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      { accessorKey: 'role', header: t('staff.monthlyColumns.role') },
    ];
    if (isFixedSalary) {
      cols.push(
        {
          accessorKey: 'monthly_salary',
          header: t('staff.monthlyColumns.monthlySalary'),
          meta: { align: 'right' },
          cell: ({ getValue }) => fmtCurrency(getValue<number>()),
        },
        {
          accessorKey: 'balance',
          header: t('staff.monthlyColumns.balance'),
          meta: { align: 'right' },
          cell: ({ getValue }) => fmtCurrency(getValue<number>()),
        },
      );
    }
    cols.push({
      accessorKey: 'paid',
      header: t('staff.monthlyColumns.paid'),
      meta: { align: 'right' },
      cell: ({ getValue }) => fmtCurrency(getValue<number>()),
    });
    return cols;
  }, [t, isFixedSalary]);

  if (formMode === 'member') {
    return (
      <>
        <StaffMemberFormView
          isFixedSalary={isFixedSalary}
          editingMember={editingMember}
          onBack={() => {
            setFormMode(null);
            setEditingMember(null);
          }}
          onSaved={loadStaff}
        />
        {confirm.dialog}
        {cancelReason.dialog}
      </>
    );
  }

  if (formMode === 'payment') {
    return (
      <>
        <StaffPaymentFormView
          staffList={staffList}
          cashiers={cashiers}
          initialStaffId={selectedStaffId}
          onBack={() => setFormMode(null)}
          onSaved={async () => {
            await Promise.all([
              loadPayments(selectedStaffId),
              loadMonthlyBalances(monthlyPeriod),
            ]);
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
        icon={UserCog}
        title={t('staff.pageIntro.title')}
        description={t('staff.pageIntro.description')}
      />

      <Tabs
        items={[
          { id: 'staff', label: t('staff.tabs.members'), icon: UserCog },
          { id: 'payments', label: t('staff.tabs.payments'), icon: Wallet },
          {
            id: 'monthly',
            label: t('staff.tabs.monthly'),
            icon: CalendarRange,
          },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {tab === 'staff' && (
        <>
          {!isFixedSalary && (
            <p className="text-xs text-muted-foreground">
              {t('staff.variableSalaryHint')}
            </p>
          )}
          <PageToolbar
            actions={
              <Button
                onClick={() => {
                  setEditingMember(null);
                  setFormMode('member');
                }}
              >
                <Plus className="h-4 w-4" /> {t('staff.addMember')}
              </Button>
            }
          >
            <ToolbarField
              label={t('common.search')}
              htmlFor="staff-search"
              className="min-w-[18rem] flex-1 basis-[18rem]"
            >
              <TableSearchField
                id="staff-search"
                value={memberQuery}
                onChange={setMemberQuery}
                placeholder={t('staff.searchMembersPlaceholder')}
                className="max-w-none"
              />
            </ToolbarField>
          </PageToolbar>

          <Card>
            <CardContent className="p-0">
              {filteredStaff.length === 0 ? (
                <EmptyState
                  icon={UserCog}
                  title={
                    staffList.length === 0
                      ? t('staff.emptyMembers')
                      : t('staff.emptyFiltered')
                  }
                  actionLabel={
                    staffList.length === 0 ? t('staff.addMember') : undefined
                  }
                  onAction={
                    staffList.length === 0
                      ? () => {
                          setEditingMember(null);
                          setFormMode('member');
                        }
                      : undefined
                  }
                />
              ) : (
                <DataGrid
                  columns={staffColumns}
                  data={filteredStaff}
                  getRowId={(s) => String(s.id)}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'payments' && (
        <>
          <PageToolbar
            actions={
              <Button onClick={() => setFormMode('payment')}>
                <Plus className="h-4 w-4" /> {t('staff.addPayment')}
              </Button>
            }
          >
            <ToolbarField
              label={t('staff.employee')}
              htmlFor="staff-employee"
              className="min-w-[16rem] flex-1 basis-[16rem] max-w-md"
            >
              <Select
                id="staff-employee"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="h-10 w-full"
              >
                <option value="">{t('common.selectPlaceholder')}</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.staff_no})
                  </option>
                ))}
              </Select>
            </ToolbarField>
            <ToolbarField
              label={t('common.search')}
              htmlFor="staff-payments-search"
              className="min-w-[16rem] flex-1 basis-[16rem]"
            >
              <TableSearchField
                id="staff-payments-search"
                value={paymentQuery}
                onChange={setPaymentQuery}
                placeholder={t('staff.searchPaymentsPlaceholder')}
                className="max-w-none"
              />
            </ToolbarField>
          </PageToolbar>

          <StaffSalaryPreview
            member={staffList.find((s) => String(s.id) === selectedStaffId)}
            showSalary={isFixedSalary}
          />

          <Card>
            <CardContent className="p-0">
              {filteredPayments.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title={t('staff.selectEmployeeHint')}
                  actionLabel={selectedStaffId ? t('staff.addPayment') : undefined}
                  onAction={
                    selectedStaffId ? () => setFormMode('payment') : undefined
                  }
                />
              ) : (
                <DataGrid
                  columns={staffPaymentColumns}
                  data={filteredPayments}
                  getRowId={(p) => String(p.id)}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'monthly' && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <FormField stacked label={t('staff.month')} htmlFor="staff-monthly-period">
                <MonthPicker
                  id="staff-monthly-period"
                  value={monthlyPeriod}
                  onChange={setMonthlyPeriod}
                  className="w-52"
                  clearable={false}
                />
              </FormField>
              <ToolbarField
                label={t('common.search')}
                htmlFor="staff-monthly-search"
                className="min-w-[16rem] flex-1 basis-[16rem]"
              >
                <TableSearchField
                  id="staff-monthly-search"
                  value={monthlyQuery}
                  onChange={setMonthlyQuery}
                  placeholder={t('staff.searchMonthlyPlaceholder')}
                  className="max-w-none"
                />
              </ToolbarField>
            </div>

            {filteredMonthly.length > 0 && (
              <div className="mt-4">
                <SummaryCallout
                  icon={Wallet}
                  variant="ready"
                  title={t('staff.tabs.monthly')}
                  description={monthlyPeriod}
                  stats={[
                    {
                      label: t('staff.monthlyColumns.paid'),
                      value: fmtCurrency(
                        filteredMonthly.reduce((sum, row) => sum + row.paid, 0),
                      ),
                    },
                    ...(isFixedSalary
                      ? [
                          {
                            label: t('staff.monthlyColumns.balance'),
                            value: fmtCurrency(
                              filteredMonthly.reduce(
                                (sum, row) => sum + row.balance,
                                0,
                              ),
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            )}

            {filteredMonthly.length === 0 ? (
              <EmptyState icon={Wallet} title={t('staff.emptyMonthly')} />
            ) : (
              <DataGrid
                columns={monthlyColumns}
                data={filteredMonthly}
                getRowId={(b) => String(b.id)}
                className="mt-4"
              />
            )}
          </CardContent>
        </Card>
      )}
      {confirm.dialog}
      {cancelReason.dialog}
    </div>
  );
}
