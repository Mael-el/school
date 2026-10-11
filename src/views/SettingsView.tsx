// School settings: identity, per-section class fees, reference lists,
// advanced options, backup, and year closeout.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Save,
  Upload,
  ArrowRightLeft,
  DatabaseBackup,
  Plus,
  RotateCcw,
  Trash2,
  School,
  GraduationCap,
  Tags,
  SlidersHorizontal,
  CalendarRange,
  Building2,
  ReceiptText,
  ImageIcon,
  Users,
  HardDrive,
  Table2,
  Wallet,
  FileSpreadsheet,
  Copy,
  UserCheck,
  CheckCircle2,
  ScrollText,
  FolderOpen,
  Eraser,
  DatabaseZap,
} from 'lucide-react';
import type {
  BackupStatus,
  Cashier,
  ClassFee,
  ClassLevelStructured,
  ExpenseCategory,
  PaymentCategory,
} from '../lib/types';
import type { FixtureProfileId } from '../main/services/FixtureService';
import { suggestNextSchoolYear } from '../../shared/next-code';
import { setActiveCurrency } from '../lib/format';
import { Button } from '../components/ui/button';
import { TableActionButton } from '../components/ui/table-action-button';
import { Input } from '../components/ui/input';
import { NumberInput } from '../components/ui/number-input';
import { PhoneInput } from '../components/ui/phone-input';
import { Select } from '../components/ui/select';
import { FormField, FormRow } from '../components/forms';
import { SettingsNav } from '../components/settings/settings-nav';
import { SettingsPanel } from '../components/settings/settings-panel';
import { labelForSection } from '../lib/class-levels';
import { currentLocaleTag } from '../i18n';
import { TABLE_PAGE_SIZE_OPTIONS } from '../lib/table-page-size';
import { notify } from '../lib/notify';
import { scheduleReloadToast } from '../lib/reload-toast';
import { useConfirmDialog } from '../hooks/use-confirm-dialog';
import {
  CLEAR_GROUPS,
  CONFIG_CLEAR_GROUPS,
  OPERATIONAL_CLEAR_GROUPS,
  expandClearSelection,
  type ClearCounts,
  type ClearGroup,
  type ClearResult,
  type ClearSelection,
} from '../../shared/clear-selection';

type Tab =
  'general' | 'fees' | 'reference' | 'advanced' | 'closeout' | 'cleanup';
type AdvancedGroup = 'display' | 'staff' | 'expenses' | 'documents' | 'backup';
type Section = 'Francophone' | 'Anglophone';

interface CloseoutSummary {
  feesCopied: number;
  feesSkippedExisting: number;
  enrollmentsCreated: number;
  enrollmentsSkippedExisting: number;
}

const TAB_ICONS = {
  general: School,
  fees: GraduationCap,
  reference: Tags,
  advanced: SlidersHorizontal,
  closeout: CalendarRange,
  cleanup: Eraser,
} as const;

const GENERAL_KEYS = [
  'school_name',
  'school_short_name',
  'address',
  'phone',
  'email',
  'director_name',
  'ministry_name',
  'ministry_name_en',
  'country_name',
  'print_header_line',
  'receipt_prefix',
  'staff_receipt_prefix',
  'expense_reference_prefix',
  'receipt_message',
  'currency',
] as const;

const ADVANCED_FIELDS: {
  key: string;
  labelKey: string;
  type: 'select' | 'text' | 'number';
  group: AdvancedGroup;
  mode?: 'integer' | 'decimal';
  options?: { value: string; labelKey?: string; label?: string }[];
}[] = [
  {
    key: 'table_page_size',
    labelKey: 'settings.advanced.tablePageSize',
    group: 'display',
    type: 'select',
    options: TABLE_PAGE_SIZE_OPTIONS.map((size) => ({
      value: String(size),
      label: String(size),
    })),
  },
  {
    key: 'staff_salary_mode',
    labelKey: 'settings.advanced.staffSalaryMode',
    group: 'staff',
    type: 'select',
    options: [
      { value: 'fixe', labelKey: 'settings.advanced.salaryFixed' },
      { value: 'variable', labelKey: 'settings.advanced.salaryVariable' },
    ],
  },
  {
    key: 'expense_approval_required',
    labelKey: 'settings.advanced.expenseApproval',
    group: 'expenses',
    type: 'select',
    options: [
      { value: '0', labelKey: 'settings.advanced.no' },
      { value: '1', labelKey: 'settings.advanced.yes' },
    ],
  },
  {
    key: 'expense_approver_name',
    labelKey: 'settings.advanced.expenseApprover',
    group: 'expenses',
    type: 'text',
  },
  {
    key: 'expense_budget_limit',
    labelKey: 'settings.advanced.expenseBudgetLimit',
    group: 'expenses',
    type: 'number',
    mode: 'decimal',
  },
  {
    key: 'receipt_paper_format',
    labelKey: 'settings.advanced.receiptFormat',
    group: 'documents',
    type: 'select',
    options: [
      { value: 'A4', labelKey: 'settings.advanced.formatA4' },
      { value: 'ticket', labelKey: 'settings.advanced.formatTicket' },
    ],
  },
  {
    key: 'excel_export_enabled',
    labelKey: 'settings.advanced.excelExport',
    group: 'documents',
    type: 'select',
    options: [
      { value: '0', labelKey: 'settings.advanced.no' },
      { value: '1', labelKey: 'settings.advanced.yes' },
    ],
  },
  {
    key: 'document_language_mode',
    labelKey: 'settings.advanced.documentLanguage',
    group: 'documents',
    type: 'select',
    options: [
      { value: 'fr_only', labelKey: 'settings.advanced.docFrOnly' },
      { value: 'en_only', labelKey: 'settings.advanced.docEnOnly' },
      { value: 'bilingual_fr_en', labelKey: 'settings.advanced.docBilingual' },
    ],
  },
  {
    key: 'backup_reminder_days',
    labelKey: 'settings.advanced.backupReminder',
    group: 'backup',
    type: 'number',
    mode: 'integer',
  },
  {
    key: 'auto_backup_enabled',
    labelKey: 'settings.advanced.autoBackup',
    group: 'backup',
    type: 'select',
    options: [
      { value: '0', labelKey: 'settings.advanced.no' },
      { value: '1', labelKey: 'settings.advanced.yes' },
    ],
  },
  {
    key: 'auto_backup_interval_days',
    labelKey: 'settings.advanced.autoBackupInterval',
    group: 'backup',
    type: 'number',
    mode: 'integer',
  },
];

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(currentLocaleTag());
}

