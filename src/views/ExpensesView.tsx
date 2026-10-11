import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { CircleX, FileDown, FileSpreadsheet, Pencil, Plus, Receipt, Trash2, Wallet } from 'lucide-react';
import type {
  Expense,
  ExpenseCategory,
  ExpenseTotalByCategory,
} from '../lib/types';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { DatePicker } from '../components/ui/date-picker';
import { Card, CardContent } from '../components/ui/card';
import { DataGrid } from '../components/ui/data-grid';
import { EmptyState } from '../components/ui/empty-state';
import {
  PageToolbar,
  TableSearchField,
  ToolbarField,
} from '../components/ui/page-toolbar';
import { SummaryCallout } from '../components/ui/summary-callout';
import { PageIntro } from '../components/ui/page-intro';
import { StatusPill, transactionTone } from '../components/ui/status-pill';
import { fmtCurrency } from '../lib/format';
import {
  translatePaymentMode,
  translateTransactionStatus,
} from '../lib/i18n-domain';
import { invokePrint, printErrorMessage } from '../lib/print';
import { useCancelReason } from '../hooks/use-cancel-reason';
import { cancelReasonColumnDef } from '../components/ui/cancel-reason-cell';
import {
  TableActionButton,
  TableActionGroup,
} from '../components/ui/table-action-button';
import { notify } from '../lib/notify';
import { useConfirmDialog } from '../hooks/use-confirm-dialog';
import { ExpenseFormView } from './ExpenseFormView';

const PAYMENT_MODES = [
  'Espèces',
  'MTN Mobile Money',
  'Orange Money',
  'Virement bancaire',
  'Chèque',
];

