import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Input } from './input';

/** Standard filter + primary action bar above tables. */
export function PageToolbar({
  children,
  actions,
  className,
}: {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border/40 bg-white/[0.03] p-4',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
        {children}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function ToolbarField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-semibold text-white/85"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function TableSearchField({
  value,
  onChange,
  placeholder,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative min-w-[16rem] flex-1 max-w-lg', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 pl-10"
      />
    </div>
  );
}
