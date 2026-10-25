import { normalizeParams, transparentColor } from './params';
import type { FxParams } from './types';

function sanitizeToken(raw: string): string {
  const value = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  return (value || 'fx').slice(0, 48);
}

function cssNumber(value: number, decimals = 2): string {
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
}

function geometryCss(params: FxParams): string {
  if (params.target === 'full') {
    return `background:${params.color};`;
  }

  if (params.target === 'vignette') {
    if (params.thickness <= 0) return 'background:transparent;';
    const inner = Math.max(0, 100 - params.thickness);
    const room = Math.max(0, 100 - inner);
    const feather = Math.max(0.5, Math.min(room || 0.5, (params.softness / 100) * Math.max(6, room)));
    const solid = Math.min(100, inner + feather);
    const clear = transparentColor(params.color);
    return [
      'background:transparent;',
      `background-image:radial-gradient(ellipse at center, ${clear} 0%, ${clear} ${cssNumber(inner)}%, `,
      `${params.color} ${cssNumber(solid)}%, ${params.color} 100%);`,
    ].join('');
  }

  // Moldura: sombra interna com espessura (spread) e suavização (blur).
  if (params.thickness <= 0) return 'background:transparent;';
  const spread = (params.thickness / 100) * 7.5;
  const blur = (params.softness / 100) * 7.5 + 0.15;
  return [
    'background:transparent;',
    `box-shadow:inset 0 0 ${cssNumber(blur)}vmin ${cssNumber(spread)}vmin ${params.color};`,
  ].join('');
}

function animationCss(
  params: FxParams,
  animationName: string,
): { animation: string; keyframes: string } {
  const peak = cssNumber(Math.min(1, Math.max(0, params.intensity / 100)), 3);

  if (params.mode === 'hit') {
    return {
      animation: `animation:${animationName} ${Math.round(params.decayMs)}ms cubic-bezier(.12,.74,.3,1) 0ms 1 normal forwards;`,
      keyframes: `@keyframes ${animationName}{0%{opacity:${peak};}100%{opacity:0;}}`,
    };
  }

  const cycle = 1000 / params.frequencyHz;

  if (params.mode === 'strobe') {
    const on = Math.min(95, Math.max(5, params.flashWidth));
    return {
      animation: `animation:${animationName} ${cssNumber(cycle, 3)}ms steps(1, end) 0ms infinite normal none;`,
      keyframes: `@keyframes ${animationName}{0%{opacity:${peak};}${cssNumber(
        on,
        1,
      )}%{opacity:0;}100%{opacity:0;}}`,
    };
  }

  // Um ciclo completo (0 → pico → 0) por período. Usar `alternate` com metade
  // do período faria a respiração ter metade da frequência pedida.
  return {
    animation: `animation:${animationName} ${cssNumber(cycle, 3)}ms ease-in-out 0ms infinite normal none;`,
    keyframes: `@keyframes ${animationName}{0%{opacity:0;}50%{opacity:${peak};}100%{opacity:0;}}`,
  };
}

export interface OverlayOptions {
  /** Token único por disparo. Garante um nome de keyframe novo a cada hit. */
  token?: string;
}

/**
 * Gera TODO o visual do efeito como um fragmento HTML autocontido.
 *
 * - Nenhum DOM, nenhum acesso ao app: é a mesma função usada pela lógica e
 *   pela prévia do painel.
 * - A frequência é revalidada aqui (defesa em profundidade).
 * - As geometrias usam apenas unidades relativas (`%`, `vmin`) e a animação
 *   roda inteira no navegador da saída, sem IPC por frame.
 */
export function buildOverlayHtml(params: unknown, options: OverlayOptions = {}): string {
  // `normalizeParams` reaplica o clamp de frequência e normaliza a cor; isso é
  // a defesa em profundidade do renderizador.
  const safe = normalizeParams(params);
  const token = sanitizeToken(options.token ?? 'fx');
  const rootId = `pfx-${token}`;
  const animationName = `${rootId}-anim`;
  const { animation, keyframes } = animationCss(safe, animationName);
  const geometry = geometryCss(safe);

  return [
    `<div id="${rootId}" class="pfx-root" aria-hidden="true">`,
    '  <div class="pfx-sheet"></div>',
    '</div>',
    '<style>',
    `#${rootId}.pfx-root{position:absolute;inset:0;overflow:hidden;pointer-events:none;isolation:isolate;contain:layout paint style;container-type:size;background:transparent;}`,
    `#${rootId} .pfx-sheet{position:absolute;inset:0;opacity:0;will-change:opacity;${geometry}${animation}}`,
    keyframes,
    '</style>',
  ].join('\n');
}

export function buildPreviewDocument(params: unknown, token: string): string {
  const overlay = buildOverlayHtml(params, { token });
  return [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<style>html,body{position:relative;width:100%;height:100%;margin:0;padding:0;background:transparent;overflow:hidden;}</style>',
    '</head><body>',
    overlay,
    '</body></html>',
  ].join('');
}
