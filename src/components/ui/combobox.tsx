import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DROPDOWN_Z_INDEX, fieldControlClasses } from '../../lib/field-styles';
import { Input } from './input';

export interface ComboboxOption {
  value: string;
  label: string;
  keywords?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = '—',
  searchPlaceholder = 'Rechercher…',
  emptyLabel = 'Aucun résultat',
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const haystack = `${o.label} ${o.keywords ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 280 && rect.top > spaceBelow;
      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        width: Math.max(rect.width, 240),
        zIndex: DROPDOWN_Z_INDEX,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="overflow-hidden rounded-xl border border-white/15 bg-[#160826] shadow-2xl shadow-black/50"
        >
          <div className="border-b border-white/10 px-3 pb-3 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 pl-9"
                autoFocus
              />
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto px-1.5 py-1.5 text-sm">
            {filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-left font-medium transition-colors hover:bg-white/12',
                    option.value === value && 'bg-primary/35 font-semibold',
                  )}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {option.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-3 font-medium text-muted-foreground">
                {emptyLabel}
              </li>
            )}
          </ul>
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          fieldControlClasses,
          'justify-between text-left',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'truncate',
            !selected && 'font-normal text-white/40',
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {menu}
    </div>
  );
}
