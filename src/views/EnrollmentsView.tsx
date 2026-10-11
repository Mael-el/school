import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { ClipboardList, Pencil, Plus, Printer, RotateCcw, Trash2, UserMinus, Wallet } from 'lucide-react';
import type { ClassLevelStructured, EnrollmentBalance, Student } from '../lib/types';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { DataGrid } from '../components/ui/data-grid';
import { PaymentStatusBadge } from '../components/ui/payment-status-badge';
import type { BalanceStatus } from '../components/ui/payment-status-badge';
import { EmptyState } from '../components/ui/empty-state';
import {
  PageToolbar,
  TableSearchField,
  ToolbarField,
} from '../components/ui/page-toolbar';
import { SummaryCallout } from '../components/ui/summary-callout';
import { PageIntro } from '../components/ui/page-intro';
import { StatusPill, enrollmentTone } from '../components/ui/status-pill';
import { labelForSection } from '../lib/class-levels';
import { translateSection } from '../lib/i18n-domain';
import { fmtCurrency } from '../lib/format';
import { PrintPreviewView } from './PrintPreviewView';
import {
  EMPTY_ENROLLMENT_FORM,
  EnrollmentFormView,
  type EnrollmentFormState,
} from './EnrollmentFormView';
import { usePrintPreview } from '../hooks/use-print-preview';
import { printErrorMessage } from '../lib/print';
import { notify } from '../lib/notify';
import { useConfirmDialog } from '../hooks/use-confirm-dialog';
import {
  TableActionButton,
  TableActionGroup,
} from '../components/ui/table-action-button';

const PAYMENT_STATUSES: BalanceStatus[] = [
  'Payé',
  'Paiement partiel',
  'Non payé',
  'Trop-perçu',
];

function paymentStatusLabel(status: BalanceStatus, t: (key: string) => string) {
  if (status === 'Payé') return t('status.paymentBalance.paid');
  if (status === 'Paiement partiel') return t('status.paymentBalance.partial');
  if (status === 'Non payé') return t('status.paymentBalance.unpaid');
  return t('status.paymentBalance.overpaid');
}

function enrollmentStatusLabel(
  status: 'Actif' | 'Transféré' | 'Retiré' | undefined,
  t: (key: string) => string,
) {
  if (status === 'Transféré') return t('enum.enrollmentStatus.transferred');
  if (status === 'Retiré') return t('enum.enrollmentStatus.withdrawn');
  return t('enum.enrollmentStatus.active');
}

