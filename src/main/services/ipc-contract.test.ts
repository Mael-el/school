// Guards the renderer ↔ main IPC contract. Three lists must stay in sync:
//   1. channels the renderer invokes (preload.ts, ipcRenderer.invoke)
//   2. channels the main process handles (ipc.ts, ipcMain.handle)
//   3. the shared IPC_CHANNELS allowlist (shared/ipc-channels.ts)
// A channel present in one list but not the others surfaces at runtime as
// "No handler registered for '<channel>'" — this test catches it at CI time.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';

const APP_ROOT = path.resolve(__dirname, '../../..');

function extractChannels(source: string, pattern: RegExp): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(pattern)) {
    found.add(match[1]);
  }
  return [...found].sort();
}

const preloadSource = readFileSync(
  path.join(APP_ROOT, 'src/preload.ts'),
  'utf8',
);
const ipcSource = readFileSync(
  path.join(APP_ROOT, 'src/main/services/ipc.ts'),
  'utf8',
);

const invoked = extractChannels(
  preloadSource,
  /ipcRenderer\.invoke\(\s*'([^']+)'/g,
);
const handled = extractChannels(
  ipcSource,
  /ipcMain\.handle\(\s*\n?\s*'([^']+)'/g,
);
const allowlist = [...IPC_CHANNELS].sort();

describe('IPC contract', () => {
  it('every channel invoked by the renderer has a main-process handler', () => {
    const missingHandlers = invoked.filter((c) => !handled.includes(c));
    expect(missingHandlers).toEqual([]);
  });

  it('every registered handler is reachable from the renderer', () => {
    const unreachable = handled.filter((c) => !invoked.includes(c));
    expect(unreachable).toEqual([]);
  });

  it('the shared IPC_CHANNELS allowlist matches the registered handlers', () => {
    expect(allowlist).toEqual(handled);
  });

  it('extraction found a plausible number of channels', () => {
    // Guards against the regexes silently matching nothing after a refactor.
    expect(invoked.length).toBeGreaterThan(50);
  });
});
