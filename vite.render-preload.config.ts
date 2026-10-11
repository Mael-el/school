import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

const nodeBuiltins = [...builtinModules, ...builtinModules.map((name) => `node:${name}`)];

export default defineConfig({
  build: {
    target: 'node22',
    outDir: '.vite/build',
    emptyOutDir: false,
    lib: {
      entry: 'src/preload.ts',
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: {
      external: [...nodeBuiltins, 'electron', 'electron/renderer'],
    },
  },
});
