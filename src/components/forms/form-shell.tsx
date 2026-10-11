import type { FormEvent, ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Constrains form width (left-aligned) and vertical rhythm per §5.2 layout rules. */
export function FormShell({
  onSubmit,
  children,
  className,
}: {
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn('flex w-full flex-col gap-8', className)}
    >
      {children}
    </form>
  );
}
