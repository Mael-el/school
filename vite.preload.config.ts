import { defineConfig } from 'vite';
import { pluginElectronRestart } from './vite.dev-restart.plugin';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [pluginElectronRestart('preload')],
});
