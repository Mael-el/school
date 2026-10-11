import type { Plugin } from 'vite';

/**
 * Restarts the Electron app when a main/preload bundle rebuilds during
 * `electron-forge start`. Forge's built-in hook is disabled upstream.
 */
export function pluginElectronRestart(target: 'main' | 'preload'): Plugin {
  let isServe = false;
  let buildsCompleted = 0;

  return {
    name: `complex-scolaire:electron-restart:${target}`,
    configResolved(config) {
      isServe = config.command === 'serve';
    },
    closeBundle() {
      if (!isServe) return;

      buildsCompleted += 1;
      // Skip the initial dev build — Electron is not running yet.
      if (buildsCompleted <= 1) return;

      setTimeout(() => {
        if (process.stdin.isTTY) {
          process.stdin.write('rs\n');
        } else {
          process.stdin.emit('data', 'rs\n');
        }
      }, 50);
    },
  };
}
