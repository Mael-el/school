import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, Pencil, Plus, Trash2, Users, Wallet } from 'lucide-react';
import type {
  ClassLevelStructured,
  EnrollmentBalance,
  Student,
} from '../lib/types';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { PaymentStatusBadge } from '../components/ui/payment-status-badge';
import type { BalanceStatus } from '../components/ui/payment-status-badge';
import { DataGrid } from '../components/ui/data-grid';
import { EmptyState } from '../components/ui/empty-state';
import {
  PageToolbar,
  TableSearchField,
  ToolbarField,
} from '../components/ui/page-toolbar';
import { SummaryCallout } from '../components/ui/summary-callout';
import { PageIntro } from '../components/ui/page-intro';
import { StudentDetailView } from './StudentDetailView';
import {
  EMPTY_STUDENT_FORM,
  StudentFormView,
  type StudentFormState,
} from './StudentFormView';
import { translateSection } from '../lib/i18n-domain';
import { fmtCurrency } from '../lib/format';
import {
  TableActionButton,
  TableActionGroup,
} from '../components/ui/table-action-button';
import { notify } from '../lib/notify';
import { useConfirmDialog } from '../hooks/use-confirm-dialog';

const PAYMENT_STATUSES: BalanceStatus[] = [
  'Payé',
  'Paiement partiel',
  'Non payé',
  'Trop-perçu',
];

