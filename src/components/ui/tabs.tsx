import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

/** Pill-style tab bar shared across views (Staff, and future tabbed pages). */
export function Tabs<T extends string>({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex w-fit flex-wrap gap-1 rounded-full border border-white/10 bg-white/[0.06] p-1',
        className,
      )}
    >
      {items.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-gradient-to-b from-fuchsia-500 to-purple-600 text-white shadow-md shadow-fuchsia-900/30'
                : 'text-white/60 hover:bg-white/10 hover:text-white',
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
