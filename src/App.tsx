import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Wallet,
  Receipt,
  UserCog,
  FileText,
  BarChart3,
  Settings,
  CircleHelp,
} from 'lucide-react';
import { cn } from './lib/utils';
import { setActiveCurrency } from './lib/format';
import logoUrl from './assets/logo.svg';
import { Select } from './components/ui/select';
import { DashboardView } from './views/DashboardView';
import { StudentsView } from './views/StudentsView';
import { EnrollmentsView } from './views/EnrollmentsView';
import { PaymentsView } from './views/PaymentsView';
import { ExpensesView } from './views/ExpensesView';
import { StaffView } from './views/StaffView';
import { ReportView } from './views/ReportView';
import { FinancialReportsView } from './views/FinancialReportsView';
import { SettingsView } from './views/SettingsView';
import { HelpView } from './views/HelpView';
import { Toaster } from './components/ui/toaster';
import {
  GlobalSearch,
  type GlobalSearchHandle,
} from './components/layout/global-search';
import { LanguageSwitcher } from './components/layout/language-switcher';
import { isMissingIpcHandlerError } from './lib/print';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { notify } from './lib/notify';
import { consumePendingReloadToast } from './lib/reload-toast';
import {
  UI_LANGUAGE_KEY,
  UI_LANGUAGE_STORAGE_KEY,
  normalizeUiLanguage,
} from './i18n';

type View =
  | 'dashboard'
  | 'students'
  | 'enrollments'
  | 'payments'
  | 'expenses'
  | 'staff'
  | 'report'
  | 'financialReports'
  | 'settings'
  | 'help';

type NavItem = { id: View; icon: typeof Users };

