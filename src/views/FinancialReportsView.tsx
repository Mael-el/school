import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import {
  BarChart3,
  CircleDollarSign,
  FileDown,
  FileSpreadsheet,
  Receipt,
  Scale,
  Wallet,
} from 'lucide-react';
import type { CashflowTotals, MonthlyCashflow } from '../lib/types';
import { loadTreasuryData } from '../lib/treasury-stats';
import { Button } from '../components/ui/button';
import { MonthPicker } from '../components/ui/month-picker';
import { Card, CardContent } from '../components/ui/card';
import { DataGrid } from '../components/ui/data-grid';
import { EmptyState } from '../components/ui/empty-state';
import { PageToolbar } from '../components/ui/page-toolbar';
import { FormField, FormRow } from '../components/forms';
import { SummaryCallout } from '../components/ui/summary-callout';
import { PageIntro } from '../components/ui/page-intro';
import { fmtCurrency } from '../lib/format';
import { invokePrint, printErrorMessage } from '../lib/print';

export function FinancialReportsView() {
  const { t } = useTranslation();
  const [monthly, setMonthly] = useState<MonthlyCashflow[]>([]);
  const [totals, setTotals] = useState<CashflowTotals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [excelExportEnabled, setExcelExportEnabled] = useState(true);
  const columns = useMemo<ColumnDef<MonthlyCashflow>[]>(
    () => [
      {
        accessorKey: 'period',
        header: t('financialReports.columns.month'),
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'revenue',
        header: t('financialReports.columns.income'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
      {
        accessorKey: 'expenses',
        header: t('financialReports.columns.expenses'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
      {
        accessorKey: 'salaries',
        header: t('financialReports.columns.salaries'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
      {
        accessorKey: 'net',
        header: t('financialReports.columns.netBalance'),
        meta: { align: 'right' },
        cell: ({ getValue }) => fmtCurrency(getValue<number>()),
      },
    ],
    [t],
  );

  const currentFilters = () => ({
    from: filterFrom || undefined,
    to: filterTo || undefined,
  });

  const load = async () => {
    setError(null);
    try {
      const data = await loadTreasuryData(currentFilters());
      setMonthly(data.monthly);
      setTotals(data.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void load();
    void (async () => {
      const enabled = await window.api.settings.get('excel_export_enabled');
      setExcelExportEnabled(enabled !== '0');
    })();
  }, [filterFrom, filterTo]);

  const exportPdf = async () => {
    try {
      await invokePrint(
        () => window.api.print.financialReport(currentFilters()),
        t('financialReports.reportGenerated'),
      );
    } catch (err) {
      setError(printErrorMessage(err));
    }
  };

  const exportExcel = async () => {
    if (!excelExportEnabled) return;
    try {
      await window.api.treasury.exportExcel(currentFilters());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        icon={BarChart3}
        title={t('financialReports.pageIntro.title')}
        description={t('financialReports.pageIntro.description')}
      />
      <Card>
        <CardContent className="pt-6">
          <PageToolbar
            actions={
              <>
                <Button
                  variant="outline"
                  onClick={exportPdf}
                  title={t('common.exportPdf')}
                >
                  <FileDown className="h-4 w-4" />
                  {t('common.exportPdf')}
                </Button>
                {excelExportEnabled && (
                  <Button
                    variant="outline"
                    onClick={exportExcel}
                    title={t('common.exportExcel')}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {t('common.exportExcel')}
                  </Button>
                )}
              </>
            }
          >
            <FormRow className="md:grid-cols-2">
              <FormField stacked label={t('financialReports.filterFrom')}>
                <MonthPicker
                  value={filterFrom}
                  onChange={setFilterFrom}
                  placeholder={t('financialReports.monthFromPlaceholder')}
                />
              </FormField>
              <FormField stacked label={t('financialReports.filterTo')}>
                <MonthPicker
                  value={filterTo}
                  onChange={setFilterTo}
                  placeholder={t('financialReports.monthToPlaceholder')}
                />
              </FormField>
            </FormRow>
          </PageToolbar>

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <SummaryCallout
              icon={CircleDollarSign}
              variant="ready"
              title={t('financialReports.income')}
              value={fmtCurrency(totals?.revenue ?? 0)}
            />
            <SummaryCallout
              icon={Receipt}
              variant="warning"
              title={t('financialReports.expenses')}
              value={fmtCurrency(totals?.expenses ?? 0)}
            />
            <SummaryCallout
              icon={Wallet}
              variant="idle"
              title={t('financialReports.salaries')}
              value={fmtCurrency(totals?.salaries ?? 0)}
            />
            <SummaryCallout
              icon={Scale}
              variant={(totals?.net ?? 0) >= 0 ? 'ready' : 'warning'}
              title={t('financialReports.netBalance')}
              value={fmtCurrency(totals?.net ?? 0)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {monthly.length === 0 ? (
            <EmptyState title={t('financialReports.empty')} />
          ) : (
            <DataGrid
              columns={columns}
              data={monthly}
              getRowId={(row) => row.period}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
