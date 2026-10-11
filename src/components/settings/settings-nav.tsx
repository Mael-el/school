import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SettingsNavItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

export function SettingsNav<T extends string>({
  items,
  active,
  onChange,
}: {
  items: SettingsNavItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="flex shrink-0 flex-col gap-1 md:w-56">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/20 text-white shadow-sm ring-1 ring-primary/30'
                : 'text-white/60 hover:bg-white/10 hover:text-white',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                isActive ? 'bg-primary/25 text-primary' : 'bg-white/10 text-white/70',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
