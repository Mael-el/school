import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ClassBalanceSummary } from '../../lib/types';
import { fmtCurrency, fmtNumber } from '../../lib/format';
import { ChartEmptyState, ChartPanel } from './chart-panel';

/** Bar chart "Encaissements et soldes par classe" (Phase 3 roadmap). */
export function ClassBalancesChart({
  data,
}: {
  data: ClassBalanceSummary[] | null;
}) {
  const { t } = useTranslation();

  return (
    <ChartPanel
      title={t('charts.classBalances.title')}
      subtitle={t('charts.classBalances.subtitle')}
    >
      {data === null ? (
        <ChartEmptyState message={t('common.loading')} />
      ) : data.length === 0 ? (
        <ChartEmptyState message={t('charts.classBalances.empty')} />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ left: -16 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="class_name"
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
            <Legend
              wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}
            />
            <Bar
              dataKey="paid_total"
              name={t('charts.classBalances.collected')}
              fill="#34d399"
              radius={[6, 6, 0, 0]}
            />
            <Bar
              dataKey="balance_total"
              name={t('charts.classBalances.remaining')}
              fill="#fbbf24"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}
