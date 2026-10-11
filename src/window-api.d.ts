// Ambient typing for the contextBridge API exposed by preload.ts, so the
// renderer can call `window.api.*` with type checking.
import type { AppApi } from './preload';

declare global {
  interface Window {
    api: AppApi;
    webUserRole?: 'admin' | 'staff';
  }
}

export {};
