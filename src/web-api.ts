import type { AppApi } from './preload';

export interface WebUser {
  id: number;
  username: string;
  role: 'admin' | 'staff';
}

interface ApiError {
  error?: string;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    if (
      response.status === 401 &&
      !['/api/auth/login', '/api/auth/logout', '/api/auth/me'].includes(url)
    ) {
      window.dispatchEvent(new Event('web-auth-expired'));
    }
    throw new Error(payload.error ?? `Erreur du serveur (${response.status}).`);
  }
  return (await response.json()) as T;
}

export async function readCurrentWebUser(): Promise<WebUser | null> {
  const result = await apiFetch<{ user: WebUser | null }>('/api/auth/me');
  return result.user;
}

export async function loginWebUser(
  username: string,
  password: string,
): Promise<WebUser> {
  const result = await apiFetch<{ user: WebUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return result.user;
}

export async function logoutWebUser(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' });
}

export interface WebUserRecord extends WebUser {
  created_at: string;
  disabled: number;
}

export async function listWebUsers(): Promise<WebUserRecord[]> {
  return apiFetch('/api/admin/users');
}

export async function createWebUser(
  username: string,
  password: string,
  role: 'admin' | 'staff',
): Promise<WebUser> {
  return apiFetch('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({ username, password, role }),
  });
}

export async function disableWebUser(id: number): Promise<void> {
  await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
}

async function rpc<T>(channel: string, args: unknown[] = []): Promise<T> {
  const response = await apiFetch<{ result: T }>('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({ channel, args }),
  });
  return response.result;
}

function chooseFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Impossible de lire ce fichier.'));
    reader.onerror = () =>
      reject(reader.error ?? new Error('Impossible de lire ce fichier.'));
    reader.readAsDataURL(file);
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function createBackup(): Promise<{
  canceled: boolean;
  filePath?: string;
  backedUpAt?: string;
}> {
  const response = await fetch('/api/backup', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) {
    const result = (await response.json()) as ApiError;
    throw new Error(result.error ?? 'Échec de la sauvegarde.');
  }
  const filename =
    /filename="([^"]+)"/i.exec(
      response.headers.get('Content-Disposition') ?? '',
    )?.[1] ?? 'sauvegarde.sqlite';
  downloadBlob(await response.blob(), filename);
  return {
    canceled: false,
    filePath: filename,
    backedUpAt: response.headers.get('X-Backup-Created-At') ?? undefined,
  };
}

async function restoreBackup(): Promise<{
  success: boolean;
  canceled?: boolean;
}> {
  const file = await chooseFile('.sqlite,.db,application/vnd.sqlite3');
  if (!file) return { success: false, canceled: true };
  const response = await fetch('/api/restore', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/vnd.sqlite3' },
    body: file,
  });
  if (!response.ok) {
    const result = (await response.json()) as ApiError;
    throw new Error(result.error ?? 'Échec de la restauration.');
  }
  window.setTimeout(() => window.location.reload(), 1500);
  return (await response.json()) as { success: boolean };
}

function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[\t\r ]*[=+\-@]/.test(text))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(rows: Record<string, unknown>[], filename: string): void {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const csv = [
    keys.map(csvCell).join(';'),
    ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(';')),
  ].join('\r\n');
  downloadBlob(
    new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }),
    filename,
  );
}

function printHtml(
  html: string,
  filename: string,
): { canceled: boolean; filePath?: string } {
  const printWindow = window.open('', '_blank');
  if (!printWindow)
    throw new Error('Autorisez les fenêtres surgissantes pour imprimer.');
  printWindow.addEventListener(
    'load',
    () => {
      printWindow.focus();
      printWindow.print();
    },
    { once: true },
  );
  printWindow.document.open();
  printWindow.document.write(
    html.replace(
      /<head([^>]*)>/i,
      '<head$1><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; font-src data:">',
    ),
  );
  printWindow.document.close();
  return { canceled: false, filePath: filename };
}

