import { notify } from './notify';
import type { PrintResult } from '../main/services/ipc';

const RESTART_HINT =
  'Impression indisponible — relancez l’application (npm run restart dans app/).';

export function isMissingIpcHandlerError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('No handler registered');
}

/** User-facing message for IPC print failures (missing handler vs other errors). */
export function printErrorMessage(err: unknown): string {
  if (isMissingIpcHandlerError(err)) return RESTART_HINT;
  return err instanceof Error ? err.message : String(err);
}

/** Invoke a print IPC call with consistent toast + error messaging. */
export async function invokePrint(
  action: () => Promise<PrintResult>,
  successMessage = 'PDF généré',
): Promise<PrintResult | null> {
  try {
    const result = await action();
    if (!result.canceled) {
      notify.success(successMessage);
    }
    return result;
  } catch (err) {
    notify.error(printErrorMessage(err));
    throw err;
  }
}