export function StudentsView({
  schoolYear,
  focusStudentId = null,
  onFocusStudentIdConsumed,
  entry = { mode: 'list' as const, nonce: 0 },
}: {
  schoolYear: string;
  focusStudentId?: number | null;
  onFocusStudentIdConsumed?: () => void;
  entry?: { mode: 'list' | 'create'; nonce: number };
} = { schoolYear: '' }) {
  const { t } = useTranslation();
  const confirm = useConfirmDialog();
  const [balances, setBalances] = useState<EnrollmentBalance[]>([]);
  const [structuredLevels, setStructuredLevels] = useState<ClassLevelStructured[]>(
    [],
  );
  const [query, setQuery] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [formInitial, setFormInitial] =
    useState<StudentFormState>(EMPTY_STUDENT_FORM);
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<number | null>(
    null,
  );

  const load = async () => {
    if (!schoolYear) {
      setBalances([]);
      return;
    }
    const [list, levels] = await Promise.all([
      window.api.enrollments.listBalancesForYear(schoolYear, showInactive),
      window.api.classLevels.listStructured(),
    ]);
    setBalances(list);
    setStructuredLevels(levels);
  };

  useEffect(() => {
    void load();
  }, [schoolYear, showInactive]);

  useEffect(() => {
    if (entry.mode === 'create') {
      startCreate();
      return;
    }
    setFormMode(null);
    setDetailStudent(null);
  }, [entry.mode, entry.nonce]);

  useEffect(() => {
    if (!focusStudentId) return;
    void (async () => {
      const student = await window.api.students.getById(focusStudentId);
      if (student) setDetailStudent(student);
      onFocusStudentIdConsumed?.();
    })();
  }, [focusStudentId, onFocusStudentIdConsumed]);

  const startCreate = () => {
    setEditingStudentId(null);
    setEditingEnrollmentId(null);
    setFormInitial(EMPTY_STUDENT_FORM);
    setFormMode('create');
  };

  const startEdit = async (row: EnrollmentBalance) => {
    const student = await window.api.students.getById(row.student_id);
    if (!student) return;
    setEditingStudentId(student.id);
    setEditingEnrollmentId(row.enrollment_id);
    setFormInitial({
      matricule: student.matricule,
      full_name: student.full_name,
      gender: student.gender ?? '',
      birth_date: student.birth_date ?? '',
      guardian_name: student.guardian_name ?? '',
      guardian_phone: student.guardian_phone ?? '',
      neighborhood: student.neighborhood ?? '',
      section: row.section ?? '',
      class_level_id: String(row.class_level_id),
      registration_no: row.registration_no ?? '',
      registration_date: '',
    });
    setFormMode('edit');
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return balances.filter((b) => {
      if (q) {
        const haystack =
          `${b.full_name} ${b.matricule} ${b.class_name} ${b.registration_no ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterClassId && String(b.class_level_id) !== filterClassId) {
        return false;
      }
      if (filterSection && b.section !== filterSection) return false;
      if (filterStatus && b.status !== filterStatus) return false;
      return true;
    });
  }, [balances, query, filterClassId, filterSection, filterStatus]);

  const listTotals = useMemo(() => {
    const withBalance = filtered.filter((row) => row.balance > 0).length;
    const totalBalance = filtered.reduce((sum, row) => sum + row.balance, 0);
    return { count: filtered.length, withBalance, totalBalance };
  }, [filtered]);

  const startEditRow = (row: EnrollmentBalance) => void startEdit(row);
  const showDetail = (row: EnrollmentBalance) =>
    void window.api.students
      .getById(row.student_id)
      .then((s) => s && setDetailStudent(s));

  const deleteStudent = async (row: EnrollmentBalance) => {
    const ok = await confirm.ask({
      title: t('students.deleteTitle'),
      description: t('students.deleteDescription', {
        name: row.full_name,
      }),
      confirmLabel: t('students.deleteConfirm'),
    });
    if (!ok) return;
    try {
      await window.api.students.delete(row.student_id);
      notify.success(t('students.deleted'));
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const columns = useMemo<ColumnDef<EnrollmentBalance>[]>(
    () => [
      {
        accessorKey: 'matricule',
        header: t('students.columns.matricule'),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'full_name',
        header: t('students.columns.fullName'),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.full_name}
            {row.original.student_status === 'Archivé' && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                {t('students.archivedBadge')}
              </span>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'class_name',
        header: t('students.columns.class'),
      },
      {
        id: 'section',
        accessorFn: (row) => row.section,
        header: t('students.columns.section'),
        cell: ({ row }) => translateSection(row.original.section, t),
      },
      {
        accessorKey: 'balance',
        header: t('students.columns.balance'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: t('students.columns.status'),
        cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        size: 260,
        cell: ({ row }) => (
          <TableActionGroup>
            <TableActionButton
              icon={Eye}
              label={t('common.details')}
              tone="primary"
              onClick={() => showDetail(row.original)}
            />
            <TableActionButton
              icon={Pencil}
              label={t('common.edit')}
              onClick={() => startEditRow(row.original)}
            />
            <TableActionButton
              icon={Trash2}
              label={t('common.delete')}
              tone="destructive"
              onClick={() => void deleteStudent(row.original)}
            />
          </TableActionGroup>
        ),
        meta: { align: 'right' },
      },
    ],
    [t],
  );

  if (!schoolYear) {
    return (
      <>
        <EmptyState
          icon={Users}
          title={t('students.needSchoolYear')}
          description={t('shell.schoolYearPlaceholder')}
        />
        {confirm.dialog}
      </>
    );
  }

  if (detailStudent) {
    return (
      <>
        <StudentDetailView
          student={detailStudent}
          onBack={() => setDetailStudent(null)}
          onArchived={() => void load()}
          onReactivated={() => void load()}
          onDeleted={() => void load()}
        />
        {confirm.dialog}
      </>
    );
  }

  if (formMode) {
    return (
      <>
        <StudentFormView
          mode={formMode}
          schoolYear={schoolYear}
          structuredLevels={structuredLevels}
          initialForm={formInitial}
          editingStudentId={editingStudentId}
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
        icon={Users}
        title={t('students.pageIntro.title')}
        description={t('students.pageIntro.description')}
      />

      <PageToolbar
        actions={
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" /> {t('students.addStudent')}
          </Button>
        }
      >
        <ToolbarField
          label={t('common.search')}
          htmlFor="students-search"
          className="min-w-[18rem] flex-1 basis-[18rem]"
        >
          <TableSearchField
            id="students-search"
            value={query}
            onChange={setQuery}
            placeholder={t('students.searchPlaceholder')}
            className="max-w-none"
          />
        </ToolbarField>
        <ToolbarField
          label={t('students.columns.class')}
          htmlFor="students-class"
          className="min-w-[14rem] flex-1 basis-[14rem] max-w-xs"
        >
          <Select
            id="students-class"
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="h-10 w-full"
          >
            <option value="">{t('students.filters.allClasses')}</option>
            {structuredLevels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.code ?? level.name}
              </option>
            ))}
          </Select>
        </ToolbarField>
        <ToolbarField
          label={t('students.columns.section')}
          htmlFor="students-section"
          className="min-w-[12rem] basis-[12rem]"
        >
          <Select
            id="students-section"
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            className="h-10 w-full"
          >
            <option value="">{t('students.filters.allSections')}</option>
            <option value="Francophone">{t('enum.section.francophone')}</option>
            <option value="Anglophone">{t('enum.section.anglophone')}</option>
          </Select>
        </ToolbarField>
        <ToolbarField
          label={t('students.columns.status')}
          htmlFor="students-status"
          className="min-w-[13rem] basis-[13rem]"
        >
          <Select
            id="students-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 w-full"
          >
            <option value="">{t('students.filters.allStatuses')}</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === 'Payé'
                  ? t('status.paymentBalance.paid')
                  : status === 'Paiement partiel'
                    ? t('status.paymentBalance.partial')
                    : status === 'Non payé'
                      ? t('status.paymentBalance.unpaid')
                      : t('status.paymentBalance.overpaid')}
              </option>
            ))}
          </Select>
        </ToolbarField>
        <ToolbarField
          label={t('students.showInactive')}
          htmlFor="students-inactive"
          className="min-w-[12rem] basis-[12rem]"
        >
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-white/85">
            <input
              id="students-inactive"
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
          variant={listTotals.totalBalance > 0 ? 'warning' : 'ready'}
          title={t('students.listSummary.title')}
          description={schoolYear}
          hint={t('students.listSummary.hint')}
          stats={[
            {
              label: t('students.listSummary.enrolled'),
              value: String(listTotals.count),
            },
            {
              label: t('students.listSummary.withBalance'),
              value: String(listTotals.withBalance),
            },
            {
              label: t('students.listSummary.totalOutstanding'),
              value: fmtCurrency(listTotals.totalBalance),
            },
          ]}
        />
      )}

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title={
                balances.length === 0
                  ? t('students.emptyYear')
                  : t('students.emptyFiltered')
              }
              actionLabel={
                balances.length === 0 ? t('students.addStudent') : undefined
              }
              onAction={balances.length === 0 ? startCreate : undefined}
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
