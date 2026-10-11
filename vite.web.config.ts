import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { APP_DISPLAY_NAME } from './shared/school-defaults';

function htmlTitlePlugin(): Plugin {
  return {
    name: 'inject-web-app-title',
    transformIndexHtml(html) {
      return html.replace('%APP_TITLE%', APP_DISPLAY_NAME);
    },
  };
}

export default defineConfig({
  plugins: [react(), htmlTitlePlugin()],
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
});