export function ExpensesView() {
  const { t } = useTranslation();
  const cancelReason = useCancelReason();
  const confirm = useConfirmDialog();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totals, setTotals] = useState<ExpenseTotalByCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterPaymentMode, setFilterPaymentMode] = useState('');
  const [query, setQuery] = useState('');

  const [approvalRequired, setApprovalRequired] = useState(false);
  const [defaultApprover, setDefaultApprover] = useState('');
  const [excelExportEnabled, setExcelExportEnabled] = useState(true);

  const currentFilters = () => ({
    from: filterFrom || undefined,
    to: filterTo || undefined,
    categoryId: filterCategoryId ? Number(filterCategoryId) : undefined,
    paymentMode: filterPaymentMode || undefined,
  });

  const loadCategories = async () => {
    const cats = await window.api.reference.expenseCategories();
    setCategories(cats);
  };

  const loadExpenses = async () => {
    const [list, totalsByCat] = await Promise.all([
      window.api.expenses.list(currentFilters()),
      window.api.expenses.totalsByCategory(currentFilters()),
    ]);
    setExpenses(list);
    setTotals(totalsByCat);
  };

  useEffect(() => {
    loadCategories();
    void (async () => {
      const all = await window.api.settings.getAll();
      setApprovalRequired(all.expense_approval_required === '1');
      setExcelExportEnabled(all.excel_export_enabled !== '0');
      if (all.expense_approver_name?.trim()) {
        setDefaultApprover(all.expense_approver_name.trim());
      }
    })();
  }, []);

  useEffect(() => {
    void loadExpenses();
  }, [filterFrom, filterTo, filterCategoryId, filterPaymentMode]);

  const cancelExpense = async (expense: Expense) => {
    const reason = await cancelReason.ask(t('expenses.cancelReason'));
    if (!reason) return;
    await window.api.expenses.cancel(expense.id, reason);
    await loadExpenses();
  };

  const exportPdf = async () => {
    try {
      await invokePrint(
        () => window.api.print.expenseRegister(currentFilters()),
        t('expenses.registerGenerated'),
      );
    } catch (err) {
      setError(printErrorMessage(err));
    }
  };

  const exportExcel = async () => {
    if (!excelExportEnabled) return;
    try {
      await window.api.expenses.exportExcel(currentFilters());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteExpense = async (expense: Expense) => {
    const ok = await confirm.ask({
      title: t('expenses.deleteTitle'),
      description: t('expenses.deleteDescription', {
        reference: expense.reference_no,
      }),
      confirmLabel: t('expenses.deleteConfirm'),
    });
    if (!ok) return;
    try {
      await window.api.expenses.delete(expense.id);
      notify.success(t('expenses.deleted'));
      await loadExpenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter((e) => {
      const haystack =
        `${e.reference_no} ${e.description} ${e.supplier_name ?? ''} ${e.receipt_ref ?? ''} ${e.amount}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [expenses, query]);

  const grandTotal = filtered
    .filter((e) => e.status === 'Validé')
    .reduce((sum, e) => sum + e.amount, 0);

  const columns = useMemo<ColumnDef<Expense>[]>(
    () => [
      {
        accessorKey: 'reference_no',
        header: t('expenses.columns.reference'),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      { accessorKey: 'expense_date', header: t('expenses.columns.date') },
      { accessorKey: 'description', header: t('expenses.columns.description') },
      {
        accessorKey: 'amount',
        header: t('expenses.columns.amount'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
      {
        id: 'payment_mode',
        accessorFn: (row) => row.payment_mode,
        header: t('expenses.columns.mode'),
        cell: ({ row }) => translatePaymentMode(row.original.payment_mode, t),
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: t('expenses.columns.status'),
        cell: ({ row }) => (
          <StatusPill
            tone={transactionTone(row.original.status)}
            label={translateTransactionStatus(row.original.status, t)}
          />
        ),
      },
      cancelReasonColumnDef<Expense>(t),
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        size: 220,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const expense = row.original;
          return (
            <TableActionGroup>
              {expense.status === 'Validé' && (
                <TableActionButton
                  icon={Pencil}
                  label={t('common.edit')}
                  onClick={() => {
                    setEditingExpense(expense);
                    setShowForm(true);
                  }}
                />
              )}
              {expense.status === 'Validé' && (
                <TableActionButton
                  icon={CircleX}
                  label={t('common.cancel')}
                  tone="warning"
                  onClick={() => void cancelExpense(expense)}
                />
              )}
              <TableActionButton
                icon={Trash2}
                label={t('common.delete')}
                tone="destructive"
                onClick={() => void deleteExpense(expense)}
              />
            </TableActionGroup>
          );
        },
      },
    ],
    [t],
  );

  if (showForm) {
    return (
      <>
        <ExpenseFormView
          categories={categories}
          approvalRequired={approvalRequired}
          defaultApprover={defaultApprover}
          editingExpense={editingExpense}
          onBack={() => {
            setShowForm(false);
            setEditingExpense(null);
          }}
          onSaved={loadExpenses}
          onCategoryCreated={loadCategories}
        />
        {confirm.dialog}
        {cancelReason.dialog}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        icon={Receipt}
        title={t('expenses.pageIntro.title')}
        description={t('expenses.pageIntro.description')}
      />
      <PageToolbar
        actions={
          <>
            <Button
              onClick={() => {
                setEditingExpense(null);
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" /> {t('expenses.addExpense')}
            </Button>
            <Button
              variant="outline"
              onClick={() => void exportPdf()}
              title={t('common.exportPdf')}
            >
              <FileDown className="h-4 w-4" />
              {t('common.exportPdf')}
            </Button>
            {excelExportEnabled ? (
              <Button
                variant="outline"
                onClick={() => void exportExcel()}
                title={t('common.exportExcel')}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t('common.exportExcel')}
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled
                title={t('common.excelExportDisabled')}
              >
                <FileSpreadsheet className="h-4 w-4 opacity-40" />
                {t('common.exportExcel')}
              </Button>
            )}
          </>
        }
      >
        <ToolbarField
          label={t('common.search')}
          htmlFor="expenses-search"
          className="min-w-[18rem] flex-1 basis-[18rem]"
        >
          <TableSearchField
            id="expenses-search"
            value={query}
            onChange={setQuery}
            placeholder={t('expenses.searchPlaceholder')}
            className="max-w-none"
          />
        </ToolbarField>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-white/85">{t('expenses.filterFrom')}</label>
          <DatePicker
            value={filterFrom}
            onChange={setFilterFrom}
            placeholder={t('expenses.dateFromPlaceholder')}
            className="h-10 w-44"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-white/85">{t('expenses.filterTo')}</label>
          <DatePicker
            value={filterTo}
            onChange={setFilterTo}
            placeholder={t('expenses.dateToPlaceholder')}
            className="h-10 w-44"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-white/85">
            {t('expenses.filterCategory')}
          </label>
          <Select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="h-10 w-52"
          >
            <option value="">{t('common.all')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-white/85">{t('expenses.filterMode')}</label>
          <Select
            value={filterPaymentMode}
            onChange={(e) => setFilterPaymentMode(e.target.value)}
            className="h-10 w-52"
          >
            <option value="">{t('common.allMasc')}</option>
            {PAYMENT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {translatePaymentMode(mode, t)}
              </option>
            ))}
          </Select>
        </div>
      </PageToolbar>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <SummaryCallout
        icon={Wallet}
        variant={grandTotal > 0 ? 'warning' : 'idle'}
        title={t('expenses.totalsTitle')}
        description={t('expenses.totalsHint')}
        stats={[
          {
            label: t('expenses.grandTotalLabel'),
            value: fmtCurrency(grandTotal),
          },
          ...totals.map((tot) => ({
            label: tot.category_name || t('expenses.uncategorized'),
            value: fmtCurrency(tot.total),
          })),
        ]}
      />

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t('expenses.empty')}
              actionLabel={t('expenses.addExpense')}
              onAction={() => {
                setEditingExpense(null);
                setShowForm(true);
              }}
            />
          ) : (
            <DataGrid columns={columns} data={filtered} getRowId={(e) => String(e.id)} />
          )}
        </CardContent>
      </Card>
      {confirm.dialog}
      {cancelReason.dialog}
    </div>
  );
}
