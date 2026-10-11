import { defineConfig } from '@playwright/test';

// E2E tests drive the packaged Electron main process directly (via
// playwright-core's `_electron` API — see e2e/electron.ts), not a browser,
// so most of the usual Playwright browser config (projects, baseURL, etc.)
// does not apply here.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
});
