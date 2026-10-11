import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export function FormSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-5', className)}>
      <div className="flex items-start gap-3 border-b border-white/10 pb-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white/80 ring-1 ring-white/12">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-wide text-white/85">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-sm text-white/50">{description}</p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}
