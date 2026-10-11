import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt, Save, Wallet } from 'lucide-react';
import type { Expense, ExpenseCategory } from '../lib/types';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { NumberInput } from '../components/ui/number-input';
import { DatePicker } from '../components/ui/date-picker';
import { Card, CardContent } from '../components/ui/card';
import { PageBackHeader } from '../components/ui/page-back-header';
import { SummaryCallout } from '../components/ui/summary-callout';
import { fmtCurrency } from '../lib/format';
import {
  FormActions,
  FormField,
  FormRow,
  FormSection,
  FormShell,
} from '../components/forms';
import { todayIsoDate } from '../lib/dates';
import { translatePaymentMode } from '../lib/i18n-domain';
import { notify } from '../lib/notify';

const PAYMENT_MODES = [
  'Espèces',
  'MTN Mobile Money',
  'Orange Money',
  'Virement bancaire',
  'Chèque',
];

export function ExpenseFormView({
  categories,
  approvalRequired,
  defaultApprover = '',
  editingExpense = null,
  onBack,
  onSaved,
  onCategoryCreated,
}: {
  categories: ExpenseCategory[];
  approvalRequired: boolean;
  defaultApprover?: string;
  /** When set, the form edits this expense instead of creating a new one. */
  editingExpense?: Expense | null;
  onBack: () => void;
  onSaved: () => void | Promise<void>;
  onCategoryCreated: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const isEdit = editingExpense !== null;
  const [expenseDate, setExpenseDate] = useState(
    editingExpense?.expense_date ?? todayIsoDate(),
  );
  const [categoryId, setCategoryId] = useState(
    editingExpense?.category_id != null ? String(editingExpense.category_id) : '',
  );
  const [description, setDescription] = useState(
    editingExpense?.description ?? '',
  );
  const [amount, setAmount] = useState(
    editingExpense ? String(editingExpense.amount) : '',
  );
  const [paymentMode, setPaymentMode] = useState(
    editingExpense?.payment_mode ?? PAYMENT_MODES[0],
  );
  const [supplierName, setSupplierName] = useState(
    editingExpense?.supplier_name ?? '',
  );
  const [receiptRef, setReceiptRef] = useState(
    editingExpense?.receipt_ref ?? '',
  );
  const [approvedBy, setApprovedBy] = useState(
    editingExpense?.approved_by ?? defaultApprover,
  );
  const [note, setNote] = useState(editingExpense?.note ?? '');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit) return;
    setApprovedBy(defaultApprover);
  }, [defaultApprover, isEdit]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!expenseDate || !description || !amount) {
      setError(t('expenses.requiredError'));
      return;
    }
    if (approvalRequired && !approvedBy.trim()) {
      setError(t('expenses.approvalRequiredError'));
      return;
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError(t('expenses.amountError'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        expense_date: expenseDate,
        category_id: categoryId ? Number(categoryId) : null,
        description,
        amount: amountNum,
        payment_mode: paymentMode,
        supplier_name: supplierName || null,
        receipt_ref: receiptRef || null,
        approved_by: approvedBy || null,
        note: note || null,
      };
      if (isEdit && editingExpense) {
        const expense = await window.api.expenses.update(
          editingExpense.id,
          payload,
        );
        notify.success(
          t('expenses.updated', { reference: expense.reference_no }),
        );
      } else {
        const expense = await window.api.expenses.create(payload);
        notify.success(
          t('expenses.saved', { reference: expense.reference_no }),
        );
      }
      await onSaved();
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await window.api.expenseCategories.create({
        name: newCategoryName.trim(),
        description: null,
      });
      setNewCategoryName('');
      await onCategoryCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageBackHeader
        title={
          isEdit
            ? t('expenses.editExpenseTitle', {
                reference: editingExpense?.reference_no,
              })
            : t('expenses.addExpense')
        }
        onBack={onBack}
      />
      <Card>
        <CardContent className="p-8">
          <FormShell onSubmit={submit}>
            <FormSection
              icon={Receipt}
              title={t('expenses.formSection')}
              description={t('expenses.formSectionHelp')}
            >
              <FormRow>
                <FormField
                  stacked
                  label={t('expenses.date')}
                  htmlFor="expense-date"
                  required
                >
                  <DatePicker
                    id="expense-date"
                    value={expenseDate}
                    onChange={setExpenseDate}
                  />
                </FormField>
                <FormField
                  stacked
                  label={t('expenses.category')}
                  htmlFor="expense-category"
                >
                  <Select
                    id="expense-category"
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
                <FormField
                  stacked
                  label={t('expenses.amount')}
                  htmlFor="expense-amount"
                  required
                >
                  <NumberInput
                    id="expense-amount"
                    mode="decimal"
                    value={amount}
                    onChange={setAmount}
                  />
                </FormField>
                <FormField
                  stacked
                  label={t('expenses.paymentMode')}
                  htmlFor="expense-payment-mode"
                >
                  <Select
                    id="expense-payment-mode"
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
              <FormField
                stacked
                label={t('expenses.description')}
                htmlFor="expense-description"
                required
              >
                <Input
                  id="expense-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </FormField>
              {amount.trim() && Number(amount) > 0 ? (
                <SummaryCallout
                  icon={Wallet}
                  variant="ready"
                  title={description.trim() || t('expenses.formSection')}
                  description={
                    categories.find((c) => String(c.id) === categoryId)?.name ??
                    t('expenses.formSectionHelp')
                  }
                  hint={t('expenses.amountPreviewHint')}
                  valueLabel={t('expenses.amountPreviewLabel')}
                  value={fmtCurrency(Number(amount))}
                />
              ) : null}
            </FormSection>

            <FormSection
              icon={Wallet}
              title={t('expenses.paymentSection')}
              description={t('expenses.paymentSectionHelp')}
            >
              <FormRow>
                <FormField
                  stacked
                  label={t('expenses.vendor')}
                  htmlFor="expense-vendor"
                >
                  <Input
                    id="expense-vendor"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                  />
                </FormField>
                <FormField
                  stacked
                  label={t('expenses.attachmentRef')}
                  htmlFor="expense-receipt-ref"
                >
                  <Input
                    id="expense-receipt-ref"
                    value={receiptRef}
                    onChange={(e) => setReceiptRef(e.target.value)}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField
                  stacked
                  label={
                    approvalRequired
                      ? t('expenses.approverRequired')
                      : t('expenses.approvedBy')
                  }
                  htmlFor="expense-approved-by"
                  required={approvalRequired}
                >
                  <Input
                    id="expense-approved-by"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    required={approvalRequired}
                  />
                </FormField>
                <FormField stacked label={t('expenses.note')} htmlFor="expense-note">
                  <Input
                    id="expense-note"
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
                {isEdit ? t('common.save') : t('expenses.submit')}
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Input
                  placeholder={t('expenses.newCategoryPlaceholder')}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="h-9 w-40"
                />
                <Button type="button" variant="ghost" onClick={() => void createCategory()}>
                  {t('expenses.addCategory')}
                </Button>
              </div>
            </FormActions>
          </FormShell>
        </CardContent>
      </Card>
    </div>
  );
}
