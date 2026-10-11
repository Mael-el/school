import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, User, Wallet } from 'lucide-react';
import type {
  Cashier,
  EnrollmentBalance,
  PaymentCategory,
} from '../lib/types';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { NumberInput } from '../components/ui/number-input';
import { DatePicker } from '../components/ui/date-picker';
import { Card, CardContent } from '../components/ui/card';
import { Combobox } from '../components/ui/combobox';
import { StudentBalancePreview } from '../components/ui/student-balance-preview';
import { PageBackHeader } from '../components/ui/page-back-header';
import {
  FormActions,
  FormField,
  FormRow,
  FormSection,
  FormShell,
} from '../components/forms';
import { todayIsoDate } from '../lib/dates';
import { fmtCurrency } from '../lib/format';
import {
  translatePaymentMode,
  translateTerm,
} from '../lib/i18n-domain';
import { notify } from '../lib/notify';

const PAYMENT_MODES = [
  'Espèces',
  'MTN Mobile Money',
  'Orange Money',
  'Virement bancaire',
  'Chèque',
];

const TERM_VALUES = [
  '1er trimestre',
  '2e trimestre',
  '3e trimestre',
] as const;

export function PaymentFormView({
  balances,
  categories,
  cashiers,
  initialEnrollmentId = '',
  onBack,
  onSaved,
}: {
  balances: EnrollmentBalance[];
  categories: PaymentCategory[];
  cashiers: Cashier[];
  initialEnrollmentId?: string;
  onBack: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [enrollmentId, setEnrollmentId] = useState(initialEnrollmentId);
  const [paymentDate, setPaymentDate] = useState(todayIsoDate());
  const [categoryId, setCategoryId] = useState('');
  const [term, setTerm] = useState('');
  const [installmentNo, setInstallmentNo] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState(PAYMENT_MODES[0]);
  const [transactionRef, setTransactionRef] = useState('');
  const [cashierId, setCashierId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setEnrollmentId(initialEnrollmentId);
  }, [initialEnrollmentId]);

  const selectedBalance = balances.find(
    (b) => String(b.enrollment_id) === enrollmentId,
  );

  const enrollmentOptions = useMemo(
    () =>
      balances.map((b) => ({
        value: String(b.enrollment_id),
        label: `${b.full_name} (${b.matricule}) — ${b.class_name} — ${fmtCurrency(b.balance)}`,
        keywords: `${b.full_name} ${b.matricule} ${b.class_name}`,
      })),
    [balances],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!enrollmentId || !paymentDate || !amount) {
      setError(t('payments.requiredError'));
      return;
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError(t('payments.amountError'));
      return;
    }
    setSubmitting(true);
    try {
      const payment = await window.api.payments.create({
        enrollment_id: Number(enrollmentId),
        payment_date: paymentDate,
        category_id: categoryId ? Number(categoryId) : null,
        term: (term || null) as
          | '1er trimestre'
          | '2e trimestre'
          | '3e trimestre'
          | null,
        installment_no: installmentNo ? Number(installmentNo) : null,
        amount: amountNum,
        payment_mode: paymentMode,
        transaction_ref: transactionRef || null,
        cashier_id: cashierId ? Number(cashierId) : null,
        note: note || null,
      });
      notify.success(t('payments.saved', { receipt: payment.receipt_no }));
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
      <PageBackHeader title={t('payments.addPayment')} onBack={onBack} />
      <Card>
        <CardContent className="p-8">
          <FormShell onSubmit={submit}>
            <FormSection
              icon={User}
              title={t('payments.enrollmentSection')}
              description={t('payments.enrollmentSectionHelp')}
            >
              <FormField
                stacked
                label={t('payments.enrollment')}
                htmlFor="payment-enrollment"
                required
              >
                <Combobox
                  options={enrollmentOptions}
                  value={enrollmentId}
                  onChange={setEnrollmentId}
                  placeholder={t('common.selectPlaceholder')}
                  searchPlaceholder={t('students.searchPlaceholder')}
                  emptyLabel={t('enrollments.empty')}
                />
              </FormField>
              <StudentBalancePreview balance={selectedBalance} />
            </FormSection>

            <FormSection
              icon={Wallet}
              title={t('payments.detailsSection')}
              description={t('payments.detailsSectionHelp')}
            >
              <FormRow>
                <FormField stacked label={t('payments.date')} htmlFor="payment-date" required>
                  <DatePicker
                    id="payment-date"
                    value={paymentDate}
                    onChange={setPaymentDate}
                  />
                </FormField>
                <FormField stacked label={t('payments.category')} htmlFor="payment-category">
                  <Select
                    id="payment-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">{t('common.dash')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </FormRow>
              <FormRow>
                <FormField stacked label={t('payments.term')} htmlFor="payment-term">
                  <Select
                    id="payment-term"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  >
                    <option value="">{t('common.dash')}</option>
                    {TERM_VALUES.map((termValue) => (
                      <option key={termValue} value={termValue}>
                        {translateTerm(termValue, t)}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  stacked
                  label={t('payments.installmentNo')}
                  htmlFor="payment-installment"
                >
                  <NumberInput
                    id="payment-installment"
                    mode="integer"
                    value={installmentNo}
                    onChange={setInstallmentNo}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField stacked label={t('payments.amount')} htmlFor="payment-amount" required>
                  <NumberInput
                    id="payment-amount"
                    mode="decimal"
                    value={amount}
                    onChange={setAmount}
                  />
                </FormField>
                <FormField stacked label={t('payments.paymentMode')} htmlFor="payment-mode">
                  <Select
                    id="payment-mode"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    {PAYMENT_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {translatePaymentMode(mode, t)}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </FormRow>
              <FormRow>
                <FormField
                  stacked
                  label={t('payments.transactionRef')}
                  htmlFor="payment-transaction-ref"
                >
                  <Input
                    id="payment-transaction-ref"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                  />
                </FormField>
                <FormField stacked label={t('payments.cashier')} htmlFor="payment-cashier">
                  <Select
                    id="payment-cashier"
                    value={cashierId}
                    onChange={(e) => setCashierId(e.target.value)}
                  >
                    <option value="">{t('common.dash')}</option>
                    {cashiers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </FormRow>
              <FormField stacked label={t('payments.note')} htmlFor="payment-note">
                <Input
                  id="payment-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </FormField>
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
                <Save className="mr-2 h-4 w-4" />
                {t('payments.submit')}
              </Button>
            </FormActions>
          </FormShell>
        </CardContent>
      </Card>
    </div>
  );
}
