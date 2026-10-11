import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from './dialog';
import { Button } from './button';
import { Input } from './input';
import { FormField } from '../forms';

export function CancelReasonDialog({
  open,
  title,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = inputRef.current?.value.trim() ?? '';
    if (!value) {
      setError(t('ui.cancelDialog.requiredError'));
      return;
    }
    setError('');
    await onConfirm(value);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent
        title={title}
        description={t('ui.cancelDialog.placeholder')}
        onClose={onCancel}
        footer={
          <>
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="cancel-reason-form"
              variant="destructive"
              disabled={busy}
            >
              {t('ui.cancelDialog.confirm')}
            </Button>
          </>
        }
      >
        <form id="cancel-reason-form" onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
          <FormField
            stacked
            label={t('ui.cancelDialog.placeholder')}
            htmlFor="cancel-reason-input"
            error={error || undefined}
          >
            <Input
              id="cancel-reason-input"
              ref={inputRef}
              placeholder={t('ui.cancelDialog.placeholder')}
              autoFocus
              disabled={busy}
            />
          </FormField>
        </form>
      </DialogContent>
    </Dialog>
  );
}
