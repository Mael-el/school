import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SummaryVariant = 'idle' | 'ready' | 'warning';

const boxClass: Record<SummaryVariant, string> = {
  idle: 'border-white/10 bg-white/[0.04]',
  ready: 'border-primary/30 bg-primary/10',
  warning: 'border-amber-400/25 bg-amber-400/10',
};

const iconClass: Record<SummaryVariant, string> = {
  idle: 'bg-white/8 text-white/55 ring-white/10',
  ready: 'bg-primary/20 text-primary ring-primary/25',
  warning: 'bg-amber-400/15 text-amber-200 ring-amber-400/20',
};

export function SummaryCallout({
  icon: Icon,
  title,
  description,
  hint,
  value,
  valueLabel,
  stats,
  variant = 'idle',
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  hint?: string;
  value?: string;
  valueLabel?: string;
  stats?: { label: string; value: string }[];
  variant?: SummaryVariant;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4',
        boxClass[variant],
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1',
            iconClass[variant],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/90">{title}</p>
          {description && (
            <p className="mt-0.5 text-sm text-white/60">{description}</p>
          )}
          {hint && <p className="mt-1 text-xs text-white/45">{hint}</p>}
        </div>
      </div>
      {stats && stats.length > 0 ? (
        <div className="flex flex-wrap items-end gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-right">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
                {stat.label}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-right">
          {valueLabel && (
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
              {valueLabel}
            </p>
          )}
          <p
            className={cn(
              'mt-0.5 text-2xl font-semibold tabular-nums tracking-tight',
              variant === 'idle' ? 'text-white/35' : 'text-white',
            )}
          >
            {value}
          </p>
        </div>
      )}
    </div>
  );
}
