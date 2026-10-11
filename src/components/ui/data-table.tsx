import type { CSSProperties, ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export type TableAlign = 'left' | 'right' | 'center';

export const tableAlignClass: Record<TableAlign, string> = {
  left: 'text-left',
  right: 'text-right tabular-nums',
  center: 'text-center',
};

export const tableHeadClass =
  'px-4 py-3.5 first:pl-5 last:pr-5 text-sm font-semibold tracking-wide text-white/85';

export const tableCellClass = 'px-4 py-3.5 first:pl-5 last:pr-5';

export function DataTableContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto pb-6', className)}>{children}</div>
  );
}

export function DataTable({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <table className={cn('w-full min-w-full text-sm', className)} style={style}>
      {children}
    </table>
  );
}

export function DataTableHeader({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03]">
      {children}
    </thead>
  );
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody className="[&_tr:last-child_td]:pb-5">{children}</tbody>;
}

export function DataTableRow({
  children,
  className,
  zebra = true,
}: {
  children: ReactNode;
  className?: string;
  zebra?: boolean;
}) {
  return (
    <tr
      className={cn(
        'border-b border-white/[0.06] transition-colors last:border-0',
        zebra && 'even:bg-white/[0.025] hover:bg-white/[0.055]',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TableSortLabel({
  canSort,
  sorted,
  align = 'left',
  onClick,
  children,
}: {
  canSort: boolean;
  sorted?: false | 'asc' | 'desc';
  align?: TableAlign;
  onClick?: (event: unknown) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const label =
    sorted === 'asc'
      ? t('ui.table.sortedAsc')
      : sorted === 'desc'
        ? t('ui.table.sortedDesc')
        : t('ui.table.sort');

  if (!canSort) {
    return <span className="select-none">{children}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'inline-flex select-none items-center gap-1.5 rounded-lg px-1.5 py-1 -mx-1.5 transition-colors hover:bg-white/[0.08] hover:text-white/80',
        sorted && 'text-white/80',
        align === 'right' && 'flex-row-reverse',
        align === 'center' && 'w-full justify-center',
      )}
    >
      <span>{children}</span>
      {sorted === 'asc' ? (
        <ArrowUp className="h-3.5 w-3.5 text-primary" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="h-3.5 w-3.5 text-primary" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-35" />
      )}
    </button>
  );
}

export function DataTableHead({
  children,
  align = 'left',
  className,
  sortable = false,
  sorted,
  onSort,
}: {
  children: ReactNode;
  align?: TableAlign;
  className?: string;
  sortable?: boolean;
  sorted?: false | 'asc' | 'desc';
  onSort?: () => void;
}) {
  return (
    <th className={cn(tableHeadClass, tableAlignClass[align], className)}>
      <TableSortLabel
        canSort={sortable}
        sorted={sorted}
        align={align}
        onClick={onSort}
      >
        {children}
      </TableSortLabel>
    </th>
  );
}

export function DataTableCell({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: TableAlign;
  className?: string;
}) {
  return (
    <td className={cn(tableCellClass, tableAlignClass[align], className)}>
      {children}
    </td>
  );
}