export function SettingsView({ schoolYear }: { schoolYear: string }) {
  const { t } = useTranslation();
  const confirm = useConfirmDialog();
  const [tab, setTab] = useState<Tab>('general');
  const [logInfo, setLogInfo] = useState<{
    path: string | null;
    tail: string;
  } | null>(null);
  const [settings, setSettings] = useState<Record<string, string | null>>({});
  const [saved, setSaved] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const [structuredLevels, setStructuredLevels] = useState<
    ClassLevelStructured[]
  >([]);
  const [classFees, setClassFees] = useState<ClassFee[]>([]);
  const [feeYear, setFeeYear] = useState(schoolYear);
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});
  const [newClassCode, setNewClassCode] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newClassSection, setNewClassSection] =
    useState<Section>('Francophone');

  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(
    [],
  );
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newExpenseCategoryName, setNewExpenseCategoryName] = useState('');
  const [newCashierName, setNewCashierName] = useState('');

  const [schoolYearOptions, setSchoolYearOptions] = useState<string[]>([]);
  const [closeoutFrom, setCloseoutFrom] = useState('');
  const [closeoutTo, setCloseoutTo] = useState('');
  const [closeoutSummary, setCloseoutSummary] =
    useState<CloseoutSummary | null>(null);
  const [closeoutRunning, setCloseoutRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [cleanupSelection, setCleanupSelection] = useState<ClearSelection>({});
  const [cleanupPreview, setCleanupPreview] = useState<ClearCounts | null>(
    null,
  );
  const [cleanupResult, setCleanupResult] = useState<ClearResult | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  // Unchecked by default: loading a named profile should bring that school's
  // identity (name, contacts, options); checking this keeps the current ones.
  const [keepSettingsOnLoad, setKeepSettingsOnLoad] = useState(false);
  const [fixtureProfile, setFixtureProfile] =
    useState<FixtureProfileId>('demo');
  const [fixturesBusy, setFixturesBusy] = useState(false);

  const tabs = useMemo(
    () =>
      (Object.keys(TAB_ICONS) as Tab[]).map((id) => ({
        id,
        label: t(`settings.tabs.${id}`),
        icon: TAB_ICONS[id],
      })),
    [t],
  );

  const feeYearOptions = useMemo(() => {
    const years = new Set(schoolYearOptions);
    if (schoolYear) years.add(schoolYear);
    return Array.from(years);
  }, [schoolYear, schoolYearOptions]);

  const defaultCloseoutFrom = schoolYear || schoolYearOptions[0] || '';

  const closeoutFromOptions = useMemo(() => {
    const years = new Set(schoolYearOptions);
    if (schoolYear) years.add(schoolYear);
    if (closeoutFrom) years.add(closeoutFrom);
    return [...years].sort().reverse();
  }, [schoolYear, schoolYearOptions, closeoutFrom]);

  const closeoutToOptions = useMemo(() => {
    const years = new Set(schoolYearOptions);
    if (schoolYear) years.add(schoolYear);
    if (closeoutFrom) {
      const suggested = suggestNextSchoolYear(closeoutFrom);
      if (suggested) years.add(suggested);
    }
    if (closeoutTo) years.add(closeoutTo);
    return [...years].sort().reverse();
  }, [schoolYear, schoolYearOptions, closeoutFrom, closeoutTo]);

  const loadBackupStatus = async () => {
    setBackupStatus(await window.api.backup.getStatus());
  };

  const loadAll = async () => {
    const [all, levels, cats, expCats, cash, years, logo] = await Promise.all([
      window.api.settings.getAll(),
      window.api.classLevels.listStructured(),
      window.api.reference.paymentCategories(),
      window.api.reference.expenseCategories(),
      window.api.reference.cashiers(),
      window.api.schoolYears.list(),
      window.api.settings.getLogoDataUrl(),
    ]);
    setSettings(all);
    setActiveCurrency(all.currency);
    setStructuredLevels(levels);
    setCategories(cats);
    setExpenseCategories(expCats);
    setCashiers(cash);
    setSchoolYearOptions(years);
    setLogoDataUrl(logo);
  };

  useEffect(() => {
    if (!defaultCloseoutFrom) return;
    setCloseoutFrom((prev) => prev || defaultCloseoutFrom);
  }, [defaultCloseoutFrom]);

  useEffect(() => {
    if (!closeoutFrom) return;
    const suggested = suggestNextSchoolYear(closeoutFrom);
    if (!suggested) return;
    setCloseoutTo((prev) => prev || suggested);
  }, [closeoutFrom]);

  useEffect(() => {
    void loadAll();
    void loadBackupStatus();
  }, []);

  const loadLogInfo = async () => {
    try {
      setLogInfo(await window.api.system.getLogTail(100));
    } catch {
      setLogInfo(null);
    }
  };

  useEffect(() => {
    if (tab !== 'advanced') return;
    void loadLogInfo();
  }, [tab]);

  const loadCleanupPreview = async () => {
    try {
      setCleanupPreview(await window.api.dataCleanup.preview());
    } catch {
      setCleanupPreview(null);
    }
  };

  useEffect(() => {
    if (tab !== 'cleanup') return;
    void loadCleanupPreview();
  }, [tab]);

  useEffect(() => {
    setFeeYear(schoolYear);
  }, [schoolYear]);

  useEffect(() => {
    void (async () => {
      if (!feeYear) {
        setClassFees([]);
        return;
      }
      setClassFees(await window.api.classFees.listForYear(feeYear));
    })();
  }, [feeYear]);

  const feeDraftKey = (classLevelId: number, section: Section) =>
    `${classLevelId}-${section}`;

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const fee of classFees) {
      next[feeDraftKey(fee.class_level_id, fee.section as Section)] = String(
        fee.annual_fee,
      );
    }
    setFeeDrafts(next);
  }, [classFees]);

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const markSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const saveGeneral = async () => {
    try {
      await Promise.all(
        GENERAL_KEYS.map((key) =>
          window.api.settings.set(key, settings[key] ?? null),
        ),
      );
      setActiveCurrency(settings.currency);
      markSaved();
      notify.success(t('common.saved'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const saveAdvanced = async () => {
    try {
      await Promise.all(
        ADVANCED_FIELDS.map((field) =>
          window.api.settings.set(field.key, settings[field.key] ?? null),
        ),
      );
      markSaved();
      notify.success(t('common.saved'));
      void loadBackupStatus();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const pickLogo = async () => {
    const path = await window.api.settings.pickLogo();
    if (!path) return;
    updateSetting('school_logo_path', path);
    setLogoDataUrl(await window.api.settings.getLogoDataUrl());
  };

  const handleBackupNow = async () => {
    setBackupBusy(true);
    try {
      const result = await window.api.backup.createNow();
      if (!result.canceled) {
        notify.success(t('settings.backup.saved'));
        await loadBackupStatus();
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestore = async () => {
    const ok = await confirm.ask({
      title: t('common.confirmTitle'),
      description: t('settings.backup.restoreConfirm'),
      confirmLabel: t('common.continue'),
    });
    if (!ok) return;
    setBackupBusy(true);
    try {
      await window.api.backup.restore();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
      setBackupBusy(false);
    }
  };

  const addClassLevel = async (section: Section) => {
    const code = newClassCode.trim().toUpperCase();
    const name = newClassName.trim();
    if (!code || !name) {
      notify.error(t('settings.fees.addClassRequired'));
      return;
    }

    const existing = structuredLevels.find(
      (level) => (level.code ?? '').toUpperCase() === code,
    );
    const labels = {
      francophone:
        existing?.labels.find((label) => label.section === 'Francophone')
          ?.name ?? null,
      anglophone:
        existing?.labels.find((label) => label.section === 'Anglophone')
          ?.name ?? null,
    };
    if (section === 'Francophone') labels.francophone = name;
    else labels.anglophone = name;

    try {
      await window.api.classLevels.upsertStructured({
        id: existing?.id,
        code,
        display_order: existing?.display_order ?? structuredLevels.length + 1,
        labels,
      });
      setNewClassCode('');
      setNewClassName('');
      setStructuredLevels(await window.api.classLevels.listStructured());
      notify.success(t('settings.fees.classAdded'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const saveClassLabel = async (
    level: ClassLevelStructured,
    section: Section,
    rawName: string,
  ) => {
    const name = rawName.trim();
    const current = labelForSection(level, section);
    if (!name || name === current) return;

    const labels = {
      francophone:
        level.labels.find((label) => label.section === 'Francophone')?.name ??
        null,
      anglophone:
        level.labels.find((label) => label.section === 'Anglophone')?.name ??
        null,
    };
    if (section === 'Francophone') labels.francophone = name;
    else labels.anglophone = name;

    try {
      await window.api.classLevels.upsertStructured({
        id: level.id,
        code: level.code ?? level.name,
        display_order: level.display_order,
        labels,
      });
      setStructuredLevels(await window.api.classLevels.listStructured());
      notify.success(t('settings.fees.classUpdated'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const feeForClass = (classLevelId: number, section: Section) =>
    classFees.find(
      (fee) => fee.class_level_id === classLevelId && fee.section === section,
    )?.annual_fee;

  const getFeeDraft = (classLevelId: number, section: Section) => {
    const key = feeDraftKey(classLevelId, section);
    if (key in feeDrafts) return feeDrafts[key];
    const saved = feeForClass(classLevelId, section);
    return saved === undefined ? '' : String(saved);
  };

  const setFeeDraft = (
    classLevelId: number,
    section: Section,
    value: string,
  ) => {
    setFeeDrafts((prev) => ({
      ...prev,
      [feeDraftKey(classLevelId, section)]: value,
    }));
  };

  const commitFeeForClass = async (classLevelId: number, section: Section) => {
    const raw = getFeeDraft(classLevelId, section).trim();
    if (!feeYear) {
      notify.error(t('settings.fees.yearRequired'));
      return;
    }
    if (!raw) return;

    const amount = Number(raw);
    if (!Number.isFinite(amount)) return;

    const saved = feeForClass(classLevelId, section);
    if (saved !== undefined && saved === amount) return;

    try {
      await window.api.classFees.upsert({
        class_level_id: classLevelId,
        school_year: feeYear,
        section,
        annual_fee: amount,
      });
      setClassFees(await window.api.classFees.listForYear(feeYear));
      notify.success(t('settings.fees.feeSaved'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteSectionClass = async (
    level: ClassLevelStructured,
    section: Section,
  ) => {
    const className =
      labelForSection(level, section) || level.code || String(level.id);
    const ok = await confirm.ask({
      title: t('common.deleteConfirm'),
      description: t('settings.fees.deleteClassConfirm', { name: className }),
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    try {
      await window.api.classLevels.removeSectionClass({
        class_level_id: level.id,
        section,
      });
      setStructuredLevels(await window.api.classLevels.listStructured());
      notify.success(t('settings.fees.deleted'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      notify.error(t('settings.reference.nameRequired'));
      return;
    }
    try {
      await window.api.paymentCategories.create({
        name,
        description: null,
      });
      setNewCategoryName('');
      setCategories(await window.api.reference.paymentCategories());
      notify.success(t('settings.reference.added'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const updateCategory = async (category: PaymentCategory, rawName: string) => {
    const name = rawName.trim();
    if (!name || name === category.name) return;
    try {
      await window.api.paymentCategories.update(category.id, { name });
      setCategories(await window.api.reference.paymentCategories());
      notify.success(t('settings.reference.updated'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteCategory = async (category: PaymentCategory) => {
    const ok = await confirm.ask({
      title: t('common.deleteConfirm'),
      description: t('settings.reference.deleteCategoryConfirm', {
        name: category.name,
      }),
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    try {
      await window.api.paymentCategories.delete(category.id);
      setCategories(await window.api.reference.paymentCategories());
      notify.success(t('settings.reference.deleted'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const addExpenseCategory = async () => {
    const name = newExpenseCategoryName.trim();
    if (!name) {
      notify.error(t('settings.reference.nameRequired'));
      return;
    }
    try {
      await window.api.expenseCategories.create({ name, description: null });
      setNewExpenseCategoryName('');
      setExpenseCategories(await window.api.reference.expenseCategories());
      notify.success(t('settings.reference.added'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const updateExpenseCategory = async (
    category: ExpenseCategory,
    rawName: string,
  ) => {
    const name = rawName.trim();
    if (!name || name === category.name) return;
    try {
      await window.api.expenseCategories.update(category.id, { name });
      setExpenseCategories(await window.api.reference.expenseCategories());
      notify.success(t('settings.reference.updated'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteExpenseCategory = async (category: ExpenseCategory) => {
    const ok = await confirm.ask({
      title: t('common.deleteConfirm'),
      description: t('settings.reference.deleteExpenseCategoryConfirm', {
        name: category.name,
      }),
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    try {
      await window.api.expenseCategories.delete(category.id);
      setExpenseCategories(await window.api.reference.expenseCategories());
      notify.success(t('settings.reference.deleted'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const addCashier = async () => {
    const name = newCashierName.trim();
    if (!name) {
      notify.error(t('settings.reference.nameRequired'));
      return;
    }
    try {
      await window.api.cashiers.create({ name });
      setNewCashierName('');
      setCashiers(await window.api.reference.cashiers());
      notify.success(t('settings.reference.added'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const updateCashier = async (cashier: Cashier, rawName: string) => {
    const name = rawName.trim();
    if (!name || name === cashier.name) return;
    try {
      await window.api.cashiers.update(cashier.id, { name });
      setCashiers(await window.api.reference.cashiers());
      notify.success(t('settings.reference.updated'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteCashier = async (cashier: Cashier) => {
    const ok = await confirm.ask({
      title: t('common.deleteConfirm'),
      description: t('settings.reference.deleteCashierConfirm', {
        name: cashier.name,
      }),
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    try {
      await window.api.cashiers.delete(cashier.id);
      setCashiers(await window.api.reference.cashiers());
      notify.success(t('settings.reference.deleted'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCloseoutFromChange = (value: string) => {
    setCloseoutSummary(null);
    setError(null);
    setCloseoutFrom((previousFrom) => {
      const suggestedForPrevious = suggestNextSchoolYear(previousFrom);
      const suggestedForNew = suggestNextSchoolYear(value);
      setCloseoutTo((prev) => {
        if (!value) return '';
        if (!prev || prev === suggestedForPrevious) {
          return suggestedForNew || prev;
        }
        return prev;
      });
      return value;
    });
  };

  const runCloseout = async () => {
    setError(null);
    setCloseoutSummary(null);
    const from = closeoutFrom.trim();
    const to = closeoutTo.trim();
    if (!from || !to) {
      setError(t('settings.closeout.yearsRequired'));
      return;
    }
    if (from === to) {
      setError(t('settings.closeout.sameYear'));
      return;
    }
    const ok = await confirm.ask({
      title: t('common.confirmTitle'),
      description: t('settings.closeout.confirm', { from, to }),
      confirmLabel: t('common.continue'),
      destructive: false,
    });
    if (!ok) return;
    setCloseoutRunning(true);
    try {
      const result = await window.api.schoolYears.closeout(from, to);
      setCloseoutSummary(result);
      notify.success(t('settings.closeout.successTitle'));
      await loadAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      notify.error(message);
    } finally {
      setCloseoutRunning(false);
    }
  };

  const cleanupExpanded = expandClearSelection(cleanupSelection);
  const cleanupSelectedGroups = CLEAR_GROUPS.filter(
    (group) => cleanupExpanded[group],
  );

  const toggleCleanupGroup = (group: ClearGroup, checked: boolean) => {
    setCleanupSelection((prev) => ({ ...prev, [group]: checked }));
    setCleanupResult(null);
  };

  const selectAllCleanup = (checked: boolean) => {
    const next: ClearSelection = {};
    for (const group of CLEAR_GROUPS) next[group] = checked;
    setCleanupSelection(next);
    setCleanupResult(null);
  };

  const runCleanup = async () => {
    setError(null);
    setCleanupResult(null);
    if (cleanupSelectedGroups.length === 0) {
      setError(t('settings.cleanup.noneSelected'));
      return;
    }
    const summary = cleanupSelectedGroups
      .map(
        (group) =>
          `• ${t(`settings.cleanup.groups.${group}`)} (${cleanupPreview?.[group] ?? 0})`,
      )
      .join('\n');
    const ok = await confirm.ask({
      title: t('settings.cleanup.confirmTitle'),
      description: t('settings.cleanup.confirm', { summary }),
      confirmLabel: t('settings.cleanup.confirmAction'),
      destructive: true,
    });
    if (!ok) return;
    setCleanupBusy(true);
    try {
      const result = await window.api.dataCleanup.clear(cleanupSelection);
      const touchesConfig = CONFIG_CLEAR_GROUPS.some((group) =>
        cleanupSelectedGroups.includes(group),
      );
      if (touchesConfig) {
        // Config settings (language, currency, identity…) are read once at
        // startup by many parts of the UI — reload so everything picks up
        // the fresh values.
        scheduleReloadToast(t('settings.cleanup.successTitle'));
        window.location.reload();
        return;
      }
      setCleanupResult(result);
      setCleanupPreview(await window.api.dataCleanup.preview());
      await loadAll();
      notify.success(t('settings.cleanup.successTitle'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      notify.error(message);
    } finally {
      setCleanupBusy(false);
    }
  };

  const runLoadFixtures = async () => {
    setError(null);
    const ok = await confirm.ask({
      title: t('settings.cleanup.fixturesConfirmTitle'),
      description: keepSettingsOnLoad
        ? t('settings.cleanup.fixturesConfirmKeep')
        : t('settings.cleanup.fixturesConfirmReplace'),
      confirmLabel: t('settings.cleanup.fixturesAction'),
      destructive: true,
    });
    if (!ok) return;
    setFixturesBusy(true);
    try {
      const result = await window.api.dataCleanup.loadFixtures(
        fixtureProfile,
        keepSettingsOnLoad,
      );
      // A profile load rewrites settings, classes, and reference data used
      // across the app (language, currency, identity, school year) — reload
      // the window so every screen restarts from the new state.
      scheduleReloadToast(
        t('settings.cleanup.fixturesSuccess', {
          students: result.studentCount,
          payments: result.paymentCount,
        }),
      );
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      notify.error(message);
      setFixturesBusy(false);
    }
  };

  const renderCleanupGroupList = (groups: readonly ClearGroup[]) => (
    <ul className="flex flex-col divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
      {groups.map((group) => {
        const checked = Boolean(cleanupSelection[group]);
        const implied = cleanupExpanded[group] && !checked;
        const count = cleanupPreview?.[group] ?? 0;
        return (
          <li key={group}>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-white/[0.04]">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent"
                checked={checked}
                onChange={(e) => toggleCleanupGroup(group, e.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white">
                    {t(`settings.cleanup.groups.${group}`)}
                  </span>
                  <span className="text-xs font-medium text-white/50">
                    {t('settings.cleanup.count', { count })}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm text-white/55">
                  {t(`settings.cleanup.hints.${group}`)}
                  {implied ? ` ${t('settings.cleanup.implied')}` : ''}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );

  const renderAdvancedField = (field: (typeof ADVANCED_FIELDS)[number]) => (
    <div key={field.key} className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-white/90">
        {t(field.labelKey)}
      </label>
      {field.type === 'select' ? (
        <Select
          value={
            field.key === 'table_page_size'
              ? settings[field.key] || '50'
              : (settings[field.key] ?? '')
          }
          onChange={(e) => updateSetting(field.key, e.target.value)}
        >
          {field.key !== 'table_page_size' && <option value="">—</option>}
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.labelKey ? t(opt.labelKey) : opt.label}
            </option>
          ))}
        </Select>
      ) : field.type === 'number' ? (
        <NumberInput
          mode={field.mode}
          value={settings[field.key] ?? ''}
          onChange={(value) => updateSetting(field.key, value)}
        />
      ) : (
        <Input
          value={settings[field.key] ?? ''}
          onChange={(e) => updateSetting(field.key, e.target.value)}
        />
      )}
    </div>
  );

  const renderReferenceTable = (
    items: Array<{ id: number; name: string }>,
    emptyLabel: string,
    onSave: (item: { id: number; name: string }, name: string) => Promise<void>,
    onDelete: (item: { id: number; name: string }) => Promise<void>,
  ) => (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="border-b border-white/10">
          <tr>
            <th className="px-4 py-3 first:pl-5 text-left text-xs font-semibold uppercase tracking-wide text-white/55">
              {t('settings.reference.nameColumn')}
            </th>
            <th className="w-12 px-2 py-3" aria-label={t('common.delete')} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={2}
                className="px-4 py-8 text-center text-sm text-white/45"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-white/[0.06] last:border-0 even:bg-white/[0.025]"
              >
                <td className="px-4 py-3 first:pl-5">
                  <Input
                    key={`ref-${item.id}-${item.name}`}
                    defaultValue={item.name}
                    onBlur={(e) => void onSave(item, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                  />
                </td>
                <td className="px-2 py-3">
                  <TableActionButton
                    icon={Trash2}
                    label={t('common.delete')}
                    tone="destructive"
                    iconOnly
                    onClick={() => void onDelete(item)}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderSectionFeeTable = (
    section: Section,
    titleKey: 'francophoneSectionTitle' | 'anglophoneSectionTitle',
  ) => {
    const rows = structuredLevels.filter((level) =>
      level.labels.some((label) => label.section === section),
    );

    return (
      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h4 className="text-sm font-semibold text-white/90">
            {t(`settings.fees.${titleKey}`)}
          </h4>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/60">
            {rows.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-full text-sm">
            <thead className="border-b border-white/10">
              <tr>
                <th className="px-4 py-3 first:pl-5 text-left text-xs font-semibold uppercase tracking-wide text-white/55">
                  {t('settings.fees.codeColumn')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white/55">
                  {t('settings.fees.classColumn')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white/55">
                  {t('settings.fees.feeColumn', {
                    year: feeYear || t('common.dash'),
                  })}
                </th>
                <th
                  className="w-12 px-2 py-3"
                  aria-label={t('common.delete')}
                />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-white/45"
                  >
                    {t('settings.fees.emptySection')}
                  </td>
                </tr>
              ) : (
                rows.map((level) => (
                  <tr
                    key={`${level.id}-${section}`}
                    className="border-b border-white/[0.06] last:border-0 even:bg-white/[0.025]"
                  >
                    <td className="px-4 py-3 first:pl-5 font-mono text-xs text-white/70">
                      {level.code ?? t('common.dash')}
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        key={`name-${level.id}-${section}-${labelForSection(level, section)}`}
                        defaultValue={labelForSection(level, section)}
                        onBlur={(e) =>
                          void saveClassLabel(level, section, e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <NumberInput
                        mode="integer"
                        value={getFeeDraft(level.id, section)}
                        onChange={(value) =>
                          setFeeDraft(level.id, section, value)
                        }
                        onBlur={() => void commitFeeForClass(level.id, section)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        className="w-36"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <TableActionButton
                        icon={Trash2}
                        label={t('common.delete')}
                        tone="destructive"
                        iconOnly
                        onClick={() => void deleteSectionClass(level, section)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <SettingsNav items={tabs} active={tab} onChange={setTab} />

      <div className="min-w-0 flex-1">
        {tab === 'general' && (
          <div className="flex flex-col gap-6">
            <SettingsPanel
              icon={Building2}
              title={t('settings.general.identitySection')}
              description={t('settings.descriptions.identity')}
            >
              <div className="flex flex-col gap-5">
                <FormField
                  stacked
                  label={t('settings.general.schoolName')}
                  htmlFor="school-name"
                >
                  <Input
                    id="school-name"
                    value={settings.school_name ?? ''}
                    onChange={(e) =>
                      updateSetting('school_name', e.target.value)
                    }
                  />
                </FormField>
                <FormField
                  stacked
                  label={t('settings.general.schoolShortName')}
                  htmlFor="school-short"
                >
                  <Input
                    id="school-short"
                    value={settings.school_short_name ?? ''}
                    onChange={(e) =>
                      updateSetting('school_short_name', e.target.value)
                    }
                  />
                </FormField>
                <FormRow>
                  <FormField
                    stacked
                    label={t('settings.general.address')}
                    htmlFor="school-address"
                  >
                    <Input
                      id="school-address"
                      value={settings.address ?? ''}
                      onChange={(e) => updateSetting('address', e.target.value)}
                    />
                  </FormField>
                  <FormField
                    stacked
                    label={t('settings.general.phone')}
                    htmlFor="settings-phone"
                  >
                    <PhoneInput
                      id="settings-phone"
                      value={settings.phone ?? ''}
                      onChange={(value) => updateSetting('phone', value)}
                    />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField
                    stacked
                    label={t('settings.general.email')}
                    htmlFor="school-email"
                  >
                    <Input
                      id="school-email"
                      value={settings.email ?? ''}
                      onChange={(e) => updateSetting('email', e.target.value)}
                    />
                  </FormField>
                  <FormField
                    stacked
                    label={t('settings.general.directorName')}
                    htmlFor="school-director"
                  >
                    <Input
                      id="school-director"
                      value={settings.director_name ?? ''}
                      onChange={(e) =>
                        updateSetting('director_name', e.target.value)
                      }
                    />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField
                    stacked
                    label={t('settings.general.ministryName')}
                    htmlFor="ministry-fr"
                  >
                    <Input
                      id="ministry-fr"
                      value={settings.ministry_name ?? ''}
                      onChange={(e) =>
                        updateSetting('ministry_name', e.target.value)
                      }
                    />
                  </FormField>
                  <FormField
                    stacked
                    label={t('settings.general.ministryNameEn')}
                    htmlFor="ministry-en"
                  >
                    <Input
                      id="ministry-en"
                      value={settings.ministry_name_en ?? ''}
                      onChange={(e) =>
                        updateSetting('ministry_name_en', e.target.value)
                      }
                    />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField
                    stacked
                    label={t('settings.general.countryName')}
                    htmlFor="country-name"
                  >
                    <Input
                      id="country-name"
                      value={settings.country_name ?? ''}
                      onChange={(e) =>
                        updateSetting('country_name', e.target.value)
                      }
                    />
                  </FormField>
                  <FormField
                    stacked
                    label={t('settings.general.printHeaderLine')}
                    htmlFor="print-header"
                  >
                    <Input
                      id="print-header"
                      value={settings.print_header_line ?? ''}
                      onChange={(e) =>
                        updateSetting('print_header_line', e.target.value)
                      }
                    />
                  </FormField>
                </FormRow>
              </div>
            </SettingsPanel>

            <SettingsPanel
              icon={ReceiptText}
              title={t('settings.general.documentsSection')}
              description={t('settings.descriptions.documents')}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormField stacked label={t('settings.general.receiptPrefix')}>
                  <Input
                    value={settings.receipt_prefix ?? ''}
                    onChange={(e) =>
                      updateSetting('receipt_prefix', e.target.value)
                    }
                  />
                </FormField>
                <FormField
                  stacked
                  label={t('settings.general.staffReceiptPrefix')}
                >
                  <Input
                    value={settings.staff_receipt_prefix ?? ''}
                    onChange={(e) =>
                      updateSetting('staff_receipt_prefix', e.target.value)
                    }
                  />
                </FormField>
                <FormField
                  stacked
                  label={t('settings.general.expenseReferencePrefix')}
                >
                  <Input
                    value={settings.expense_reference_prefix ?? ''}
                    onChange={(e) =>
                      updateSetting('expense_reference_prefix', e.target.value)
                    }
                  />
                </FormField>
                <FormField stacked label={t('settings.general.currency')}>
                  <Input
                    value={settings.currency ?? ''}
                    onChange={(e) => updateSetting('currency', e.target.value)}
                  />
                </FormField>
                <FormField
                  stacked
                  label={t('settings.general.receiptMessage')}
                  className="md:col-span-2"
                >
                  <Input
                    value={settings.receipt_message ?? ''}
                    onChange={(e) =>
                      updateSetting('receipt_message', e.target.value)
                    }
                  />
                </FormField>
              </div>
            </SettingsPanel>

            <SettingsPanel
              icon={ImageIcon}
              title={t('settings.general.logoSection')}
              description={t('settings.descriptions.logo')}
              actions={
                <Button variant="outline" onClick={() => void pickLogo()}>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('settings.general.pickLogo')}
                </Button>
              }
            >
              {logoDataUrl ? (
                <img
                  src={logoDataUrl}
                  alt={t('settings.general.logoPreviewAlt')}
                  className="h-20 w-20 object-contain"
                />
              ) : settings.school_logo_path ? (
                <p className="text-sm text-muted-foreground">
                  {t('settings.general.logoPreviewUnavailable')}
                </p>
              ) : null}
            </SettingsPanel>

            <div>
              <Button onClick={() => void saveGeneral()}>
                <Save className="mr-2 h-4 w-4" />
                {saved ? t('common.saved') : t('common.save')}
              </Button>
            </div>
          </div>
        )}

        {tab === 'fees' && (
          <SettingsPanel
            icon={GraduationCap}
            title={t('settings.fees.title')}
            description={t('settings.descriptions.fees')}
          >
            <div className="flex flex-col gap-6">
              <FormField
                stacked
                label={t('settings.fees.schoolYear')}
                htmlFor="fee-year"
                className="max-w-xs"
              >
                <Select
                  id="fee-year"
                  value={feeYear}
                  onChange={(e) => setFeeYear(e.target.value)}
                >
                  {!feeYearOptions.includes(feeYear) && (
                    <option value={feeYear}>
                      {feeYear || t('shell.schoolYearPlaceholder')}
                    </option>
                  )}
                  {feeYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Select>
              </FormField>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h4 className="mb-4 text-sm font-semibold text-white/90">
                  {t('settings.fees.addClassTitle')}
                </h4>
                <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-[8rem_minmax(16rem,1fr)_16rem_auto]">
                  <FormField
                    stacked
                    label={t('settings.fees.newCode')}
                    htmlFor="new-class-code"
                  >
                    <Input
                      id="new-class-code"
                      value={newClassCode}
                      onChange={(e) =>
                        setNewClassCode(e.target.value.toUpperCase())
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          void addClassLevel(newClassSection);
                      }}
                      placeholder={t('settings.fees.newCodePlaceholder')}
                      className="font-mono uppercase"
                    />
                  </FormField>
                  <FormField
                    stacked
                    label={t('settings.fees.newClass')}
                    htmlFor="new-class-name"
                  >
                    <Input
                      id="new-class-name"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          void addClassLevel(newClassSection);
                      }}
                      placeholder={t('settings.fees.newClassPlaceholder')}
                    />
                  </FormField>
                  <FormField
                    stacked
                    label={t('enrollments.section')}
                    htmlFor="new-class-section"
                  >
                    <Select
                      id="new-class-section"
                      value={newClassSection}
                      onChange={(e) =>
                        setNewClassSection(e.target.value as Section)
                      }
                    >
                      <option value="Francophone">
                        {t('settings.fees.francophoneSectionTitle')}
                      </option>
                      <option value="Anglophone">
                        {t('settings.fees.anglophoneSectionTitle')}
                      </option>
                    </Select>
                  </FormField>
                  <Button
                    className="xl:mb-0.5"
                    onClick={() => void addClassLevel(newClassSection)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('settings.fees.addClass')}
                  </Button>
                </div>
                <p className="mt-3 text-xs text-white/45">
                  {t('settings.fees.sectionHelp')}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {renderSectionFeeTable(
                  'Francophone',
                  'francophoneSectionTitle',
                )}
                {renderSectionFeeTable('Anglophone', 'anglophoneSectionTitle')}
              </div>
            </div>
          </SettingsPanel>
        )}

        {tab === 'reference' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SettingsPanel
              icon={Tags}
              title={t('settings.reference.categoriesTitle')}
              description={t('settings.descriptions.reference')}
            >
              <div className="flex flex-col gap-4">
                {renderReferenceTable(
                  categories,
                  t('settings.reference.emptyCategories'),
                  (item, name) => updateCategory(item as PaymentCategory, name),
                  (item) => deleteCategory(item as PaymentCategory),
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <FormField
                    stacked
                    label={t('common.add')}
                    htmlFor="new-category-name"
                    className="min-w-[12rem] flex-1"
                  >
                    <Input
                      id="new-category-name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void addCategory();
                      }}
                      placeholder={t('settings.reference.categoryPlaceholder')}
                    />
                  </FormField>
                  <Button onClick={() => void addCategory()}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('common.add')}
                  </Button>
                </div>
              </div>
            </SettingsPanel>
            <SettingsPanel
              icon={ReceiptText}
              title={t('settings.reference.expenseCategoriesTitle')}
              description={t('settings.descriptions.reference')}
            >
              <div className="flex flex-col gap-4">
                {renderReferenceTable(
                  expenseCategories,
                  t('settings.reference.emptyExpenseCategories'),
                  (item, name) =>
                    updateExpenseCategory(item as ExpenseCategory, name),
                  (item) => deleteExpenseCategory(item as ExpenseCategory),
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <FormField
                    stacked
                    label={t('common.add')}
                    htmlFor="new-expense-category-name"
                    className="min-w-[12rem] flex-1"
                  >
                    <Input
                      id="new-expense-category-name"
                      value={newExpenseCategoryName}
                      onChange={(e) =>
                        setNewExpenseCategoryName(e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void addExpenseCategory();
                      }}
                      placeholder={t(
                        'settings.reference.expenseCategoryPlaceholder',
                      )}
                    />
                  </FormField>
                  <Button onClick={() => void addExpenseCategory()}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('common.add')}
                  </Button>
                </div>
              </div>
            </SettingsPanel>
            <SettingsPanel
              icon={Users}
              title={t('settings.reference.cashiersTitle')}
              description={t('settings.descriptions.reference')}
            >
              <div className="flex flex-col gap-4">
                {renderReferenceTable(
                  cashiers,
                  t('settings.reference.emptyCashiers'),
                  (item, name) => updateCashier(item as Cashier, name),
                  (item) => deleteCashier(item as Cashier),
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <FormField
                    stacked
                    label={t('common.add')}
                    htmlFor="new-cashier-name"
                    className="min-w-[12rem] flex-1"
                  >
                    <Input
                      id="new-cashier-name"
                      value={newCashierName}
                      onChange={(e) => setNewCashierName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void addCashier();
                      }}
                      placeholder={t('settings.reference.cashierPlaceholder')}
                    />
                  </FormField>
                  <Button onClick={() => void addCashier()}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('common.add')}
                  </Button>
                </div>
              </div>
            </SettingsPanel>
          </div>
        )}

        {tab === 'advanced' && (
          <div className="flex flex-col gap-6">
            <SettingsPanel
              icon={Table2}
              title={t('settings.advanced.groups.display')}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {ADVANCED_FIELDS.filter(
                  (field) => field.group === 'display',
                ).map(renderAdvancedField)}
              </div>
            </SettingsPanel>
            <SettingsPanel
              icon={Users}
              title={t('settings.advanced.groups.staff')}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {ADVANCED_FIELDS.filter((field) => field.group === 'staff').map(
                  renderAdvancedField,
                )}
              </div>
            </SettingsPanel>
            <SettingsPanel
              icon={Wallet}
              title={t('settings.advanced.groups.expenses')}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {ADVANCED_FIELDS.filter(
                  (field) => field.group === 'expenses',
                ).map(renderAdvancedField)}
              </div>
            </SettingsPanel>
            <SettingsPanel
              icon={FileSpreadsheet}
              title={t('settings.advanced.groups.documents')}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {ADVANCED_FIELDS.filter(
                  (field) => field.group === 'documents',
                ).map(renderAdvancedField)}
              </div>
            </SettingsPanel>
            <SettingsPanel
              icon={HardDrive}
              title={t('settings.advanced.groups.backup')}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {ADVANCED_FIELDS.filter(
                  (field) => field.group === 'backup',
                ).map(renderAdvancedField)}
              </div>
            </SettingsPanel>
            <SettingsPanel
              icon={DatabaseBackup}
              title={t('settings.backup.title')}
              description={t('settings.backup.help')}
            >
              <div className="flex flex-col gap-3">
                {backupStatus && (
                  <p
                    className={
                      backupStatus.overdue
                        ? 'text-sm font-medium text-destructive'
                        : 'text-sm text-muted-foreground'
                    }
                  >
                    {backupStatus.lastBackupAt
                      ? t('settings.backup.lastBackup', {
                          datetime: formatDateTime(backupStatus.lastBackupAt),
                        })
                      : t('settings.backup.none')}
                    {backupStatus.overdue
                      ? t('settings.backup.reminder', {
                          days: backupStatus.reminderDays,
                        })
                      : ''}
                  </p>
                )}
                {backupStatus?.autoBackupEnabled && (
                  <p className="text-sm text-muted-foreground">
                    {backupStatus.lastAutoBackupAt
                      ? t('settings.backup.lastAutoBackup', {
                          datetime: formatDateTime(
                            backupStatus.lastAutoBackupAt,
                          ),
                          days: backupStatus.autoBackupIntervalDays,
                        })
                      : t('settings.backup.autoEnabled', {
                          days: backupStatus.autoBackupIntervalDays,
                        })}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void handleBackupNow()}
                    disabled={backupBusy}
                  >
                    <DatabaseBackup className="mr-2 h-4 w-4" />
                    {backupBusy
                      ? t('settings.backup.saving')
                      : t('settings.backup.saveNow')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleRestore()}
                    disabled={backupBusy}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {backupBusy
                      ? t('settings.backup.restoring')
                      : t('settings.backup.restore')}
                  </Button>
                </div>
              </div>
            </SettingsPanel>
            <SettingsPanel
              icon={ScrollText}
              title={t('settings.diagnostic.title')}
              description={t('settings.diagnostic.help')}
            >
              <div className="flex flex-col gap-3">
                {logInfo?.path && (
                  <p className="break-all font-mono text-xs text-muted-foreground">
                    {logInfo.path}
                  </p>
                )}
                {logInfo?.tail ? (
                  <pre className="max-h-56 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/75">
                    {logInfo.tail}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('settings.diagnostic.empty')}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void window.api.system.openLogsFolder()}
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    {t(
                      window.webUserRole
                        ? 'settings.diagnostic.downloadLogs'
                        : 'settings.diagnostic.openFolder',
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => void loadLogInfo()}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t('common.refresh')}
                  </Button>
                </div>
              </div>
            </SettingsPanel>
            <div>
              <Button onClick={() => void saveAdvanced()}>
                <Save className="mr-2 h-4 w-4" />
                {saved ? t('common.saved') : t('common.save')}
              </Button>
            </div>
          </div>
        )}

        {tab === 'closeout' && (
          <SettingsPanel
            icon={CalendarRange}
            title={t('settings.closeout.title')}
            description={t('settings.closeout.help')}
          >
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Copy className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white/90">
                      {t('settings.closeout.stepFeesTitle')}
                    </h4>
                    <p className="mt-1 text-sm text-white/55">
                      {t('settings.closeout.stepFeesBody')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white/90">
                      {t('settings.closeout.stepEnrollmentsTitle')}
                    </h4>
                    <p className="mt-1 text-sm text-white/55">
                      {t('settings.closeout.stepEnrollmentsBody')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                  <FormField
                    stacked
                    label={t('settings.closeout.fromYear')}
                    htmlFor="closeout-from"
                  >
                    <Select
                      id="closeout-from"
                      value={closeoutFrom}
                      onChange={(e) => handleCloseoutFromChange(e.target.value)}
                    >
                      <option value="">—</option>
                      {closeoutFromOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <ArrowRightLeft
                    className="mb-3 hidden h-5 w-5 text-white/40 md:block"
                    aria-hidden
                  />
                  <FormField
                    stacked
                    label={t('settings.closeout.toYear')}
                    htmlFor="closeout-to"
                  >
                    <Select
                      id="closeout-to"
                      value={closeoutTo}
                      onChange={(e) => {
                        setCloseoutTo(e.target.value);
                        setCloseoutSummary(null);
                        setError(null);
                      }}
                    >
                      <option value="">—</option>
                      {closeoutToOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                          {year === suggestNextSchoolYear(closeoutFrom)
                            ? ` (${t('settings.closeout.suggested')})`
                            : ''}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <Button
                    className="md:mb-0.5"
                    onClick={() => void runCloseout()}
                    disabled={closeoutRunning}
                  >
                    <CalendarRange className="mr-2 h-4 w-4" />
                    {closeoutRunning
                      ? t('settings.closeout.running')
                      : t('settings.closeout.run')}
                  </Button>
                </div>
                {schoolYearOptions.length > 0 && (
                  <p className="mt-3 text-xs text-white/45">
                    {t('settings.closeout.knownYears')} :{' '}
                    {schoolYearOptions.join(', ')}
                  </p>
                )}
              </div>

              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}

              {closeoutSummary && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                  <div className="mb-3 flex items-center gap-2 text-green-300">
                    <CheckCircle2 className="h-5 w-5" />
                    <h4 className="text-sm font-semibold">
                      {t('settings.closeout.successTitle')}
                    </h4>
                  </div>
                  <ul className="flex flex-col gap-1 text-sm text-green-200/90">
                    <li>
                      {t('settings.closeout.successFees', {
                        copied: closeoutSummary.feesCopied,
                        skipped: closeoutSummary.feesSkippedExisting,
                      })}
                    </li>
                    <li>
                      {t('settings.closeout.successEnrollments', {
                        created: closeoutSummary.enrollmentsCreated,
                        skipped: closeoutSummary.enrollmentsSkippedExisting,
                      })}
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </SettingsPanel>
        )}

        {tab === 'cleanup' && (
          <div className="flex flex-col gap-6">
            <SettingsPanel
              icon={DatabaseZap}
              title={t('settings.cleanup.fixturesTitle')}
              description={t('settings.cleanup.fixturesHelp')}
            >
              <div className="flex flex-col gap-4">
                <FormField
                  stacked
                  label={t('settings.cleanup.fixturesProfileLabel')}
                  htmlFor="fixtures-profile"
                >
                  <Select
                    id="fixtures-profile"
                    value={fixtureProfile}
                    onChange={(e) =>
                      setFixtureProfile(e.target.value as FixtureProfileId)
                    }
                    className="max-w-md"
                  >
                    <option value="demo">
                      {t('settings.cleanup.fixturesProfiles.demo')}
                    </option>
                    <option value="emergence">
                      {t('settings.cleanup.fixturesProfiles.emergence')}
                    </option>
                  </Select>
                </FormField>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent"
                    checked={keepSettingsOnLoad}
                    onChange={(e) => setKeepSettingsOnLoad(e.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {t('settings.cleanup.fixturesKeepTitle')}
                    </span>
                    <span className="mt-0.5 block text-sm text-white/55">
                      {t('settings.cleanup.fixturesKeepHelp')}
                    </span>
                  </span>
                </label>
                <div>
                  <Button
                    disabled={fixturesBusy || cleanupBusy}
                    onClick={() => void runLoadFixtures()}
                  >
                    <DatabaseZap className="mr-2 h-4 w-4" />
                    {fixturesBusy
                      ? t('settings.cleanup.fixturesRunning')
                      : t('settings.cleanup.fixturesAction')}
                  </Button>
                </div>
              </div>
            </SettingsPanel>

            <SettingsPanel
              icon={Eraser}
              title={t('settings.cleanup.title')}
              description={t('settings.cleanup.help')}
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => selectAllCleanup(true)}
                  >
                    {t('settings.cleanup.selectAll')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => selectAllCleanup(false)}
                  >
                    {t('settings.cleanup.selectNone')}
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-white/45">
                    {t('settings.cleanup.sectionOperations')}
                  </h4>
                  {renderCleanupGroupList(OPERATIONAL_CLEAR_GROUPS)}
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-white/45">
                    {t('settings.cleanup.sectionConfig')}
                  </h4>
                  {renderCleanupGroupList(CONFIG_CLEAR_GROUPS)}
                </div>

                {error && tab === 'cleanup' && (
                  <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {error}
                  </p>
                )}

                <div>
                  <Button
                    variant="destructive"
                    disabled={cleanupBusy || cleanupSelectedGroups.length === 0}
                    onClick={() => void runCleanup()}
                  >
                    <Eraser className="mr-2 h-4 w-4" />
                    {cleanupBusy
                      ? t('settings.cleanup.running')
                      : t('settings.cleanup.run')}
                  </Button>
                </div>

                {cleanupResult && (
                  <div className="rounded-xl border border-green-400/20 bg-green-500/10 p-4">
                    <div className="mb-3 flex items-center gap-2 text-green-300">
                      <CheckCircle2 className="h-5 w-5" />
                      <h4 className="text-sm font-semibold">
                        {t('settings.cleanup.successTitle')}
                      </h4>
                    </div>
                    <ul className="flex flex-col gap-1 text-sm text-green-200/90">
                      {CLEAR_GROUPS.filter(
                        (group) => cleanupResult[group] > 0,
                      ).map((group) => (
                        <li key={group}>
                          {t('settings.cleanup.successItem', {
                            label: t(`settings.cleanup.groups.${group}`),
                            count: cleanupResult[group],
                          })}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </SettingsPanel>
          </div>
        )}
      </div>
      {confirm.dialog}
    </div>
  );
}
