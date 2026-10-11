import { app, BrowserWindow, screen } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { createDatabase, type AppDatabase } from './main/db/connection';
import { registerIpcHandlers } from './main/services/ipc';
import { getSchoolBranding } from './main/services/branding';
import { SettingsService } from './main/services/SettingsService';
import { BackupService } from './main/services/BackupService';
import { initFileLogging } from './main/services/logger';
import { startWebServer } from './main/services/web-server';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Prevent multiple dev instances (common cause of SQLite lock + port conflicts).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let appDatabase: AppDatabase | null = null;
let isQuitting = false;

// App/window icon. `app.getAppPath()` is unreliable here (it resolves
// differently depending on whether Electron is launched via
// `electron-forge start`, a raw `electron .vite/build/main.js` invocation,
// or a packaged app), and the raw src/assets/logo.png isn't copied into the
// Vite main-process build output. Instead resolve relative to this bundled
// file's own location (`.vite/build/main.js` both in dev and unpacked
// builds), falling back to the `extraResource`-bundled copy
// (`assets/icons/icon.png`, see forge.config.ts) once packaged.
const appIconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.png')
  : path.join(__dirname, '../../assets/icons/icon.png');

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'complex-scolaire.sqlite');
}

function ipcRuntime() {
  return {
    getMainWindow: () => mainWindow,
    dbPath: getDbPath(),
    userDataPath: app.getPath('userData'),
    closeDatabase,
  };
}

function closeDatabase(): void {
  if (!appDatabase) return;
  try {
    void appDatabase.close();
  } catch (err) {
    console.error('[main] Failed to close SQLite:', err);
  } finally {
    appDatabase = null;
  }
}

async function ensureDatabase(): Promise<AppDatabase> {
  if (appDatabase) return appDatabase;

  appDatabase = await createDatabase(getDbPath());
  return appDatabase;
}

function destroyMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = null;
    return;
  }
  mainWindow.close();
  mainWindow = null;
}

function ensureIpcHandlers(): void {
  if (appDatabase) {
    registerIpcHandlers(appDatabase.db, ipcRuntime());
    return;
  }

  void ensureDatabase()
    .then(({ db }) => {
      registerIpcHandlers(db, ipcRuntime());
    })
    .catch((err) => {
      console.error('[main] Failed to register IPC handlers:', err);
    });
}

const createWindow = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 960,
    minHeight: 600,
    icon: appIconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Security baseline (see docs/electron-app-plan.md section 2) :
      // isolation stricte du renderer, pas d'accès direct à Node.js,
      // et sandbox natif Chromium activé.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });

  // IPC lives in the main process and survives renderer reloads.
  // Do not call registerIpcHandlers again here — ipcMain.handle throws if
  // the same channel is bound twice, which takes the app down on first load.
  mainWindow.webContents.on('did-finish-load', () => {
    if (!appDatabase) ensureIpcHandlers();
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`[main] Renderer failed to load (${code}): ${description}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main] Renderer process gone:', details.reason);
    if (!isQuitting && details.reason === 'crashed') {
      destroyMainWindow();
      void bootstrap();
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // DevTools only in development — keeping them always open slows reloads and
  // makes hot-update debugging noisier than it needs to be.
  if (!app.isPackaged && process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

async function applyWindowTitle(): Promise<void> {
  if (!appDatabase || !mainWindow || mainWindow.isDestroyed()) return;
  const { windowTitle } = await getSchoolBranding(appDatabase.db);
  mainWindow.setTitle(windowTitle);
}

async function bootstrap(): Promise<void> {
  initFileLogging(app.getPath('userData'));

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(appIconPath);
  }

  const database = await ensureDatabase();
  const { db } = database;
  registerIpcHandlers(db, ipcRuntime());

  if (process.env.WEB_SERVER === '1') {
    await startWebServer(database);
    return;
  }

  const settings = new SettingsService(db);
  const backup = new BackupService(db, getDbPath(), settings);
  try {
    await backup.runAutoBackupIfDue(app.getPath('userData'));
  } catch (err) {
    console.error('[main] Auto-backup failed:', err);
  }

  createWindow();
  await applyWindowTitle();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    void bootstrap();
  }
});

app.on('ready', () => {
  void bootstrap().catch((err) => {
    console.error('[main] Startup failed:', err);
    closeDatabase();
    app.quit();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  closeDatabase();
});

app.on('window-all-closed', () => {
  if (process.env.WEB_SERVER !== '1' && process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void bootstrap().catch((err) => {
      console.error('[main] Reactivation failed:', err);
    });
  }
});

process.on('SIGINT', () => {
  isQuitting = true;
  app.quit();
});

process.on('SIGTERM', () => {
  isQuitting = true;
  app.quit();
});

process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled rejection:', reason);
});
