import { useCallback, useState } from 'react';
import { CancelReasonDialog } from '../components/ui/cancel-reason-dialog';

interface PendingCancel {
  title: string;
  resolve: (reason: string | null) => void;
}

/** Prompts for a cancellation reason in a modal overlay. */
export function useCancelReason() {
  const [pending, setPending] = useState<PendingCancel | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = useCallback(
    (title: string) =>
      new Promise<string | null>((resolve) => {
        setPending({ title, resolve });
      }),
    [],
  );

  const close = useCallback((reason: string | null) => {
    setPending((current) => {
      current?.resolve(reason);
      return null;
    });
    setBusy(false);
  }, []);

  const dialog = pending ? (
    <CancelReasonDialog
      open
      title={pending.title}
      busy={busy}
      onCancel={() => close(null)}
      onConfirm={async (reason) => {
        setBusy(true);
        close(reason);
      }}
    />
  ) : null;

  return { ask, dialog, isOpen: pending !== null };
}
