import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type StatTone =
  | 'sky'
  | 'emerald'
  | 'amber'
  | 'violet'
  | 'rose'
  | 'slate';

const TONES: Record<StatTone, { chip: string; bar: string }> = {
  sky: {
    chip: 'bg-sky-500/15 text-sky-300 ring-sky-400/30',
    bar: 'bg-sky-400',
  },
  emerald: {
    chip: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
    bar: 'bg-emerald-400',
  },
  amber: {
    chip: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
    bar: 'bg-amber-400',
  },
  violet: {
    chip: 'bg-violet-500/15 text-violet-300 ring-violet-400/30',
    bar: 'bg-violet-400',
  },
  rose: {
    chip: 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
    bar: 'bg-rose-400',
  },
  slate: {
    chip: 'bg-slate-500/15 text-slate-300 ring-slate-400/30',
    bar: 'bg-slate-400',
  },
};

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  hintIcon?: LucideIcon;
  icon: LucideIcon;
  tone?: StatTone;
  /** 0–100; renders a thin progress bar under the value. */
  progress?: number;
  onClick?: () => void;
  className?: string;
}

/**
 * Uniform glass stat tile for the dashboard: tonal icon chip, uppercase
 * label, large value, optional progress bar and hint line. Calmer and more
 * professional than the previous full-gradient tiles.
 */
export function StatCard({
  label,
  value,
  hint,
  hintIcon: HintIcon,
  icon: Icon,
  tone = 'sky',
  progress,
  onClick,
  className,
}: StatCardProps) {
  const tones = TONES[tone];

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
          {label}
        </span>
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
            tones.chip,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-2 text-xl font-bold tabular-nums leading-tight text-white sm:text-2xl">
        {value}
      </div>
      {typeof progress === 'number' && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={cn('h-full rounded-full', tones.bar)}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {hint && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-white/55">
          {HintIcon && <HintIcon className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{hint}</span>
        </p>
      )}
    </>
  );

  const baseClasses = cn(
    'rounded-3xl border border-white/10 bg-white/5 p-5 text-left shadow-lg shadow-black/10 backdrop-blur-xl',
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseClasses,
          'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}
