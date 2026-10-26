import { describe, expect, it } from 'vitest';
import { buildOverlayHtml, buildPreviewStyle } from '../src/shared/overlay';
import { DEFAULT_PARAMS } from '../src/shared/params';
import type { FxParams, FxTarget, PulseMode } from '../src/shared/types';

const BASE: FxParams = {
  ...DEFAULT_PARAMS,
  color: '#35e0ff',
  intensity: 80,
  decayMs: 420,
  frequencyHz: 2,
  flashWidth: 35,
  thickness: 40,
  softness: 65,
  safetyLock: true,
};

const MODES: PulseMode[] = ['hit', 'strobe', 'pulse'];
const TARGETS: FxTarget[] = ['full', 'vignette', 'frame'];

describe('buildOverlayHtml', () => {
  for (const mode of MODES) {
    for (const target of TARGETS) {
      it(`gera o snapshot ${mode} × ${target}`, () => {
        const html = buildOverlayHtml({ ...BASE, mode, target }, { token: 'snap' });
        expect(html).toMatchSnapshot(`${mode}-${target}`);
      });
    }
  }

  it('Hit usa uma única iteração com forwards e a duração da queda', () => {
    const html = buildOverlayHtml({ ...BASE, mode: 'hit' }, { token: 'hit' });
    expect(html).toContain('animation:pfx-hit-anim 420ms');
    expect(html).toContain('1 normal forwards');
    expect(html).toContain('0%{opacity:0.8;}100%{opacity:0;}');
    expect(html).not.toContain('steps(');
  });

  it('Strobe usa passos duros e duty cycle exato', () => {
    const html = buildOverlayHtml(
      { ...BASE, mode: 'strobe', flashWidth: 35, frequencyHz: 2 },
      { token: 'strobe' },
    );
    expect(html).toContain('500ms steps(1, end)');
    expect(html).toContain('0%{opacity:0.8;}35%{opacity:0;}100%{opacity:0;}');
    expect(html).toContain('infinite normal none');
  });

  it('Pulse completa um ciclo por período, sem alternate', () => {
    const html = buildOverlayHtml({ ...BASE, mode: 'pulse', frequencyHz: 2 }, { token: 'pulse' });
    expect(html).toContain('500ms ease-in-out');
    expect(html).toContain('0%{opacity:0;}50%{opacity:0.8;}100%{opacity:0;}');
    expect(html).not.toContain('alternate');
  });

  it('reaplica a trava de frequência como defesa em profundidade', () => {
    const clamped = buildOverlayHtml(
      { ...BASE, mode: 'pulse', frequencyHz: 9, safetyLock: true },
      { token: 'safe' },
    );
    expect(clamped).toContain('333.333ms');

    const technical = buildOverlayHtml(
      { ...BASE, mode: 'pulse', frequencyHz: 9, safetyLock: false },
      { token: 'free' },
    );
    expect(technical).toContain('111.111ms');
  });

  it('gera keyframe único por token para reiniciar o hit', () => {
    const first = buildOverlayHtml({ ...BASE, mode: 'hit' }, { token: 'one' });
    const second = buildOverlayHtml({ ...BASE, mode: 'hit' }, { token: 'two' });
    expect(first).toContain('pfx-one-anim');
    expect(second).toContain('pfx-two-anim');
    expect(first).not.toContain('pfx-two-anim');
  });

  it('sanitiza o token', () => {
    const html = buildOverlayHtml(
      { ...BASE, mode: 'hit' },
      { token: '"><script>alert(1)</script>' },
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('pfx-scriptalert1script-anim');
  });

  it('não injeta CSS a partir da cor', () => {
    const html = buildOverlayHtml(
      { ...BASE, mode: 'hit', color: 'red;}body{display:none' },
      { token: 'color' },
    );
    expect(html).not.toContain('display:none');
    expect(html).toContain('background:#ffffff;');
  });

  it('aplica as três geometrias', () => {
    const full = buildOverlayHtml({ ...BASE, mode: 'hit', target: 'full' }, { token: 'f' });
    const vignette = buildOverlayHtml({ ...BASE, mode: 'hit', target: 'vignette' }, { token: 'v' });
    const frame = buildOverlayHtml({ ...BASE, mode: 'hit', target: 'frame' }, { token: 'm' });

    expect(full).toContain('background:#35e0ff;');
    expect(vignette).toContain('background-image:radial-gradient');
    expect(frame).toContain('box-shadow:inset 0 0');
  });

  it('usa apenas unidades relativas', () => {
    for (const mode of MODES) {
      for (const target of TARGETS) {
        const html = buildOverlayHtml({ ...BASE, mode, target }, { token: 'units' });
        expect(html).not.toMatch(/\dpx\b/);
      }
    }
  });
});

describe('buildPreviewStyle', () => {
  it('usa os mesmos keyframes do overlay, em um seletor escopado', () => {
    const { id, css } = buildPreviewStyle({ ...BASE, mode: 'strobe' }, 'preview');
    expect(id).toBe('pfx-preview-preview');
    expect(css).toContain('#pfx-preview-preview{');
    expect(css).toContain('500ms steps(1, end)');
    expect(css).toContain('0%{opacity:0.8;}35%{opacity:0;}100%{opacity:0;}');
  });
  it('troca vmin por cqmin para medir o palco, não a janela', () => {
    const { css } = buildPreviewStyle({ ...BASE, target: 'frame' }, 'units');
    expect(css).toContain('cqmin');
    expect(css).not.toContain('vmin');
  });

  it('aplica a trava de frequência como o overlay', () => {
    const clamped = buildPreviewStyle(
      { ...BASE, mode: 'pulse', frequencyHz: 9, safetyLock: true },
      'safe',
    );
    expect(clamped.css).toContain('333.333ms');
  });

  it('expõe o pico para o fallback de movimento reduzido', () => {
    const { css } = buildPreviewStyle({ ...BASE, intensity: 80 }, 'peak');
    expect(css).toContain('--pfx-preview-peak:0.8');
  });

  it('sanitiza o token e não injeta CSS', () => {
    const { id, css } = buildPreviewStyle(
      { ...BASE, color: 'red;}body{display:none' },
      '"><script>alert(1)</script>',
    );
    expect(id).toBe('pfx-preview-scriptalert1script');
    expect(css).not.toContain('<script>');
    expect(css).not.toContain('display:none');
  });
});
