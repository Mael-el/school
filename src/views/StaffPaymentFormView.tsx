import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, UserCog, Wallet } from 'lucide-react';
import type { Cashier, StaffMember, StaffPayment } from '../lib/types';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { NumberInput } from '../components/ui/number-input';
import { DatePicker } from '../components/ui/date-picker';
import { MonthPicker } from '../components/ui/month-picker';
import { Card, CardContent } from '../components/ui/card';
import { PageBackHeader } from '../components/ui/page-back-header';
import { StaffSalaryPreview } from '../components/ui/staff-salary-preview';
import {
  FormActions,
  FormField,
  FormRow,
  FormSection,
  FormShell,
} from '../components/forms';
import { todayIsoDate, todayIsoMonth } from '../lib/dates';
import {
  translatePaymentMode,
  translateStaffPaymentType,
} from '../lib/i18n-domain';
import { notify } from '../lib/notify';

const PAYMENT_MODES = [
  'Espèces',
  'MTN Mobile Money',
  'Orange Money',
  'Virement bancaire',
  'Chèque',
];

const PAYMENT_TYPES: StaffPayment['payment_type'][] = [
  'Salaire',
  'Avance',
  'Prime',
  'Autre',
];

export function StaffPaymentFormView({
  staffList,
  cashiers,
  initialStaffId = '',
  onBack,
  onSaved,
}: {
  staffList: StaffMember[];
  cashiers: Cashier[];
  initialStaffId?: string;
  onBack: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [selectedStaffId, setSelectedStaffId] = useState(initialStaffId);
  const [paymentDate, setPaymentDate] = useState(todayIsoDate());
  const [payPeriod, setPayPeriod] = useState(todayIsoMonth());
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] =
    useState<StaffPayment['payment_type']>('Salaire');
  const [paymentMode, setPaymentMode] = useState(PAYMENT_MODES[0]);
  const [transactionRef, setTransactionRef] = useState('');
  const [cashierId, setCashierId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSelectedStaffId(initialStaffId);
  }, [initialStaffId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedStaffId || !paymentDate || !payPeriod || !amount) {
      setError(t('staff.paymentRequiredError'));
      return;
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError(t('staff.amountError'));
      return;
    }
    setSubmitting(true);
    try {
      const payment = await window.api.staff.createPayment({
        staff_id: Number(selectedStaffId),
        payment_date: paymentDate,
        pay_period: payPeriod,
        amount: amountNum,
        payment_type: paymentType,
        payment_mode: paymentMode,
        transaction_ref: transactionRef || null,
        cashier_id: cashierId ? Number(cashierId) : null,
        note: note || null,
      });
      notify.success(
        t('staff.paymentSaved', { receipt: payment.receipt_no }),
      );
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
      <PageBackHeader title={t('staff.addPayment')} onBack={onBack} />
      <Card>
        <CardContent className="p-8">
          <FormShell onSubmit={submit}>
            <FormSection
              icon={Wallet}
              title={t('staff.paymentFormSection')}
              description={t('staff.paymentFormSectionHelp')}
            >
              <FormField
                stacked
                icon={UserCog}
                label={t('staff.employee')}
                htmlFor="staff-payment-employee"
                required
              >
                <Select
                  id="staff-payment-employee"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                >
                  <option value="">{t('common.selectPlaceholder')}</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.staff_no})
                    </option>
                  ))}
                </Select>
              </FormField>
              <StaffSalaryPreview
                member={staffList.find((s) => String(s.id) === selectedStaffId)}
                showSalary
              />
              <FormRow>
                <FormField
                  stacked
                  label={t('staff.date')}
                  htmlFor="staff-payment-date"
                  required
                >
                  <DatePicker
                    id="staff-payment-date"
                    value={paymentDate}
                    onChange={setPaymentDate}
                  />
                </FormField>
                <FormField
                  stacked
                  label={t('staff.period')}
                  htmlFor="staff-pay-period"
                  required
                >
                  <MonthPicker
                    id="staff-pay-period"
                    value={payPeriod}
                    onChange={setPayPeriod}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField
                  stacked
                  label={t('staff.amount')}
                  htmlFor="staff-payment-amount"
                  required
                >
                  <NumberInput
                    id="staff-payment-amount"
                    mode="decimal"
                    value={amount}
                    onChange={setAmount}
                  />
                </FormField>
                <FormField stacked label={t('staff.type')} htmlFor="staff-payment-type">
                  <Select
                    id="staff-payment-type"
                    value={paymentType}
                    onChange={(e) =>
                      setPaymentType(
                        e.target.value as StaffPayment['payment_type'],
                      )
                    }
                  >
                    {PAYMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {translateStaffPaymentType(type, t)}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </FormRow>
              <FormRow>
                <FormField
                  stacked
                  label={t('staff.paymentMode')}
                  htmlFor="staff-payment-mode"
                >
                  <Select
                    id="staff-payment-mode"
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
                <FormField stacked label={t('staff.cashier')} htmlFor="staff-cashier">
                  <Select
                    id="staff-cashier"
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
              <FormRow>
                <FormField
                  stacked
                  label={t('staff.transactionRef')}
                  htmlFor="staff-transaction-ref"
                >
                  <Input
                    id="staff-transaction-ref"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                  />
                </FormField>
                <FormField stacked label={t('staff.note')} htmlFor="staff-payment-note">
                  <Input
                    id="staff-payment-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
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
                <Save className="mr-2 h-4 w-4" />
                {t('staff.submitPayment')}
              </Button>
            </FormActions>
          </FormShell>
        </CardContent>
      </Card>
    </div>
  );
}
