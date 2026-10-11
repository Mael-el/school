// "Relances impayés" (docs/electron-app-plan.md section 10): liste des
// élèves inscrits avec un solde restant positif, et génération en un clic
// d'un message de rappel pré-rempli (copié dans le presse-papiers, ou
// envoyé directement en WhatsApp quand un numéro de tuteur est renseigné).
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { Copy, MessageCircle } from 'lucide-react';
import type { OverdueEnrollment } from '../../lib/types';
import { fmtCurrency, fmtNumber } from '../../lib/format';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { DataGrid } from '../ui/data-grid';
import { notify } from '../../lib/notify';

function buildReminderMessage(
  entry: OverdueEnrollment,
  schoolName: string,
  t: TFunction,
): string {
  const guardian =
    entry.guardian_name?.trim() || t('overdueReminders.defaultGuardian');
  return t('overdueReminders.message', {
    guardian,
    balance: fmtNumber(entry.balance),
    studentName: entry.full_name,
    className: entry.class_name,
    schoolName,
  });
}

export function OverdueReminders({
  overdue,
  schoolName,
}: {
  overdue: OverdueEnrollment[];
  schoolName: string;
}) {
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleCopy = async (entry: OverdueEnrollment) => {
    try {
      await navigator.clipboard.writeText(
        buildReminderMessage(entry, schoolName, t),
      );
      notify.success(t('overdueReminders.copied'));
    } catch {
      notify.error(t('overdueReminders.copyFailed'));
    }
  };

  const handleWhatsapp = async (entry: OverdueEnrollment) => {
    if (!entry.guardian_phone) return;
    setBusyId(entry.enrollment_id);
    try {
      const digits = entry.guardian_phone.replace(/\D/g, '');
      const text = encodeURIComponent(
        buildReminderMessage(entry, schoolName, t),
      );
      const opened = await window.api.system.openExternal(
        `https://wa.me/${digits}?text=${text}`,
      );
      if (!opened) notify.error(t('overdueReminders.whatsappFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const columns = useMemo<ColumnDef<OverdueEnrollment>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: t('overdueReminders.columns.student'),
      },
      {
        accessorKey: 'class_name',
        header: t('overdueReminders.columns.class'),
      },
      {
        accessorKey: 'balance',
        header: t('overdueReminders.columns.balance'),
        meta: { align: 'right' },
        cell: ({ getValue }) => (
          <span className="font-semibold text-destructive">
            {fmtCurrency(getValue<number>())}
          </span>
        ),
      },
      {
        id: 'guardian',
        accessorFn: (row) => row.guardian_name ?? '',
        header: t('overdueReminders.columns.guardian'),
        cell: ({ row }) => {
          const entry = row.original;
          return `${entry.guardian_name || t('common.dash')}${
            entry.guardian_phone ? ` (${entry.guardian_phone})` : ''
          }`;
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableResizing: false,
        size: 120,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                className="h-8 px-2"
                onClick={() => void handleCopy(entry)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              {entry.guardian_phone && (
                <Button
                  variant="ghost"
                  className="h-8 px-2"
                  disabled={busyId === entry.enrollment_id}
                  onClick={() => void handleWhatsapp(entry)}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [t, busyId, schoolName],
  );

  if (overdue.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {t('overdueReminders.title', { count: overdue.length })}
          </h2>
        </div>
        <DataGrid
          columns={columns}
          data={overdue}
          paginate={false}
          getRowId={(row) => String(row.enrollment_id)}
        />
      </CardContent>
    </Card>
  );
}
