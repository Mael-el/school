import { useCallback, useState } from 'react';
import { ConfirmDialog } from '../components/ui/confirm-dialog';

export interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmDialogOptions {
  resolve: (confirmed: boolean) => void;
}

/** Promise-based confirmation modal — stays on the current page. */
export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = useCallback(
    (options: ConfirmDialogOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  const close = useCallback((confirmed: boolean) => {
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
    setBusy(false);
  }, []);

  const dialog = pending ? (
    <ConfirmDialog
      open
      title={pending.title}
      description={pending.description}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      destructive={pending.destructive}
      busy={busy}
      onCancel={() => close(false)}
      onConfirm={async () => {
        setBusy(true);
        close(true);
      }}
    />
  ) : null;

  return { ask, dialog };
}
