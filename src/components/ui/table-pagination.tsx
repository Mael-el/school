import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { Select } from './select';
import { cn } from '../../lib/utils';
import { pageSizeSelectOptions } from '../../lib/table-page-size';

export function TablePagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  if (total === 0) return null;

  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const sizes = pageSizeSelectOptions(pageSize);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3.5 text-sm text-muted-foreground',
        className,
      )}
    >
      <span>{t('ui.pagination.range', { from, to, total })}</span>
      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-sm font-medium text-white/75">
            {t('ui.pagination.pageSize')}
            <Select
              native
              value={String(pageSize)}
              aria-label={t('ui.pagination.pageSize')}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-9 w-[4.75rem]"
            >
              {sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </label>
        )}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-9 p-0"
            disabled={page === 0}
            aria-label={t('ui.pagination.previous')}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[4.5rem] text-center tabular-nums">
            {t('ui.pagination.pageOf', { page: page + 1, pages: pageCount })}
          </span>
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-9 p-0"
            disabled={page >= pageCount - 1}
            aria-label={t('ui.pagination.next')}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
