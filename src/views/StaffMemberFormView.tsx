import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash, Phone, Save, UserCog, UserPlus, Wallet } from 'lucide-react';
import type { StaffMember } from '../lib/types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { GeneratedIdInput } from '../components/ui/generated-id-input';
import { NumberInput } from '../components/ui/number-input';
import { PhoneInput } from '../components/ui/phone-input';
import { DatePicker } from '../components/ui/date-picker';
import { Card, CardContent } from '../components/ui/card';
import { PageBackHeader } from '../components/ui/page-back-header';
import {
  FormActions,
  FormField,
  FormRow,
  FormSection,
  FormShell,
} from '../components/forms';
import { notify } from '../lib/notify';
import { nextStaffNumber } from '../lib/next-generated-id';

export function StaffMemberFormView({
  isFixedSalary,
  editingMember = null,
  onBack,
  onSaved,
}: {
  isFixedSalary: boolean;
  /** When set, the form edits this member instead of creating a new one. */
  editingMember?: StaffMember | null;
  onBack: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const isEdit = editingMember !== null;
  const [staffNo, setStaffNo] = useState(editingMember?.staff_no ?? '');
  const [fullName, setFullName] = useState(editingMember?.full_name ?? '');
  const [role, setRole] = useState(editingMember?.role ?? '');
  const [phone, setPhone] = useState(editingMember?.phone ?? '');
  const [hireDate, setHireDate] = useState(editingMember?.hire_date ?? '');
  const [monthlySalary, setMonthlySalary] = useState(
    editingMember && editingMember.monthly_salary != null
      ? String(editingMember.monthly_salary)
      : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generatingStaffNo, setGeneratingStaffNo] = useState(false);

  const fillStaffNo = async (overwrite = false) => {
    setGeneratingStaffNo(true);
    try {
      const next = await nextStaffNumber();
      setStaffNo((current) =>
        overwrite || !current.trim() ? next : current,
      );
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : t('common.generateFailed'),
      );
    } finally {
      setGeneratingStaffNo(false);
    }
  };

  useEffect(() => {
    if (isEdit) return;
    void fillStaffNo(false);
  }, [isEdit]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!staffNo || !fullName || !role) {
      setError(
        t(
          isFixedSalary
            ? 'staff.memberRequiredErrorFixed'
            : 'staff.memberRequiredError',
        ),
      );
      return;
    }
    const salaryNum = monthlySalary.trim() ? Number(monthlySalary) : 0;
    if (isFixedSalary && (!Number.isFinite(salaryNum) || salaryNum <= 0)) {
      setError(t('staff.salaryError'));
      return;
    }
    if (
      !isFixedSalary &&
      monthlySalary.trim() &&
      (!Number.isFinite(salaryNum) || salaryNum < 0)
    ) {
      setError(t('staff.salaryError'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        staff_no: staffNo,
        full_name: fullName,
        role,
        phone: phone || null,
        hire_date: hireDate || null,
        monthly_salary: salaryNum,
      };
      if (isEdit && editingMember) {
        await window.api.staff.update(editingMember.id, payload);
        notify.success(t('staff.memberUpdated'));
      } else {
        await window.api.staff.create(payload);
        notify.success(t('staff.memberAdded'));
      }
      await onSaved();
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageBackHeader
        title={
          isEdit
            ? t('staff.editMemberTitle', { name: editingMember?.full_name })
            : t('staff.addMember')
        }
        onBack={onBack}
      />
      {!isFixedSalary && (
        <p className="text-xs text-muted-foreground">
          {t('staff.variableSalaryHint')}
        </p>
      )}
      <Card>
        <CardContent className="p-8">
          <FormShell onSubmit={submit}>
            <FormSection
              icon={UserCog}
              title={t('staff.memberFormSection')}
              description={t('staff.memberFormSectionHelp')}
            >
              <FormRow>
                <FormField
                  stacked
                  icon={Hash}
                  label={t('staff.matricule')}
                  htmlFor="staff-no"
                  required
                >
                  {isEdit ? (
                    <Input
                      id="staff-no"
                      value={staffNo}
                      onChange={(e) => setStaffNo(e.target.value)}
                    />
                  ) : (
                    <GeneratedIdInput
                      id="staff-no"
                      value={staffNo}
                      onChange={setStaffNo}
                      onGenerate={() => fillStaffNo(true)}
                      generateLabel={t('common.generate')}
                      generateTitle={t('staff.matriculeHint')}
                      generating={generatingStaffNo}
                    />
                  )}
                </FormField>
                <FormField
                  stacked
                  label={t('staff.fullName')}
                  htmlFor="staff-full-name"
                  required
                >
                  <Input
                    id="staff-full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField
                  stacked
                  label={t('staff.role')}
                  htmlFor="staff-role"
                  required
                >
                  <Input
                    id="staff-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </FormField>
                <FormField
                  stacked
                  icon={Phone}
                  label={t('staff.phone')}
                  htmlFor="staff-phone"
                >
                  <PhoneInput
                    id="staff-phone"
                    value={phone}
                    onChange={setPhone}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField stacked label={t('staff.hireDate')} htmlFor="staff-hire-date">
                  <DatePicker
                    id="staff-hire-date"
                    value={hireDate}
                    onChange={setHireDate}
                    placeholder={t('staff.hireDate')}
                  />
                </FormField>
                <FormField
                  stacked
                  icon={Wallet}
                  label={
                    isFixedSalary
                      ? t('staff.monthlySalary')
                      : t('staff.monthlySalaryOptional')
                  }
                  htmlFor="staff-monthly-salary"
                  required={isFixedSalary}
                >
                  <NumberInput
                    id="staff-monthly-salary"
                    mode="decimal"
                    value={monthlySalary}
                    onChange={setMonthlySalary}
                  />
                </FormField>
              </FormRow>
            </FormSection>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <FormActions sticky>
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                disabled={submitting}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {isEdit ? (
                  <Save className="mr-2 h-4 w-4" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {isEdit ? t('common.save') : t('staff.addMember')}
              </Button>
            </FormActions>
          </FormShell>
        </CardContent>
      </Card>
    </div>
  );
}
