import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BookOpenCheck,
  CircleHelp,
  DatabaseBackup,
  GraduationCap,
  Receipt,
  School,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageIntro } from '../components/ui/page-intro';
import { Tabs } from '../components/ui/tabs';

export type HelpTarget =
  | 'settings'
  | 'students'
  | 'payments'
  | 'expenses'
  | 'staff'
  | 'report'
  | 'financialReports'
  | 'dashboard';

type SectionId =
  | 'start'
  | 'students'
  | 'payments'
  | 'expenses'
  | 'staff'
  | 'reports'
  | 'backup';

interface HelpSection {
  id: SectionId;
  icon: LucideIcon;
  tone: string;
  target?: HelpTarget;
}

const SECTIONS: HelpSection[] = [
  { id: 'start', icon: School, tone: 'bg-sky-500/15 text-sky-300 ring-sky-400/30', target: 'settings' },
  { id: 'students', icon: UserPlus, tone: 'bg-violet-500/15 text-violet-300 ring-violet-400/30', target: 'students' },
  { id: 'payments', icon: Wallet, tone: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30', target: 'payments' },
  { id: 'expenses', icon: Receipt, tone: 'bg-rose-500/15 text-rose-300 ring-rose-400/30', target: 'expenses' },
  { id: 'staff', icon: Users, tone: 'bg-amber-500/15 text-amber-300 ring-amber-400/30', target: 'staff' },
  { id: 'reports', icon: GraduationCap, tone: 'bg-indigo-500/15 text-indigo-300 ring-indigo-400/30', target: 'report' },
  { id: 'backup', icon: DatabaseBackup, tone: 'bg-slate-500/15 text-slate-300 ring-slate-400/30', target: 'settings' },
];

export function HelpView({
  onNavigate,
}: {
  onNavigate: (view: HelpTarget) => void;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState<SectionId>('start');

  const section = SECTIONS.find((item) => item.id === active) ?? SECTIONS[0];
  const sectionTarget = section.target;
  const stepCount = Number(t(`help.sections.${section.id}.stepCount`));
  const steps = useMemo(
    () =>
      Array.from({ length: Number.isFinite(stepCount) ? stepCount : 0 }, (_, i) => ({
        title: t(`help.sections.${section.id}.steps.${i}.title`),
        body: t(`help.sections.${section.id}.steps.${i}.body`),
      })),
    [section.id, stepCount, t],
  );

  const tabs = SECTIONS.map((item) => ({
    id: item.id,
    label: t(`help.sections.${item.id}.tab`),
    icon: item.icon,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        icon={CircleHelp}
        title={t('help.introTitle')}
        description={t('help.introDescription')}
      />

      <Tabs items={tabs} active={active} onChange={setActive} className="max-w-full" />

      <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <header className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${section.tone}`}
            >
              <section.icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
                {t('help.guideLabel')}
              </p>
              <h3 className="mt-0.5 text-xl font-semibold text-white">
                {t(`help.sections.${section.id}.title`)}
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/60">
                {t(`help.sections.${section.id}.description`)}
              </p>
            </div>
          </div>
          {sectionTarget ? (
            <button
              type="button"
              onClick={() => onNavigate(sectionTarget)}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-colors hover:bg-white"
            >
              {t(`help.sections.${section.id}.action`)}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
        </header>

        <ol className="divide-y divide-white/5">
          {steps.map((step, index) => (
            <li key={`${section.id}-${index}`} className="flex gap-4 px-6 py-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white ring-1 ring-white/15">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/65">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </article>

      <aside className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
        <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
        <p className="text-sm leading-relaxed text-white/65">{t('help.tip')}</p>
      </aside>
    </div>
  );
}
