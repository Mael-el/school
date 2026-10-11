import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function FormActions({
  children,
  className,
  sticky = false,
}: {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-6',
        sticky && 'sticky bottom-0 z-10 mt-2 bg-transparent',
        className,
      )}
    >
      {children}
    </div>
  );
}
