import { UserCog, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { StaffMember } from '../../lib/types';
import { fmtCurrency } from '../../lib/format';
import { SummaryCallout } from './summary-callout';

export function StaffSalaryPreview({
  member,
  showSalary,
}: {
  member?: StaffMember;
  showSalary: boolean;
}) {
  const { t } = useTranslation();

  if (!member) {
    return (
      <SummaryCallout
        icon={UserCog}
        variant="idle"
        title={t('staff.preview.title')}
        description={t('staff.preview.selectEmployee')}
        valueLabel={t('staff.preview.salary')}
        value={t('common.dash')}
      />
    );
  }

  return (
    <SummaryCallout
      icon={Wallet}
      variant="ready"
      title={member.full_name}
      description={`${member.staff_no} · ${member.role}`}
      hint={t('staff.preview.hint')}
      valueLabel={t('staff.preview.salary')}
      value={
        showSalary ? fmtCurrency(member.monthly_salary) : t('common.dash')
      }
    />
  );
}