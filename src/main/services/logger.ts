// Persistent main-process error log. Console output disappears once the app
// is packaged, so errors are also appended to <userData>/logs/main.log with
// simple size-based rotation (main.log → main.log.1). The Settings
// "Diagnostic" panel exposes the folder to the user.
import fs from 'node:fs';
import path from 'node:path';

const MAX_LOG_BYTES = 1024 * 1024; // 1 MB before rotation

let logFilePath: string | null = null;

function formatEntry(level: string, parts: unknown[]): string {
  const text = parts
    .map((part) => {
      if (part instanceof Error) return part.stack ?? part.message;
      if (typeof part === 'string') return part;
      try {
        return JSON.stringify(part);
      } catch {
        return String(part);
      }
    })
    .join(' ');
  return `${new Date().toISOString()} [${level}] ${text}\n`;
}

function rotateIfNeeded(filePath: string): void {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size < MAX_LOG_BYTES) return;
    const rotated = `${filePath}.1`;
    fs.rmSync(rotated, { force: true });
    fs.renameSync(filePath, rotated);
  } catch {
    // File does not exist yet or rotation failed — appending still works.
  }
}

export function appendLog(level: 'ERROR' | 'WARN' | 'INFO', ...parts: unknown[]): void {
  if (!logFilePath) return;
  try {
    rotateIfNeeded(logFilePath);
    fs.appendFileSync(logFilePath, formatEntry(level, parts));
  } catch {
    // Never let logging take the app down.
  }
}

export function getLogFilePath(): string | null {
  return logFilePath;
}

/** Last `maxLines` lines of the log (for the Diagnostic panel). */
export function readLogTail(maxLines = 200): string {
  if (!logFilePath) return '';
  try {
    const content = fs.readFileSync(logFilePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-maxLines).join('\n');
  } catch {
    return '';
  }
}

/**
 * Enables file logging and mirrors console.error / console.warn plus
 * process-level crash events into the log file. Call once at startup,
 * after Electron knows its userData path.
 */
export function initFileLogging(userDataPath: string): void {
  try {
    const logsDir = path.join(userDataPath, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    logFilePath = path.join(logsDir, 'main.log');
  } catch {
    logFilePath = null;
    return;
  }

  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    appendLog('ERROR', ...args);
    originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    appendLog('WARN', ...args);
    originalWarn(...args);
  };

  appendLog('INFO', '--- main process started ---');
}
