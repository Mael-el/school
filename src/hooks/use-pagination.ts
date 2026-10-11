import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TABLE_PAGE_SIZE } from '../lib/table-page-size';

export function usePagination<T>(
  items: T[],
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [pageSize]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);

  const slice = useMemo(
    () => items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [items, safePage, pageSize],
  );

  return {
    page: safePage,
    setPage,
    pageCount,
    slice,
    total: items.length,
    pageSize,
    hasPagination: items.length > pageSize,
  };
}
