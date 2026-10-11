import { AlertCircle, GraduationCap, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fmtCurrency } from '../../lib/format';
import { SummaryCallout } from './summary-callout';

export function EnrollmentFeePreview({
  schoolYear,
  classLabel,
  sectionLabel,
  fee,
  hasClass,
}: {
  schoolYear: string;
  classLabel?: string;
  sectionLabel?: string;
  fee: number | null;
  hasClass: boolean;
}) {
  const { t } = useTranslation();
  const ready = hasClass && fee != null;

  return (
    <SummaryCallout
      icon={ready ? Wallet : hasClass ? AlertCircle : GraduationCap}
      variant={ready ? 'ready' : hasClass ? 'warning' : 'idle'}
      title={t('students.feePreview.title')}
      description={
        ready
          ? t('students.feePreview.classLine', {
              className: classLabel ?? t('common.dash'),
              section: sectionLabel ?? t('common.dash'),
              year: schoolYear,
            })
          : hasClass
            ? t('students.feePreview.noFee')
            : t('students.feePreview.selectClass')
      }
      hint={ready ? t('students.feePreview.recorded') : undefined}
      valueLabel={t('students.feePreview.amountLabel')}
      value={ready ? fmtCurrency(fee) : t('common.dash')}
    />
  );
}
