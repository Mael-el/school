import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ActionCardProps {
  label: string;
  value: string;
  status: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  statusIcon?: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
  }>;
  gradient: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Colorful glass-style dashboard tile inspired by macOS "Smart Care"-type
 * apps: gradient background, icon badge floating top-right, big stat value
 * and a small status line with a checkmark.
 */
export function ActionCard({
  label,
  value,
  status,
  icon: Icon,
  statusIcon: StatusIcon = CheckCircle2,
  gradient,
  onClick,
  className,
}: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex h-44 flex-col justify-between overflow-hidden rounded-3xl border border-white/10 p-5 text-left shadow-lg shadow-black/20 transition-transform duration-200 ease-out hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
        gradient,
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl transition-opacity group-hover:opacity-80"
      />
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-white/80">{label}</span>
        <span className="flex h-12 w-12 rotate-6 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-sm transition-transform duration-200 group-hover:rotate-0">
          <Icon className="h-6 w-6 text-white" strokeWidth={2} />
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-2xl font-bold leading-none text-white">
          {value}
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-white/90">
          <StatusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
          {status}
        </span>
      </div>
    </button>
  );
}