function makeApiProxy(path: string[] = []): object {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== 'string' || property === 'then')
          return undefined;
        const nextPath = [...path, property];
        if (nextPath.length < 2) return makeApiProxy(nextPath);

        const channel = `${nextPath[0]}:${nextPath[1]}`;
        if (channel === 'settings:onBrandingUpdated') {
          return (callback: () => void) => {
            let previous: string | undefined;
            const poll = async () => {
              try {
                const current = JSON.stringify(
                  await rpc('settings:getBranding'),
                );
                if (previous !== undefined && previous !== current) callback();
                previous = current;
              } catch {
                // The next poll retries when the server is reachable again.
              }
            };
            void poll();
            const timer = window.setInterval(() => void poll(), 2500);
            return () => {
              window.clearInterval(timer);
            };
          };
        }
        if (channel === 'settings:pickLogo') {
          return async () => {
            const file = await chooseFile('image/png,image/jpeg');
            if (!file) return null;
            const dataUrl = await readFileAsDataUrl(file);
            const result = await apiFetch<{ path: string }>('/api/logo', {
              method: 'POST',
              body: JSON.stringify({ dataUrl }),
            });
            return result.path;
          };
        }
        if (channel === 'system:openExternal') {
          return async (url: string) => {
            if (!['https:', 'mailto:', 'tel:'].includes(new URL(url).protocol))
              return false;
            window.open(url, '_blank', 'noopener,noreferrer');
            return true;
          };
        }
        if (channel === 'system:openLogsFolder') {
          return async () => {
            const result = await rpc<{ tail: string }>(
              'system:getLogTail',
              [1000],
            );
            downloadBlob(
              new Blob([result.tail], { type: 'text/plain;charset=utf-8' }),
              'complex-scolaire-logs.txt',
            );
            return true;
          };
        }
        if (channel === 'system:getLogTail') {
          return async (maxLines?: number) => {
            const result = await rpc<{ tail: string }>(channel, [maxLines]);
            return { path: null, tail: result.tail };
          };
        }
        if (channel === 'backup:createNow') return createBackup;
        if (channel === 'backup:restore') return restoreBackup;
        if (channel === 'expenses:exportExcel') {
          return async (filters = {}) => {
            const rows = await rpc<Record<string, unknown>[]>('expenses:list', [
              filters,
            ]);
            downloadCsv(rows, 'depenses.csv');
            return { canceled: false };
          };
        }
        if (channel === 'treasury:exportExcel') {
          return async (filters = {}) => {
            const rows = await rpc<Record<string, unknown>[]>(
              'treasury:monthlySummary',
              [filters],
            );
            downloadCsv(rows, 'rapport-financier.csv');
            return { canceled: false };
          };
        }
        if (
          channel.startsWith('print:') &&
          channel !== 'print:savePdfFromHtml'
        ) {
          return async (...args: unknown[]) => {
            const htmlChannel: Record<string, string> = {
              'print:studentStatement': 'print:studentStatementHtml',
              'print:paymentReceipt': 'print:paymentReceiptHtml',
              'print:expenseRegister': 'print:expenseRegisterHtml',
              'print:staffPaymentReceipt': 'print:staffPaymentReceiptHtml',
              'print:financialReport': 'print:financialReportHtml',
              'print:classRosterHtml': 'print:classRosterHtml',
              'print:studentStatementHtml': 'print:studentStatementHtml',
              'print:paymentReceiptHtml': 'print:paymentReceiptHtml',
            };
            const target = htmlChannel[channel];
            if (!target) return rpc(channel, args);
            const printWindow = window.open('', '_blank');
            if (!printWindow)
              throw new Error(
                'Autorisez les fenêtres surgissantes pour imprimer.',
              );
            const documentData = await rpc<{
              html: string;
              defaultFileName: string;
            }>(target, args);
            printWindow.addEventListener(
              'load',
              () => {
                printWindow.focus();
                printWindow.print();
              },
              { once: true },
            );
            printWindow.document.open();
            printWindow.document.write(
              documentData.html.replace(
                /<head([^>]*)>/i,
                `<head$1><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">`,
              ),
            );
            printWindow.document.close();
            return { canceled: false, filePath: documentData.defaultFileName };
          };
        }
        if (channel === 'print:savePdfFromHtml') {
          return async (html: string, filename: string) =>
            printHtml(html, filename);
        }

        return (...args: unknown[]) => rpc(channel, args);
      },
    },
  );
}

export function installWebApi(): void {
  Object.defineProperty(window, 'api', {
    configurable: false,
    enumerable: false,
    value: makeApiProxy() as AppApi,
  });
}