export function EnrollmentsView({ schoolYear }: { schoolYear: string }) {
  const { t } = useTranslation();
  const confirm = useConfirmDialog();
  const [balances, setBalances] = useState<EnrollmentBalance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [structuredLevels, setStructuredLevels] = useState<ClassLevelStructured[]>(
    [],
  );
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [formInitial, setFormInitial] =
    useState<EnrollmentFormState>(EMPTY_ENROLLMENT_FORM);
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<number | null>(
    null,
  );
  const [query, setQuery] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterSection, setFilterSection] = useState<
    '' | 'Francophone' | 'Anglophone'
  >('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const { preview, openPreview, closePreview, confirmPreview } =
    usePrintPreview();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return balances.filter((row) => {
      if (q) {
        const haystack =
          `${row.full_name} ${row.matricule} ${row.registration_no ?? ''} ${row.class_name}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterClassId && String(row.class_level_id) !== filterClassId) {
        return false;
      }
      if (filterSection && row.section !== filterSection) return false;
      if (filterStatus && row.status !== filterStatus) return false;
      return true;
    });
  }, [balances, query, filterClassId, filterSection, filterStatus]);

  const yearTotals = useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        acc.expected += row.expected_fee;
        acc.paid += row.total_paid;
        acc.balance += row.balance;
        return acc;
      },
      { expected: 0, paid: 0, balance: 0 },
    );
  }, [filtered]);

  const load = async () => {
    if (!schoolYear) {
      setBalances([]);
      return;
    }
    const [list, allStudents, levels] = await Promise.all([
      window.api.enrollments.listBalancesForYear(schoolYear, showInactive),
      window.api.students.list(showInactive),
      window.api.classLevels.listStructured(),
    ]);
    setBalances(list);
    setStudents(allStudents);
    setStructuredLevels(levels);
  };

  useEffect(() => {
    void load();
  }, [schoolYear, showInactive]);

  const startCreate = () => {
    setEditingEnrollmentId(null);
    setFormInitial(EMPTY_ENROLLMENT_FORM);
    setFormMode('create');
  };

  const startEdit = async (row: EnrollmentBalance) => {
    const enrollment = await window.api.enrollments.listForStudent(row.student_id);
    const current = enrollment.find((e) => e.id === row.enrollment_id);
    setEditingEnrollmentId(row.enrollment_id);
    setFormInitial({
      studentId: String(row.student_id),
      classLevelId: String(row.class_level_id),
      section: row.section ?? '',
      registrationNo: row.registration_no ?? '',
      registrationDate: current?.registration_date ?? '',
      enrollmentStatus: current?.status ?? 'Actif',
    });
    setFormMode('edit');
  };

  const reactivateEnrollment = async (row: EnrollmentBalance) => {
    try {
      await window.api.enrollments.update(row.enrollment_id, { status: 'Actif' });
      notify.success(t('enrollments.reactivated'));
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const withdrawEnrollment = async (row: EnrollmentBalance) => {
    const ok = await confirm.ask({
      title: t('enrollments.withdrawTitle'),
      description: t('enrollments.withdrawDescription', {
        name: row.full_name,
      }),
      confirmLabel: t('enrollments.withdrawConfirm'),
    });
    if (!ok) return;
    try {
      await window.api.enrollments.update(row.enrollment_id, {
        status: 'Retiré',
      });
      notify.success(t('enrollments.withdrawn'));
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteEnrollment = async (row: EnrollmentBalance) => {
    const ok = await confirm.ask({
      title: t('enrollments.deleteTitle'),
      description: t('enrollments.deleteDescription', {
        name: row.full_name,
      }),
      confirmLabel: t('enrollments.deleteConfirm'),
    });
    if (!ok) return;
    try {
      await window.api.enrollments.delete(row.enrollment_id);
      notify.success(t('enrollments.deleted'));
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const columns = useMemo<ColumnDef<EnrollmentBalance>[]>(
    () => [
      {
        accessorKey: 'registration_no',
        header: t('enrollments.columns.registrationNo'),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-medium">
            {getValue<string | null>() ?? t('common.dash')}
          </span>
        ),
      },
      {
        accessorKey: 'matricule',
        header: t('enrollments.columns.matricule'),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-white/70">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'full_name',
        header: t('enrollments.columns.fullName'),
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'class_name',
        header: t('enrollments.columns.class'),
      },
      {
        id: 'section',
        accessorFn: (row) => row.section,
        header: t('enrollments.columns.section'),
        cell: ({ row }) => translateSection(row.original.section, t),
      },
      {
        accessorKey: 'expected_fee',
        header: t('enrollments.columns.expectedFee'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
      {
        accessorKey: 'total_paid',
        header: t('enrollments.columns.totalPaid'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
      {
        accessorKey: 'balance',
        header: t('enrollments.columns.balance'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: t('enrollments.columns.situation'),
        cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
      },
      ...(showInactive
        ? [
            {
              id: 'enrollment_status',
              accessorFn: (row: EnrollmentBalance) => row.enrollment_status,
              header: t('enrollments.columns.enrollmentStatus'),
              cell: ({ row }: { row: { original: EnrollmentBalance } }) => (
                <StatusPill
                  tone={enrollmentTone(row.original.enrollment_status)}
                  label={enrollmentStatusLabel(
                    row.original.enrollment_status,
                    t,
                  )}
                />
              ),
            } satisfies ColumnDef<EnrollmentBalance>,
          ]
        : []),
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableResizing: false,
        size: 320,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const status = row.original.enrollment_status ?? 'Actif';
          const inactive = status !== 'Actif';
          return (
            <TableActionGroup>
              <TableActionButton
                icon={Pencil}
                label={t('common.edit')}
                onClick={() => void startEdit(row.original)}
              />
              {showInactive && inactive ? (
                <TableActionButton
                  icon={RotateCcw}
                  label={t('common.reactivate')}
                  tone="primary"
                  onClick={() => void reactivateEnrollment(row.original)}
                />
              ) : !inactive ? (
                <TableActionButton
                  icon={UserMinus}
                  label={t('enrollments.withdraw')}
                  tone="warning"
                  onClick={() => void withdrawEnrollment(row.original)}
                />
              ) : null}
              <TableActionButton
                icon={Trash2}
                label={t('common.delete')}
                tone="destructive"
                onClick={() => void deleteEnrollment(row.original)}
              />
            </TableActionGroup>
          );
        },
      },
    ],
    [t, showInactive],
  );

  const handlePrintRoster = async () => {
    if (!schoolYear) return;
    try {
      await openPreview(() =>
        window.api.print.classRosterHtml(schoolYear, {
          classLevelId: filterClassId ? Number(filterClassId) : undefined,
        }),
      );
    } catch (err) {
      notify.error(printErrorMessage(err));
    }
  };

  if (!schoolYear) {
    return (
      <>
        <EmptyState
          icon={ClipboardList}
          title={t('enrollments.needSchoolYear')}
          description={t('shell.schoolYearPlaceholder')}
        />
        {confirm.dialog}
      </>
    );
  }

  if (preview) {
    return (
      <>
        <PrintPreviewView
          title={t('enrollments.rosterPreview')}
          html={preview.html}
          defaultFileName={preview.defaultFileName}
          onBack={closePreview}
          onSave={async () => {
            await confirmPreview(t('enrollments.rosterSaved'));
          }}
        />
        {confirm.dialog}
      </>
    );
  }

  if (formMode) {
    return (
      <>
        <EnrollmentFormView
          mode={formMode}
          schoolYear={schoolYear}
          structuredLevels={structuredLevels}
          students={students}
          initialForm={formInitial}
          editingEnrollmentId={editingEnrollmentId}
          onBack={() => setFormMode(null)}
          onSaved={load}
        />
        {confirm.dialog}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        icon={ClipboardList}
        title={t('enrollments.pageIntro.title')}
        description={t('enrollments.pageIntro.description')}
      />

      <PageToolbar
        actions={
          <>
            <Button variant="outline" onClick={() => void handlePrintRoster()}>
              <Printer className="h-4 w-4" /> {t('enrollments.printRoster')}
            </Button>
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4" /> {t('enrollments.newEnrollment')}
            </Button>
          </>
        }
      >
        <ToolbarField
          label={t('common.search')}
          htmlFor="enrollments-search"
          className="min-w-[18rem] flex-1 basis-[18rem]"
        >
          <TableSearchField
            id="enrollments-search"
            value={query}
            onChange={setQuery}
            placeholder={t('enrollments.searchPlaceholder')}
            className="max-w-none"
          />
        </ToolbarField>
        <ToolbarField
          label={t('enrollments.filters.class')}
          htmlFor="enrollments-class"
          className="min-w-[14rem] flex-1 basis-[14rem] max-w-xs"
        >
          <Select
            id="enrollments-class"
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="h-10 w-full"
            aria-label={t('enrollments.rosterClassFilter')}
          >
            <option value="">{t('enrollments.filters.allClasses')}</option>
            {structuredLevels.map((level) => (
              <option key={level.id} value={level.id}>
                {labelForSection(level, filterSection || null)}
                {level.code ? ` (${level.code})` : ''}
              </option>
            ))}
          </Select>
        </ToolbarField>
        <ToolbarField
          label={t('enrollments.filters.section')}
          htmlFor="enrollments-section"
          className="min-w-[12rem] basis-[12rem]"
        >
          <Select
            id="enrollments-section"
            value={filterSection}
            onChange={(e) =>
              setFilterSection(
                e.target.value as '' | 'Francophone' | 'Anglophone',
              )
            }
            className="h-10 w-full"
          >
            <option value="">{t('enrollments.filters.allSections')}</option>
            <option value="Francophone">{t('enum.section.francophone')}</option>
            <option value="Anglophone">{t('enum.section.anglophone')}</option>
          </Select>
        </ToolbarField>
        <ToolbarField
          label={t('enrollments.filters.status')}
          htmlFor="enrollments-status"
          className="min-w-[13rem] basis-[13rem]"
        >
          <Select
            id="enrollments-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 w-full"
          >
            <option value="">{t('enrollments.filters.allStatuses')}</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {paymentStatusLabel(status, t)}
              </option>
            ))}
          </Select>
        </ToolbarField>
        <ToolbarField
          label={t('enrollments.showInactive')}
          htmlFor="enrollments-inactive"
          className="min-w-[12rem] basis-[12rem]"
        >
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-white/85">
            <input
              id="enrollments-inactive"
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-white/30"
            />
            {t('common.showInactive')}
          </label>
        </ToolbarField>
      </PageToolbar>

      {filtered.length > 0 && (
        <SummaryCallout
          icon={Wallet}
          variant={yearTotals.balance > 0 ? 'warning' : 'ready'}
          title={t('enrollments.listSummary.title')}
          description={t('enrollments.title', { year: schoolYear })}
          hint={t('enrollments.listSummary.hint')}
          stats={[
            {
              label: t('report.expectedFee'),
              value: fmtCurrency(yearTotals.expected),
            },
            {
              label: t('report.totalPaid'),
              value: fmtCurrency(yearTotals.paid),
            },
            {
              label: t('payments.preview.balance'),
              value: fmtCurrency(yearTotals.balance),
            },
          ]}
        />
      )}

      <Card>
        <CardContent className="p-0">
          {balances.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t('enrollments.empty')}
              actionLabel={t('enrollments.newEnrollment')}
              onAction={startCreate}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t('enrollments.emptyFiltered')}
            />
          ) : (
            <DataGrid
              columns={columns}
              data={filtered}
              getRowId={(row) => String(row.enrollment_id)}
            />
          )}
        </CardContent>
      </Card>
      {confirm.dialog}
    </div>
  );
}
