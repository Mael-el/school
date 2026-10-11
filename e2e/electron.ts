import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Launches the packaged main process (built by `electron-forge package`/`make`
 * into `.vite/build/main.js`) against a throwaway `--user-data-dir`, so E2E
 * runs never touch the developer's real SQLite database.
 *
 * Run `npm run package` (or `npm run make`) at least once before running the
 * E2E suite, otherwise `.vite/build/main.js` won't exist yet.
 */
export async function launchApp(): Promise<{
  app: ElectronApplication;
  window: Page;
  userDataDir: string;
}> {
  const mainEntry = path.join(__dirname, '..', '.vite', 'build', 'main.js');
  if (!fs.existsSync(mainEntry)) {
    throw new Error(
      `Missing ${mainEntry} — run "npm run package" (or "npm run make") before the E2E suite.`,
    );
  }

  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'complex-scolaire-e2e-'),
  );

  // Drop ELECTRON_RUN_AS_NODE which leaks in when the tests are started from
  // an Electron-based terminal (VS Code, Cursor…): with it set, the Electron
  // binary boots as plain Node and rejects --remote-debugging-port.
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key === 'ELECTRON_RUN_AS_NODE' || value === undefined) continue;
    env[key] = value;
  }

  const app = await electron.launch({
    args: [mainEntry, `--user-data-dir=${userDataDir}`],
    env,
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  return { app, window, userDataDir };
}

export async function closeApp(
  app: ElectronApplication,
  userDataDir: string,
): Promise<void> {
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
