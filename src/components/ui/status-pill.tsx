import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle2,
  CircleX,
  AlertTriangle,
  Info,
  CircleDashed,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// Single semantic color scale for every status badge in the app, so
// "Validé", "Actif", "Payé"… all read the same way visually.
const TONE_STYLES: Record<StatusTone, { className: string; icon: LucideIcon }> =
  {
    success: {
      className: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
      icon: CheckCircle2,
    },
    warning: {
      className: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
      icon: AlertTriangle,
    },
    danger: {
      className: 'bg-red-400/15 text-red-300 border-red-400/30',
      icon: CircleX,
    },
    info: {
      className: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
      icon: Info,
    },
    neutral: {
      className: 'bg-white/10 text-white/70 border-white/20',
      icon: CircleDashed,
    },
  };

export function StatusPill({
  tone,
  label,
  icon,
  className,
}: {
  tone: StatusTone;
  label: string;
  icon?: LucideIcon;
  className?: string;
}) {
  const style = TONE_STYLES[tone];
  const Icon = icon ?? style.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        style.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </span>
  );
}

/** Tone for a transaction status ('Validé' | 'Annulé'). */
export function transactionTone(status: 'Validé' | 'Annulé'): StatusTone {
  return status === 'Validé' ? 'success' : 'danger';
}

/** Tone for an enrollment status ('Actif' | 'Transféré' | 'Retiré'). */
export function enrollmentTone(
  status: 'Actif' | 'Transféré' | 'Retiré' | undefined,
): StatusTone {
  if (status === 'Transféré') return 'info';
  if (status === 'Retiré') return 'neutral';
  return 'success';
}

/** Tone for a staff member status ('Actif' | 'Suspendu' | 'Sorti'). */
export function staffTone(
  status: 'Actif' | 'Suspendu' | 'Sorti' | string,
): StatusTone {
  if (status === 'Actif') return 'success';
  if (status === 'Suspendu') return 'warning';
  return 'neutral';
}
