import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FieldError } from './field-error';
import { RequiredMarker } from './required-marker';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  /** Full width on all breakpoints (default: responsive label-left on md+) */
  stacked?: boolean;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  icon: Icon,
  children,
  className,
  stacked = false,
}: FormFieldProps) {
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div
      className={cn(
        stacked
          ? 'flex flex-col gap-2'
          : 'grid grid-cols-1 gap-2 md:grid-cols-12 md:items-start md:gap-5',
        className,
      )}
    >
      <div className={cn(!stacked && 'md:col-span-4 md:pt-2')}>
        <label
          htmlFor={htmlFor}
          className="inline-flex items-center gap-2 text-sm font-semibold leading-none tracking-wide text-white/90"
        >
          {Icon && <Icon className="h-4 w-4 text-white/55" aria-hidden />}
          {label}
          {required && <RequiredMarker />}
        </label>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
      <div className={cn(!stacked && 'md:col-span-8', 'flex flex-col gap-1.5')}>
        {children}
        <FieldError id={errorId}>{error}</FieldError>
      </div>
    </div>
  );
}
