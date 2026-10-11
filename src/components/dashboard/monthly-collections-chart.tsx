import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyCollection } from '../../lib/types';
import { getMonthAbbreviations } from '../../lib/dates';
import { fmtCurrency, fmtNumber } from '../../lib/format';
import { ChartEmptyState, ChartPanel } from './chart-panel';

function formatMonth(month: string, monthLabels: string[]): string {
  const [, monthNum] = month.split('-');
  const index = Number(monthNum) - 1;
  return monthLabels[index] ?? month;
}

/** Line chart "Évolution mensuelle des encaissements" (Phase 3 roadmap). */
export function MonthlyCollectionsChart({
  data,
}: {
  data: MonthlyCollection[] | null;
}) {
  const { t, i18n } = useTranslation();
  const monthLabels = useMemo(
    () => getMonthAbbreviations(),
    [i18n.language],
  );
  const chartData = data?.map((d) => ({
    ...d,
    label: formatMonth(d.month, monthLabels),
  }));

  return (
    <ChartPanel
      title={t('charts.monthlyCollections.title')}
      subtitle={t('charts.monthlyCollections.subtitle')}
    >
      {chartData === undefined ? (
        <ChartEmptyState message={t('common.loading')} />
      ) : chartData.length === 0 ? (
        <ChartEmptyState message={t('charts.monthlyCollections.empty')} />
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
            <Line
              type="monotone"
              dataKey="total"
              name={t('charts.monthlyCollections.collected')}
              stroke="#a78bfa"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#a78bfa' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}
