import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Logic thread build. Produces a single IIFE (no DOM) that the host evaluates
// inside a restricted vm context, where the `spresenter` global is injected.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // keep dist/ui produced by the other build
    lib: {
      entry: resolve(import.meta.dirname, 'src/code.ts'),
      formats: ['iife'],
      name: 'SpresenterPlugin',
      fileName: () => 'code.js',
    },
    target: 'es2020',
    minify: false,
  },
});
