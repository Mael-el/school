import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Solid, high-contrast action chips for dark glass tables. */
export type TableActionTone = 'default' | 'primary' | 'warning' | 'destructive';

const toneClasses: Record<TableActionTone, string> = {
  default:
    'bg-white/14 text-white ring-1 ring-white/20 hover:bg-white/22',
  primary:
    'bg-gradient-to-b from-fuchsia-500 to-purple-600 text-white ring-1 ring-fuchsia-400/40 hover:from-fuchsia-400 hover:to-purple-500',
  warning:
    'bg-amber-600 text-white ring-1 ring-amber-400/50 hover:bg-amber-500',
  destructive:
    'bg-red-600 text-white ring-1 ring-red-400/50 hover:bg-red-500',
};

export function TableActionGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-1.5', className)}>
      {children}
    </div>
  );
}

export function TableActionButton({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
  title,
  disabled,
  iconOnly = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: TableActionTone;
  title?: string;
  disabled?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60',
        'disabled:pointer-events-none disabled:opacity-45',
        iconOnly ? 'px-2' : 'px-2.5',
        toneClasses[tone],
      )}
      title={title ?? label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {!iconOnly ? <span>{label}</span> : null}
    </button>
  );
}
