import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Hash } from 'lucide-react';
import type { ClassLevelStructured, Student } from '../lib/types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { GeneratedIdInput } from '../components/ui/generated-id-input';
import { Select } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { DatePicker } from '../components/ui/date-picker';
import { Combobox } from '../components/ui/combobox';
import { EnrollmentFeePreview } from '../components/ui/enrollment-fee-preview';
import { PageBackHeader } from '../components/ui/page-back-header';
import {
  FormActions,
  FormField,
  FormRow,
  FormSection,
  FormShell,
} from '../components/forms';
import { labelForSection, levelsForSection } from '../lib/class-levels';
import { translateSection } from '../lib/i18n-domain';
import { useResolvedClassFee } from '../hooks/use-class-fees';
import { notify } from '../lib/notify';
import { nextRegistrationNumber } from '../lib/next-generated-id';

const ENROLLMENT_STATUSES = ['Actif', 'Transféré', 'Retiré'] as const;

type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

function enrollmentStatusKey(status: EnrollmentStatus) {
  if (status === 'Actif') return 'active';
  if (status === 'Transféré') return 'transferred';
  return 'withdrawn';
}

export interface EnrollmentFormState {
  studentId: string;
  classLevelId: string;
  section: '' | 'Francophone' | 'Anglophone';
  registrationNo: string;
  registrationDate: string;
  enrollmentStatus: EnrollmentStatus;
}

export const EMPTY_ENROLLMENT_FORM: EnrollmentFormState = {
  studentId: '',
  classLevelId: '',
  section: '',
  registrationNo: '',
  registrationDate: '',
  enrollmentStatus: 'Actif',
};

