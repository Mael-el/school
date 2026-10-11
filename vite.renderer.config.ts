import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { APP_DISPLAY_NAME } from './shared/school-defaults';

// Injects the generic app name into index.html at build time so it is not
// hardcoded there — the school-specific window title is applied later at
// runtime via `win.setTitle()` (see src/main/services/branding.ts).
function htmlTitlePlugin(): Plugin {
  return {
    name: 'inject-app-title',
    transformIndexHtml(html) {
      return html.replace('%APP_TITLE%', APP_DISPLAY_NAME);
    },
  };
}

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react(), htmlTitlePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Electron Forge picks the next free port if this one is taken, but stale
    // dev sessions often leave many Vite servers running — prefer a stable port
    // and let Forge fall back when needed.
    port: 5173,
    strictPort: false,
  },
});
