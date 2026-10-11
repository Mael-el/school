import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyCashflow } from '../../lib/types';
import { getMonthAbbreviations } from '../../lib/dates';
import { fmtCurrency, fmtNumber } from '../../lib/format';
import { ChartEmptyState, ChartPanel } from './chart-panel';

function formatMonth(period: string, monthLabels: string[]): string {
  const [, monthNum] = period.split('-');
  const index = Number(monthNum) - 1;
  return monthLabels[index] ?? period;
}

/** Courbe "Recettes vs dépenses vs salaires" consolidée (Phase 8 roadmap). */
export function TreasuryChart({ data }: { data: MonthlyCashflow[] | null }) {
  const { t, i18n } = useTranslation();
  const monthLabels = useMemo(
    () => getMonthAbbreviations(),
    [i18n.language],
  );
  const chartData = data?.map((d) => ({
    ...d,
    label: formatMonth(d.period, monthLabels),
  }));

  return (
    <ChartPanel
      title={t('charts.treasury.title')}
      subtitle={t('charts.treasury.subtitle')}
    >
      {chartData === undefined ? (
        <ChartEmptyState message={t('common.loading')} />
      ) : chartData.length === 0 ? (
        <ChartEmptyState message={t('charts.treasury.empty')} />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ left: -16 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => fmtNumber(value)}
            />
            <Tooltip
              formatter={(value) => fmtCurrency(Number(value))}
              contentStyle={{
                background: 'rgba(20,20,30,0.9)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                color: 'white',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: 'white' }} />
            <Line
              type="monotone"
              dataKey="revenue"
              name={t('charts.treasury.income')}
              stroke="#34d399"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#34d399' }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="expenses"
              name={t('charts.treasury.expenses')}
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#f59e0b' }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="salaries"
              name={t('charts.treasury.salaries')}
              stroke="#f87171"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#f87171' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}
