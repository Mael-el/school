import { defineConfig } from 'vite';
import { pluginElectronRestart } from './vite.dev-restart.plugin';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [pluginElectronRestart('main')],
  build: {
    rollupOptions: {
      // better-sqlite3 ships a native .node binding that can't be bundled
      // by Rollup — keep it as a real require() at runtime instead.
      external: ['better-sqlite3'],
    },
  },
});
