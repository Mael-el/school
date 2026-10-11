import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { formatDateFr, DISPLAY_DATE_SHORT } from '../../lib/dates';

export interface CancellableRow {
  status: 'Validé' | 'Annulé' | string;
  cancelled_reason?: string | null;
  cancelled_at?: string | null;
}

export function CancelReasonCell({
  reason,
  cancelledAt,
}: {
  reason: string | null | undefined;
  cancelledAt?: string | null;
}) {
  if (!reason?.trim()) {
    return <span className="text-muted-foreground">—</span>;
  }
  const title = cancelledAt
    ? formatDateFr(cancelledAt, DISPLAY_DATE_SHORT)
    : undefined;
  return (
    <span className="text-xs text-muted-foreground" title={title}>
      {reason}
    </span>
  );
}

export function cancelReasonColumnDef<T extends CancellableRow>(
  t: TFunction,
): ColumnDef<T> {
  return {
    id: 'cancelled_reason',
    accessorFn: (row) => row.cancelled_reason ?? '',
    header: t('common.cancelReasonColumn'),
    cell: ({ row }) =>
      row.original.status === 'Annulé' ? (
        <CancelReasonCell
          reason={row.original.cancelled_reason}
          cancelledAt={row.original.cancelled_at}
        />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  };
}