// Sidebar navigation grouped by domain; group ids map to nav.groups.* labels.
const NAV_GROUPS: { id: string | null; items: NavItem[] }[] = [
  { id: null, items: [{ id: 'dashboard', icon: LayoutDashboard }] },
  {
    id: 'school',
    items: [
      { id: 'students', icon: Users },
      { id: 'enrollments', icon: BookOpen },
      { id: 'report', icon: FileText },
    ],
  },
  {
    id: 'finance',
    items: [
      { id: 'payments', icon: Wallet },
      { id: 'expenses', icon: Receipt },
      { id: 'financialReports', icon: BarChart3 },
    ],
  },
  {
    id: 'admin',
    items: [
      { id: 'staff', icon: UserCog },
      { id: 'settings', icon: Settings },
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

const SCHOOL_YEAR_VIEWS: View[] = [
  'students',
  'enrollments',
  'payments',
  'report',
];

const ACTIVE_VIEW_STORAGE_KEY = 'suivi-frais.activeView';

type Branding = {
  schoolName: string;
  schoolShortName: string;
  logoDataUrl: string | null;
};

function isView(value: string | null): value is View {
  return NAV_ITEMS.some((item) => item.id === value) || value === 'help';
}

function readStoredView(): View {
  try {
    const stored = localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
    if (isView(stored)) {
      if (window.webUserRole === 'staff' && stored === 'settings')
        return 'dashboard';
      return stored;
    }
  } catch {
    // Ignore storage errors (private mode, etc.).
  }
  return 'dashboard';
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<View>(readStoredView);
  const [schoolYear, setSchoolYear] = useState('');
  const [schoolYearOptions, setSchoolYearOptions] = useState<string[]>([]);
  const [schoolYearReady, setSchoolYearReady] = useState(false);
  const [focusStudentId, setFocusStudentId] = useState<number | null>(null);
  const [studentsEntry, setStudentsEntry] = useState<{
    mode: 'list' | 'create';
    nonce: number;
  }>({ mode: 'list', nonce: 0 });
  const [branding, setBranding] = useState<Branding>({
    schoolName: t('shell.fallbackSchoolName'),
    schoolShortName: t('shell.fallbackShortName'),
    logoDataUrl: null,
  });
  const searchRef = useRef<GlobalSearchHandle | null>(null);

  const navLabel = useCallback((id: View) => t(`nav.${id}`), [t]);

  const currentNavLabel = useMemo(() => navLabel(view), [navLabel, view]);

  const showSchoolYearSubtitle = SCHOOL_YEAR_VIEWS.includes(view);
  const visibleNavGroups =
    window.webUserRole === 'staff'
      ? NAV_GROUPS.map((group) => ({
          ...group,
          items: group.items.filter((item) => item.id !== 'settings'),
        })).filter((group) => group.items.length > 0)
      : NAV_GROUPS;
  const CurrentIcon =
    view === 'help'
      ? CircleHelp
      : (NAV_ITEMS.find((item) => item.id === view)?.icon ?? LayoutDashboard);

  const loadBranding = useCallback(async () => {
    try {
      const [data, currency] = await Promise.all([
        window.api.settings.getBranding(),
        window.api.settings.get('currency'),
      ]);
      setBranding({
        schoolName: data.schoolName,
        schoolShortName: data.schoolShortName,
        logoDataUrl: data.logoDataUrl,
      });
      setActiveCurrency(currency);
    } catch {
      // Keep fallback branding when IPC is unavailable.
    }
  }, []);

  const loadSchoolYear = useCallback(async () => {
    try {
      const [current, years] = await Promise.all([
        window.api.settings.get('current_school_year'),
        window.api.reference.schoolYears(),
      ]);
      setSchoolYearOptions(years);
      const resolved = current?.trim() || years[0] || '';
      setSchoolYear(resolved);
      if (!current?.trim() && resolved) {
        await window.api.settings.set('current_school_year', resolved);
      }
    } finally {
      setSchoolYearReady(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLanguage(): Promise<void> {
      let lang = normalizeUiLanguage(i18n.language);
      try {
        const stored = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
        if (stored) lang = normalizeUiLanguage(stored);
      } catch {
        // Ignore storage errors.
      }
      try {
        const fromSettings = await window.api.settings.get(UI_LANGUAGE_KEY);
        if (fromSettings) lang = normalizeUiLanguage(fromSettings);
      } catch {
        // IPC may be unavailable during startup.
      }
      if (!cancelled && lang !== normalizeUiLanguage(i18n.language)) {
        await i18n.changeLanguage(lang);
      }
    }

    void loadLanguage();
    return () => {
      cancelled = true;
    };
  }, [i18n]);

  const openStudents = useCallback((mode: 'list' | 'create') => {
    setStudentsEntry((prev) => ({ mode, nonce: prev.nonce + 1 }));
    setView('students');
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        openStudents('create');
      } else if (e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setView('payments');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openStudents]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, view);
    } catch {
      // Ignore storage errors.
    }
  }, [view]);

  useEffect(() => {
    void loadBranding();
    void loadSchoolYear();
    return window.api.settings.onBrandingUpdated(() => {
      void loadBranding();
      void loadSchoolYear();
    });
  }, [loadBranding, loadSchoolYear]);

  // Show the success toast parked before a settings-driven window reload
  // (fixture load / configuration wipe).
  useEffect(() => {
    consumePendingReloadToast();
  }, []);

  // Stale-main-process detection: the main process does not hot-reload, so
  // after adding IPC channels the running build may lack handlers the
  // renderer expects. Compare the served channel list with ours and warn.
  useEffect(() => {
    void window.api.system
      .ipcReady()
      .then((result) => {
        const served = new Set(result.channels ?? []);
        const missing = IPC_CHANNELS.filter((c) => !served.has(c));
        if (result.channels === undefined || missing.length > 0) {
          notify.error(t('shell.staleMainProcess'));
        }
      })
      .catch((err: unknown) => {
        if (!isMissingIpcHandlerError(err)) return;
        notify.error(t('shell.staleMainProcess'));
      });
  }, [t]);

  const handleSchoolYearChange = async (year: string) => {
    setSchoolYear(year);
    if (year) {
      await window.api.settings.set('current_school_year', year);
    }
  };

  const handleNavigate = (target: View) => {
    if (target === 'settings' && window.webUserRole === 'staff') return;
    if (target === 'students') {
      openStudents('list');
      return;
    }
    setView(target);
  };

  return (
    <div className="flex h-dvh min-h-[100svh] flex-col-reverse overflow-hidden bg-gradient-to-br from-[#1c0b30] via-[#3b1360] to-[#7a2f8f] text-white md:flex-row">
      <aside className="hidden h-full w-28 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-black/20 py-6 backdrop-blur-xl md:flex">
        <div className="mb-8 flex flex-col items-center gap-2 px-2">
          <img
            src={branding.logoDataUrl ?? logoUrl}
            alt={branding.schoolShortName}
            className="h-10 w-10 shrink-0 object-contain"
          />
          <span className="text-center text-[10px] font-semibold leading-tight text-white/90">
            {branding.schoolShortName}
          </span>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2">
          {visibleNavGroups.map((group, groupIndex) => (
            <div key={group.id ?? 'root'} className="flex flex-col gap-1">
              {group.id ? (
                <p className="mt-3 px-1 text-center text-[9px] font-semibold uppercase tracking-widest text-white/35">
                  {t(`nav.groups.${group.id}`)}
                </p>
              ) : groupIndex > 0 ? (
                <div className="mx-3 my-2 border-t border-white/10" />
              ) : null}
              {group.items.map(({ id, icon: Icon }) => {
                const active = view === id;
                const label = navLabel(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      if (id === 'students') {
                        openStudents('list');
                        return;
                      }
                      setView(id);
                    }}
                    aria-current={active ? 'page' : undefined}
                    title={label}
                    className={cn(
                      'group relative flex min-h-[4.25rem] w-full flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-[11px] font-medium transition-all duration-200 ease-out',
                      active
                        ? 'bg-gradient-to-b from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-fuchsia-900/35 ring-1 ring-white/20'
                        : 'text-white/55 hover:bg-white/12 hover:text-white hover:shadow-md hover:shadow-black/25 hover:ring-1 hover:ring-white/10',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-6 w-6 shrink-0 transition-transform duration-200',
                        !active && 'group-hover:scale-110',
                      )}
                      strokeWidth={active ? 2 : 1.75}
                    />
                    <span className="max-w-full text-center leading-tight">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          <div className="mt-auto shrink-0 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => setView('help')}
              aria-current={view === 'help' ? 'page' : undefined}
              title={navLabel('help')}
              className={cn(
                'group relative flex min-h-[4.25rem] w-full flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-[11px] font-medium transition-all duration-200 ease-out',
                view === 'help'
                  ? 'bg-gradient-to-b from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-fuchsia-900/35 ring-1 ring-white/20'
                  : 'text-white/55 hover:bg-white/12 hover:text-white hover:shadow-md hover:shadow-black/25 hover:ring-1 hover:ring-white/10',
              )}
            >
              <CircleHelp
                className={cn(
                  'h-6 w-6 shrink-0 transition-transform duration-200',
                  view !== 'help' && 'group-hover:scale-110',
                )}
                strokeWidth={view === 'help' ? 2 : 1.75}
              />
              <span className="max-w-full text-center leading-tight">
                {navLabel('help')}
              </span>
            </button>
          </div>
        </nav>
      </aside>

      <nav
        aria-label={t('nav.ariaLabel')}
        className="z-30 flex shrink-0 items-stretch gap-1 overflow-x-auto border-t border-white/10 bg-[#1c0b30]/95 px-2 py-1.5 backdrop-blur-xl md:hidden"
      >
        {NAV_ITEMS.filter(
          ({ id }) => id !== 'settings' || window.webUserRole !== 'staff',
        ).map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              id === 'students' ? openStudents('list') : setView(id)
            }
            aria-current={view === id ? 'page' : undefined}
            aria-label={navLabel(id)}
            className={cn(
              'flex min-w-[4.25rem] flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px]',
              view === id ? 'bg-fuchsia-600 text-white' : 'text-white/65',
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="max-w-16 truncate">{navLabel(id)}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setView('help')}
          aria-current={view === 'help' ? 'page' : undefined}
          aria-label={navLabel('help')}
          className={cn(
            'flex min-w-[4.25rem] flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px]',
            view === 'help' ? 'bg-fuchsia-600 text-white' : 'text-white/65',
          )}
        >
          <CircleHelp className="h-5 w-5" aria-hidden="true" />
          <span className="max-w-16 truncate">{navLabel('help')}</span>
        </button>
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className={cn(
            'z-20 shrink-0 border-b border-white/10 bg-[#1c0b30]/75 px-4 pb-4 backdrop-blur-xl sm:px-8 sm:py-5',
            window.webUserRole ? 'pt-14 sm:pt-5' : 'pt-4',
          )}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 sm:flex">
                <CurrentIcon
                  className="h-6 w-6 text-white"
                  strokeWidth={1.75}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/55">
                  {branding.schoolName}
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  {currentNavLabel}
                </h1>
                <p className="mt-1 max-w-xl text-sm text-white/60">
                  {t(`nav.descriptions.${view}`)}
                  {showSchoolYearSubtitle && schoolYear
                    ? ` · ${t('shell.schoolYear')} ${schoolYear}`
                    : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <GlobalSearch
                ref={searchRef}
                onSelectStudent={(id) => {
                  openStudents('list');
                  setFocusStudentId(id);
                }}
              />
              <LanguageSwitcher />
              <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur-sm">
                {t('shell.schoolYear')}
                {schoolYearOptions.length > 0 ? (
                  <Select
                    native
                    value={schoolYear}
                    onChange={(e) =>
                      void handleSchoolYearChange(e.target.value)
                    }
                    className="h-7 w-28 border-none bg-transparent px-1 text-sm text-white focus-visible:ring-0"
                  >
                    {schoolYearOptions.map((year) => (
                      <option key={year} value={year} className="text-black">
                        {year}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <input
                    value={schoolYear}
                    onChange={(e) =>
                      void handleSchoolYearChange(e.target.value)
                    }
                    placeholder={t('shell.schoolYearPlaceholder')}
                    className="h-6 w-24 rounded-md border-none bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                  />
                )}
              </label>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 pb-6 sm:p-8 sm:pb-14">
          {view === 'dashboard' && (
            <DashboardView
              schoolYear={schoolYear}
              schoolYearReady={schoolYearReady}
              isActive
              onNavigate={handleNavigate}
            />
          )}

          {view !== 'dashboard' && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-2xl backdrop-blur-xl">
              {view === 'students' && (
                <StudentsView
                  schoolYear={schoolYear}
                  focusStudentId={focusStudentId}
                  onFocusStudentIdConsumed={() => setFocusStudentId(null)}
                  entry={studentsEntry}
                />
              )}
              {view === 'enrollments' && (
                <EnrollmentsView schoolYear={schoolYear} />
              )}
              {view === 'payments' && <PaymentsView schoolYear={schoolYear} />}
              {view === 'expenses' && <ExpensesView />}
              {view === 'staff' && <StaffView />}
              {view === 'report' && <ReportView schoolYear={schoolYear} />}
              {view === 'financialReports' && <FinancialReportsView />}
              {view === 'settings' && window.webUserRole !== 'staff' && (
                <SettingsView schoolYear={schoolYear} />
              )}
              {view === 'help' && (
                <HelpView onNavigate={(target) => handleNavigate(target)} />
              )}
            </div>
          )}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
