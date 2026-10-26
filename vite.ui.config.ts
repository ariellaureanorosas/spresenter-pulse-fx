import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// A versão exibida no painel vem do manifest.json — fonte única. O valor é
// substituído em tempo de build; `src/ui/version.ts` tem fallback para testes.
const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'manifest.json'), 'utf8'),
) as { version: string };

// UI thread build. A small React app rendered inside a sandboxed iframe.
// `base: './'` keeps asset URLs relative so the host can serve the build under
// /plugins/<id>/ui/.
export default defineConfig({
  root: resolve(import.meta.dirname, 'src/ui'),
  base: './',
  plugins: [react(), tailwindcss()],
  define: {
    __PLUGIN_VERSION__: JSON.stringify(manifest.version),
  },
  build: {
    outDir: resolve(import.meta.dirname, 'dist/ui'),
    emptyOutDir: true,
  },
});
