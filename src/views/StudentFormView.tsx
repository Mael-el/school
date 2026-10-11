import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Hash, Phone, User } from 'lucide-react';
import type { ClassLevelStructured } from '../lib/types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { GeneratedIdInput } from '../components/ui/generated-id-input';
import { PhoneInput } from '../components/ui/phone-input';
import { Select } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { DatePicker } from '../components/ui/date-picker';
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
import {
  nextRegistrationNumber,
  nextStudentMatricule,
} from '../lib/next-generated-id';

export interface StudentFormState {
  matricule: string;
  full_name: string;
  gender: '' | 'Garçon' | 'Fille';
  birth_date: string;
  guardian_name: string;
  guardian_phone: string;
  neighborhood: string;
  section: '' | 'Francophone' | 'Anglophone';
  class_level_id: string;
  registration_no: string;
  registration_date: string;
}

export const EMPTY_STUDENT_FORM: StudentFormState = {
  matricule: '',
  full_name: '',
  gender: '',
  birth_date: '',
  guardian_name: '',
  guardian_phone: '',
  neighborhood: '',
  section: '',
  class_level_id: '',
  registration_no: '',
  registration_date: '',
};

const currentYear = new Date().getFullYear();
const earliestBirthMonth = new Date(currentYear - 100, 0);
const latestBirthMonth = new Date(currentYear, 11);

