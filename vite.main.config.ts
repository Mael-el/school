import { defineConfig } from 'vite';
import { pluginElectronRestart } from './vite.dev-restart.plugin';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [pluginElectronRestart('main')],
  build: {
    rollupOptions: {
      // Native modules and pg's circular CommonJS exports must remain runtime
      // dependencies rather than being bundled by Rollup.
      external: ['better-sqlite3', 'pg'],
    },
  },
});
