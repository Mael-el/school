// After operations that rewrite app-wide settings (fixture load, config
// wipe) we reload the window so every screen restarts from fresh state.
// The success toast would be lost in the reload, so it is parked in
// sessionStorage and shown once the new window boots.
import { notify } from './notify';

const PENDING_TOAST_KEY = 'suivi-frais.pendingReloadToast';

export function scheduleReloadToast(message: string): void {
  try {
    sessionStorage.setItem(PENDING_TOAST_KEY, message);
  } catch {
    // Storage unavailable — the reload still happens, only the toast is lost.
  }
}

export function consumePendingReloadToast(): void {
  try {
    const message = sessionStorage.getItem(PENDING_TOAST_KEY);
    if (!message) return;
    sessionStorage.removeItem(PENDING_TOAST_KEY);
    notify.success(message);
  } catch {
    // Ignore storage errors.
  }
}
