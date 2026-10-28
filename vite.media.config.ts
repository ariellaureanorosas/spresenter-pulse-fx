import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Build da mídia do README. Empacota o gerador de overlay (o mesmo usado em
// produção) como IIFE para ser injetado em uma página headless pelo Playwright.
// A saída fica em `.media/` (ignorada pelo git), junto das capturas temporárias.
export default defineConfig({
  build: {
    outDir: '.media',
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, 'scripts/media-entry.ts'),
      formats: ['iife'],
      name: 'PFXMedia',
      fileName: () => 'overlay.js',
    },
    target: 'es2020',
    minify: false,
  },
});
