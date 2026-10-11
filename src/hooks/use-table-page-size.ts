import { useEffect, useState } from 'react';
import {
  DEFAULT_TABLE_PAGE_SIZE,
  parseTablePageSize,
} from '../lib/table-page-size';

export function useTablePageSize() {
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    const api = window.api?.settings;
    if (!api) return undefined;

    void api
      .get('table_page_size')
      .then((value) => {
        if (!cancelled) setPageSize(parseTablePageSize(value));
      })
      .catch(() => {
        // Keep the in-memory default when settings are unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { pageSize, setPageSize };
}
