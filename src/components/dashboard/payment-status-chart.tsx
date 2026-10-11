import { useTranslation } from 'react-i18next';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { EnrollmentBalance } from '../../lib/types';
import { translatePaymentBalanceStatus } from '../../lib/i18n-domain';
import { ChartEmptyState, ChartPanel } from './chart-panel';

type BalanceStatus = EnrollmentBalance['status'];

/** Matches the colors used in payment-status-badge.tsx. */
const STATUS_COLORS: Record<BalanceStatus, string> = {
  Payé: '#34d399',
  'Paiement partiel': '#fbbf24',
  'Non payé': '#f87171',
  'Trop-perçu': '#38bdf8',
};

/** Pie chart "Situation des paiements" (Phase 3 roadmap). */
export function PaymentStatusChart({
  counts,
}: {
  counts: Record<BalanceStatus, number> | null;
}) {
  const { t } = useTranslation();

  const data =
    counts === null
      ? null
      : (Object.keys(STATUS_COLORS) as BalanceStatus[])
          .map((status) => ({
            status,
            label: translatePaymentBalanceStatus(status, t),
            value: counts[status],
          }))
          .filter((d) => d.value > 0);

  return (
    <ChartPanel
      title={t('charts.paymentStatus.title')}
      subtitle={t('charts.paymentStatus.subtitle')}
    >
      {data === null ? (
        <ChartEmptyState message={t('common.loading')} />
      ) : data.length === 0 ? (
        <ChartEmptyState message={t('charts.paymentStatus.empty')} />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={2}
            >
              {data.map((d) => (
                <Cell key={d.status} fill={STATUS_COLORS[d.status]} />
              ))}
            </Pie>
            <Tooltip
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
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}