export function EnrollmentFormView({
  mode,
  schoolYear,
  structuredLevels,
  students,
  initialForm = EMPTY_ENROLLMENT_FORM,
  editingEnrollmentId = null,
  onBack,
  onSaved,
}: {
  mode: 'create' | 'edit';
  schoolYear: string;
  structuredLevels: ClassLevelStructured[];
  students: Student[];
  initialForm?: EnrollmentFormState;
  editingEnrollmentId?: number | null;
  onBack: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<EnrollmentFormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generatingRegNo, setGeneratingRegNo] = useState(false);

  const fillRegistrationNo = async (overwrite = false) => {
    setGeneratingRegNo(true);
    try {
      const next = await nextRegistrationNumber(schoolYear);
      setForm((current) => ({
        ...current,
        registrationNo:
          overwrite || !current.registrationNo.trim()
            ? next
            : current.registrationNo,
      }));
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : t('common.generateFailed'),
      );
    } finally {
      setGeneratingRegNo(false);
    }
  };

  useEffect(() => {
    setForm(initialForm);
    setFormError(null);
    if (mode !== 'create') return undefined;
    void fillRegistrationNo(false);
    return undefined;
  }, [initialForm, mode, editingEnrollmentId, schoolYear]);

  const selectableLevels = useMemo(
    () => levelsForSection(structuredLevels, form.section),
    [structuredLevels, form.section],
  );
  const selectedLevel = useMemo(
    () =>
      selectableLevels.find((level) => String(level.id) === form.classLevelId),
    [selectableLevels, form.classLevelId],
  );
  const previewFee = useResolvedClassFee(
    schoolYear,
    form.classLevelId,
    form.section,
  );

  useEffect(() => {
    if (!form.classLevelId) return;
    const stillValid = selectableLevels.some(
      (level) => String(level.id) === form.classLevelId,
    );
    if (!stillValid) {
      setForm((current) => ({ ...current, classLevelId: '' }));
    }
  }, [selectableLevels, form.classLevelId]);

  const studentOptions = useMemo(
    () =>
      students.map((s) => ({
        value: String(s.id),
        label: `${s.full_name} (${s.matricule})`,
        keywords: `${s.full_name} ${s.matricule}`,
      })),
    [students],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.classLevelId || !schoolYear) {
      setFormError(t('enrollments.requiredError'));
      return;
    }
    if (mode === 'create' && !form.studentId) {
      setFormError(t('enrollments.requiredError'));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'edit' && editingEnrollmentId) {
        await window.api.enrollments.update(editingEnrollmentId, {
          class_level_id: Number(form.classLevelId),
          section: form.section || null,
          registration_no: form.registrationNo || null,
          registration_date: form.registrationDate || null,
          status: form.enrollmentStatus,
        });
        notify.success(t('enrollments.updated'));
      } else {
        await window.api.enrollments.create({
          student_id: Number(form.studentId),
          school_year: schoolYear,
          class_level_id: Number(form.classLevelId),
          section: form.section || null,
          registration_no: form.registrationNo || null,
          registration_date: form.registrationDate || null,
        });
        notify.success(t('enrollments.created'));
      }
      await onSaved();
      onBack();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    mode === 'edit'
      ? t('enrollments.editEnrollment')
      : t('enrollments.newEnrollment');

  return (
    <div className="flex flex-col gap-4">
      <PageBackHeader title={title} onBack={onBack} />
      <Card>
        <CardContent className="p-8">
          <FormShell onSubmit={submit}>
            <FormSection
              icon={GraduationCap}
              title={title}
              description={t('students.enrollmentSectionHelp')}
            >
              {mode === 'create' && (
                <FormField
                  stacked
                  label={t('enrollments.student')}
                  htmlFor="enrollment-student"
                  required
                >
                  <Combobox
                    options={studentOptions}
                    value={form.studentId}
                    onChange={(studentId) =>
                      setForm((current) => ({ ...current, studentId }))
                    }
                    placeholder={t('common.selectPlaceholder')}
                    searchPlaceholder={t('students.searchPlaceholder')}
                    emptyLabel={t('students.empty')}
                  />
                </FormField>
              )}
              <FormRow>
                <FormField
                  stacked
                  label={t('enrollments.section')}
                  htmlFor="enrollment-section"
                >
                  <Select
                    id="enrollment-section"
                    value={form.section}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        section: e.target.value as EnrollmentFormState['section'],
                        classLevelId: '',
                      }))
                    }
                  >
                    <option value="">{t('common.dash')}</option>
                    <option value="Francophone">
                      {t('enum.section.francophone')}
                    </option>
                    <option value="Anglophone">
                      {t('enum.section.anglophone')}
                    </option>
                  </Select>
                </FormField>
                <FormField
                  stacked
                  label={t('enrollments.class')}
                  htmlFor="enrollment-class"
                  required
                >
                  <Select
                    id="enrollment-class"
                    value={form.classLevelId}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        classLevelId: e.target.value,
                      }))
                    }
                  >
                    <option value="">{t('common.selectPlaceholder')}</option>
                    {selectableLevels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {labelForSection(level, form.section || null)}
                        {level.code ? ` (${level.code})` : ''}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </FormRow>
              <EnrollmentFeePreview
                schoolYear={schoolYear}
                classLabel={
                  selectedLevel
                    ? labelForSection(selectedLevel, form.section || null)
                    : undefined
                }
                sectionLabel={
                  form.section
                    ? translateSection(form.section, t)
                    : undefined
                }
                fee={previewFee}
                hasClass={Boolean(form.classLevelId)}
              />
              <FormRow>
                <FormField
                  stacked
                  icon={Hash}
                  label={t('enrollments.registrationNo')}
                  htmlFor="enrollment-reg-no"
                >
                  {mode === 'create' ? (
                    <GeneratedIdInput
                      id="enrollment-reg-no"
                      value={form.registrationNo}
                      onChange={(registrationNo) =>
                        setForm((current) => ({ ...current, registrationNo }))
                      }
                      onGenerate={() => fillRegistrationNo(true)}
                      generateLabel={t('common.generate')}
                      generateTitle={t('enrollments.registrationNoHint')}
                      generating={generatingRegNo}
                    />
                  ) : (
                    <Input
                      id="enrollment-reg-no"
                      value={form.registrationNo}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          registrationNo: e.target.value,
                        }))
                      }
                    />
                  )}
                </FormField>
                <FormField
                  stacked
                  label={t('enrollments.registrationDate')}
                  htmlFor="enrollment-reg-date"
                >
                  <DatePicker
                    value={form.registrationDate}
                    onChange={(registrationDate) =>
                      setForm((current) => ({ ...current, registrationDate }))
                    }
                    placeholder={t('enrollments.registrationDate')}
                  />
                </FormField>
              </FormRow>
              {mode === 'edit' && (
                <FormField
                  stacked
                  label={t('enrollments.enrollmentStatus')}
                  htmlFor="enrollment-status"
                >
                  <Select
                    id="enrollment-status"
                    value={form.enrollmentStatus}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        enrollmentStatus: e.target.value as EnrollmentStatus,
                      }))
                    }
                  >
                    {ENROLLMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {t(`enum.enrollmentStatus.${enrollmentStatusKey(status)}`)}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
            </FormSection>

            {formError && (
              <p className="text-sm text-destructive" role="alert">
                {formError}
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
                {mode === 'edit'
                  ? t('common.save')
                  : t('enrollments.createEnrollment')}
              </Button>
            </FormActions>
          </FormShell>
        </CardContent>
      </Card>
    </div>
  );
}
