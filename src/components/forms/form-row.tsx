import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Responsive two-column row for paired compact fields (date + select). */
export function FormRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2',
        className,
      )}
    >
      {children}
    </div>
  );
}
