import { User, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EnrollmentBalance } from '../../lib/types';
import { fmtCurrency } from '../../lib/format';
import { SummaryCallout } from './summary-callout';

export function StudentBalancePreview({
  balance,
}: {
  balance?: EnrollmentBalance;
}) {
  const { t } = useTranslation();

  if (!balance) {
    return (
      <SummaryCallout
        icon={User}
        variant="idle"
        title={t('payments.preview.title')}
        description={t('payments.preview.selectStudent')}
        valueLabel={t('payments.preview.balance')}
        value={t('common.dash')}
      />
    );
  }

  return (
    <SummaryCallout
      icon={Wallet}
      variant={balance.balance > 0 ? 'warning' : 'ready'}
      title={balance.full_name}
      description={`${balance.matricule} · ${balance.class_name}`}
      hint={t('payments.preview.hint')}
      stats={[
        {
          label: t('report.expectedFee'),
          value: fmtCurrency(balance.expected_fee),
        },
        {
          label: t('report.totalPaid'),
          value: fmtCurrency(balance.total_paid),
        },
        {
          label: t('payments.preview.balance'),
          value: fmtCurrency(balance.balance),
        },
      ]}
    />
  );
}
