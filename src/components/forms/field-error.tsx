import { cn } from '../../lib/utils';

export function FieldError({
  id,
  children,
  className,
}: {
  id?: string;
  children?: string | null;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn('text-xs text-destructive', className)}
    >
      {children}
    </p>
  );
}
