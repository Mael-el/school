import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from './dialog';
import { Button } from './button';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = true,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent
        title={title}
        description={description}
        onClose={onCancel}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={busy}
            >
              {cancelLabel ?? t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant={destructive ? 'destructive' : 'default'}
              onClick={() => void onConfirm()}
              disabled={busy}
            >
              {confirmLabel ?? t('common.deleteConfirm')}
            </Button>
          </>
        }
      >
        <span className="sr-only">{description}</span>
      </DialogContent>
    </Dialog>
  );
}
