import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// UI thread build. A small React app rendered inside a sandboxed iframe.
// `base: './'` keeps asset URLs relative so the host can serve the build under
// /plugins/<id>/ui/.
export default defineConfig({
  root: resolve(import.meta.dirname, 'src/ui'),
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist/ui'),
    emptyOutDir: true,
  },
});
