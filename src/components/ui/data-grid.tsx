import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import '@tanstack/react-table';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { useTablePageSize } from '../../hooks/use-table-page-size';
import {
  DataTable,
  DataTableBody,
  DataTableHeader,
  TableSortLabel,
  tableAlignClass,
  tableCellClass,
  tableHeadClass,
} from './data-table';
import { TablePagination } from './table-pagination';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'right' | 'center';
  }
}

/**
 * Sortable, paginated table built on TanStack Table, rendered with the
 * shared glass-panel table styles. The table grows with its rows (no
 * fixed viewport height); the page itself scrolls.
 */
export function DataGrid<T>({
  columns,
  data,
  pageSize: pageSizeProp,
  paginate = true,
  className,
  emptyRowClassName,
  getRowId,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  pageSize?: number;
  paginate?: boolean;
  className?: string;
  emptyRowClassName?: string;
  getRowId?: (row: T, index: number) => string;
}) {
  const { pageSize: settingPageSize } = useTablePageSize();
  const [localPageSize, setLocalPageSize] = useState<number | null>(null);
  const pageSize = pageSizeProp ?? localPageSize ?? settingPageSize;
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: paginate ? getPaginationRowModel() : undefined,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    enableSortingRemoval: true,
    initialState: paginate ? { pagination: { pageSize } } : undefined,
  });

  useEffect(() => {
    if (paginate) table.setPageSize(pageSize);
  }, [pageSize, paginate, table]);

  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const total = data.length;
  const pageCount = Math.max(1, table.getPageCount());

  return (
    <div className={cn('pb-6', className)}>
      <div className="overflow-x-auto">
        <DataTable
          style={{ width: table.getTotalSize(), minWidth: '100%' }}
        >
          <DataTableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const align = header.column.columnDef.meta?.align ?? 'left';
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize(), position: 'relative' }}
                      className={cn(tableHeadClass, tableAlignClass[align])}
                    >
                      {!header.isPlaceholder && (
                        <TableSortLabel
                          canSort={canSort}
                          sorted={header.column.getIsSorted()}
                          align={align}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </TableSortLabel>
                      )}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            'absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary/40',
                            header.column.getIsResizing() && 'bg-primary',
                          )}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </DataTableHeader>
          <DataTableBody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-white/[0.06] transition-colors last:border-0 even:bg-white/[0.025] hover:bg-white/[0.055]',
                  emptyRowClassName,
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const align = cell.column.columnDef.meta?.align ?? 'left';
                  return (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className={cn(tableCellClass, tableAlignClass[align])}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </DataTableBody>
        </DataTable>
      </div>
      {paginate && (
        <TablePagination
          page={pageIndex}
          pageCount={pageCount}
          total={total}
          pageSize={currentPageSize}
          onPageChange={(next) => table.setPageIndex(next)}
          onPageSizeChange={(next) => {
            if (pageSizeProp == null) setLocalPageSize(next);
            table.setPageSize(next);
          }}
        />
      )}
    </div>
  );
}