export function StudentFormView({
  mode,
  schoolYear,
  structuredLevels,
  initialForm = EMPTY_STUDENT_FORM,
  editingStudentId = null,
  editingEnrollmentId = null,
  onBack,
  onSaved,
}: {
  mode: 'create' | 'edit';
  schoolYear: string;
  structuredLevels: ClassLevelStructured[];
  initialForm?: StudentFormState;
  editingStudentId?: number | null;
  editingEnrollmentId?: number | null;
  onBack: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<StudentFormState>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generatingMatricule, setGeneratingMatricule] = useState(false);
  const [generatingRegNo, setGeneratingRegNo] = useState(false);

  const fillMatricule = async (overwrite = false) => {
    setGeneratingMatricule(true);
    try {
      const next = await nextStudentMatricule();
      setForm((current) => ({
        ...current,
        matricule: overwrite || !current.matricule.trim() ? next : current.matricule,
      }));
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : t('common.generateFailed'),
      );
    } finally {
      setGeneratingMatricule(false);
    }
  };

  const fillRegistrationNo = async (overwrite = false) => {
    setGeneratingRegNo(true);
    try {
      const next = await nextRegistrationNumber(schoolYear);
      setForm((current) => ({
        ...current,
        registration_no:
          overwrite || !current.registration_no.trim()
            ? next
            : current.registration_no,
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
    setFieldErrors({});
    setFormError(null);
    if (mode !== 'create') return;
    void fillMatricule(false);
    void fillRegistrationNo(false);
  }, [initialForm, mode, editingStudentId, schoolYear]);

  const selectableLevels = useMemo(
    () => levelsForSection(structuredLevels, form.section),
    [structuredLevels, form.section],
  );

  const selectedLevel = useMemo(
    () =>
      selectableLevels.find((level) => String(level.id) === form.class_level_id),
    [selectableLevels, form.class_level_id],
  );
  const previewFee = useResolvedClassFee(
    schoolYear,
    form.class_level_id,
    form.section,
  );

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.matricule.trim() || !form.full_name.trim()) {
      errors.general = t('students.requiredError');
    }
    if (mode === 'create' && (!form.section || !form.class_level_id)) {
      errors.enrollment = t('students.enrollmentRequired');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const studentPayload = {
      matricule: form.matricule.trim(),
      full_name: form.full_name.trim(),
      gender: form.gender || null,
      birth_date: form.birth_date || null,
      guardian_name: form.guardian_name || null,
      guardian_phone: form.guardian_phone || null,
      neighborhood: form.neighborhood || null,
    };

    setSubmitting(true);
    try {
      if (mode === 'edit' && editingStudentId) {
        await window.api.students.update(editingStudentId, studentPayload);
        if (editingEnrollmentId && form.class_level_id) {
          await window.api.enrollments.update(editingEnrollmentId, {
            class_level_id: Number(form.class_level_id),
            section: form.section || null,
            registration_no: form.registration_no || null,
          });
        }
        notify.success(t('students.updated'));
      } else {
        await window.api.students.register({
          ...studentPayload,
          school_year: schoolYear,
          class_level_id: Number(form.class_level_id),
          section: form.section as 'Francophone' | 'Anglophone',
          registration_no: form.registration_no || null,
          registration_date: form.registration_date || null,
        });
        notify.success(t('students.registered'));
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
      ? t('students.editStudent')
      : t('students.addStudent');

  return (
    <div className="flex flex-col gap-4">
      <PageBackHeader title={title} onBack={onBack} />
      <Card>
        <CardContent className="p-8">
          <FormShell onSubmit={submit}>
            <FormSection
              icon={User}
              title={t('students.identitySection')}
              description={t('students.identitySectionHelp')}
            >
              <FormRow>
                <FormField
                  stacked
                  icon={Hash}
                  label={t('students.matricule')}
                  htmlFor="student-matricule"
                  required
                  error={fieldErrors.general}
                >
                  {mode === 'create' ? (
                    <GeneratedIdInput
                      id="student-matricule"
                      value={form.matricule}
                      onChange={(matricule) => setForm({ ...form, matricule })}
                      onGenerate={() => fillMatricule(true)}
                      generateLabel={t('common.generate')}
                      generateTitle={t('students.matriculeHint')}
                      generating={generatingMatricule}
                    />
                  ) : (
                    <Input
                      id="student-matricule"
                      value={form.matricule}
                      onChange={(e) =>
                        setForm({ ...form, matricule: e.target.value })
                      }
                    />
                  )}
                </FormField>
                <FormField
                  stacked
                  icon={User}
                  label={t('students.fullName')}
                  htmlFor="student-full-name"
                  required
                >
                  <Input
                    id="student-full-name"
                    value={form.full_name}
                    onChange={(e) =>
                      setForm({ ...form, full_name: e.target.value })
                    }
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField stacked label={t('students.gender')} htmlFor="student-gender">
                  <Select
                    id="student-gender"
                    value={form.gender}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        gender: e.target.value as StudentFormState['gender'],
                      })
                    }
                  >
                    <option value="">{t('common.dash')}</option>
                    <option value="Fille">{t('enum.gender.female')}</option>
                    <option value="Garçon">{t('enum.gender.male')}</option>
                  </Select>
                </FormField>
                <FormField stacked label={t('students.birthDate')} htmlFor="student-birth">
                  <DatePicker
                    id="student-birth"
                    value={form.birth_date}
                    onChange={(birth_date) => setForm({ ...form, birth_date })}
                    placeholder={t('students.birthDate')}
                    monthYearDropdowns
                    startMonth={earliestBirthMonth}
                    endMonth={latestBirthMonth}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField stacked label={t('students.guardian')} htmlFor="student-guardian">
                  <Input
                    id="student-guardian"
                    value={form.guardian_name}
                    onChange={(e) =>
                      setForm({ ...form, guardian_name: e.target.value })
                    }
                  />
                </FormField>
                <FormField
                  stacked
                  icon={Phone}
                  label={t('students.phone')}
                  htmlFor="student-phone"
                >
                  <PhoneInput
                    id="student-phone"
                    value={form.guardian_phone}
                    onChange={(guardian_phone) =>
                      setForm({ ...form, guardian_phone })
                    }
                  />
                </FormField>
              </FormRow>
              <FormField stacked label={t('students.neighborhood')} htmlFor="student-neighborhood">
                <Input
                  id="student-neighborhood"
                  value={form.neighborhood}
                  onChange={(e) =>
                    setForm({ ...form, neighborhood: e.target.value })
                  }
                />
              </FormField>
            </FormSection>

            <FormSection
              icon={GraduationCap}
              title={t('students.enrollmentSection', { year: schoolYear })}
              description={t('students.enrollmentSectionHelp')}
            >
              <FormRow>
                <FormField
                  stacked
                  label={t('enrollments.section')}
                  htmlFor="student-section"
                  required={mode === 'create'}
                  error={fieldErrors.enrollment}
                >
                  <Select
                    id="student-section"
                    value={form.section}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        section: e.target.value as StudentFormState['section'],
                        class_level_id: '',
                      })
                    }
                  >
                    <option value="">{t('common.selectPlaceholder')}</option>
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
                  htmlFor="student-class"
                  required={mode === 'create'}
                >
                  <Select
                    id="student-class"
                    value={form.class_level_id}
                    onChange={(e) =>
                      setForm({ ...form, class_level_id: e.target.value })
                    }
                  >
                    <option value="">{t('common.selectPlaceholder')}</option>
                    {selectableLevels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {labelForSection(level, form.section || null)}
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
                hasClass={Boolean(form.class_level_id)}
              />
              <FormRow>
                <FormField
                  stacked
                  icon={Hash}
                  label={t('enrollments.registrationNo')}
                  htmlFor="student-reg-no"
                >
                  {mode === 'create' ? (
                    <GeneratedIdInput
                      id="student-reg-no"
                      value={form.registration_no}
                      onChange={(registration_no) =>
                        setForm({ ...form, registration_no })
                      }
                      onGenerate={() => fillRegistrationNo(true)}
                      generateLabel={t('common.generate')}
                      generateTitle={t('enrollments.registrationNoHint')}
                      generating={generatingRegNo}
                    />
                  ) : (
                    <Input
                      id="student-reg-no"
                      value={form.registration_no}
                      onChange={(e) =>
                        setForm({ ...form, registration_no: e.target.value })
                      }
                    />
                  )}
                </FormField>
                {mode === 'create' && (
                  <FormField
                    stacked
                    label={t('enrollments.registrationDate')}
                    htmlFor="student-reg-date"
                  >
                    <DatePicker
                      value={form.registration_date}
                      onChange={(registration_date) =>
                        setForm({ ...form, registration_date })
                      }
                      placeholder={t('enrollments.registrationDate')}
                    />
                  </FormField>
                )}
              </FormRow>
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
                {mode === 'edit' ? t('common.save') : t('students.register')}
              </Button>
            </FormActions>
          </FormShell>
        </CardContent>
      </Card>
    </div>
  );
}
