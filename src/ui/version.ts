// A versão é injetada no build da UI por `vite.ui.config.ts`, lida de
// `manifest.json`. Fora do build (testes, editor) o fallback evita quebrar.
declare const __PLUGIN_VERSION__: string;

export const PLUGIN_VERSION =
  typeof __PLUGIN_VERSION__ === 'string' ? __PLUGIN_VERSION__ : '0.0.0-dev';
