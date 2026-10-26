// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../../src/shared/params';
import type { FxParams } from '../../src/shared/types';
import { Preview } from '../../src/ui/components/Preview';

const user = userEvent.setup();

// `globals: false` no Vitest: o auto-cleanup do Testing Library não roda.
afterEach(cleanup);

function renderPreview(overrides: Partial<FxParams> = {}) {
  const params: FxParams = { ...DEFAULT_PARAMS, ...overrides };
  const view = render(<Preview params={params} active={false} applied={false} />);
  return view;
}

function sheetId(container: HTMLElement): string {
  const sheet = container.querySelector('.pfx-preview-sheet');
  if (!sheet) throw new Error('folha da prévia ausente');
  return sheet.id;
}

describe('prévia', () => {
  it('desenha a folha do efeito sobre o palco quadriculado, sem iframe', () => {
    const { container } = renderPreview();

    expect(container.querySelector('.pfx-stage')).toBeInTheDocument();
    expect(container.querySelector('.pfx-stage-canvas')).toBeInTheDocument();
    expect(container.querySelector('iframe')).not.toBeInTheDocument();

    const css = container.querySelector('style')?.textContent ?? '';
    expect(css).toContain(`#${sheetId(container)}{`);
    expect(css).toContain('--pfx-preview-peak:0.85');
    expect(css).toContain('@keyframes');
  });

  it('reinicia a animação ao clicar no palco', async () => {
    const { container } = renderPreview();
    const before = sheetId(container);

    await user.click(screen.getByRole('button', { name: 'Repetir a prévia' }));

    expect(sheetId(container)).not.toBe(before);
  });

  it('reinicia a animação pelo botão Repetir do rodapé', async () => {
    const { container } = renderPreview();
    const before = sheetId(container);

    await user.click(screen.getByRole('button', { name: 'Repetir' }));

    expect(sheetId(container)).not.toBe(before);
  });

  it('reinicia pelo teclado', async () => {
    const { container } = renderPreview();
    const button = screen.getByRole('button', { name: 'Repetir a prévia' });
    const before = sheetId(container);

    button.focus();
    await user.keyboard('{Enter}');

    expect(sheetId(container)).not.toBe(before);
  });

  it('não repete a dica Repetir sobre o palco', () => {
    const { container } = renderPreview();

    const stageButton = screen.getByRole('button', { name: 'Repetir a prévia' });
    expect(stageButton).toBeEmptyDOMElement();
    expect(container.querySelector('.pfx-stage-replay-hint')).not.toBeInTheDocument();
    // A única referência visual é o botão do rodapé.
    expect(screen.getAllByText('Repetir')).toHaveLength(1);
  });

  it('aplica a geometria do alvo escolhido', () => {
    const { container, rerender } = renderPreview({ target: 'vignette' });
    expect(container.querySelector('style')?.textContent).toContain('radial-gradient');

    rerender(
      <Preview params={{ ...DEFAULT_PARAMS, target: 'frame' }} active={false} applied={false} />,
    );
    const css = container.querySelector('style')?.textContent ?? '';
    expect(css).toContain('box-shadow:inset');
    expect(css).toContain('cqmin');
    expect(css).not.toContain('vmin');
  });

  it('respeita a trava de frequência no CSS gerado', () => {
    const { container } = renderPreview({ mode: 'pulse', frequencyHz: 9, safetyLock: true });
    expect(container.querySelector('style')?.textContent).toContain('333.333ms');
  });

  it('rotula o palco e mostra alvo e modo', () => {
    renderPreview({ mode: 'strobe', target: 'frame' });

    expect(screen.getByRole('figure', { name: 'Simulação do palco' })).toBeInTheDocument();
    // Selo do palco e rodapé mostram o modo.
    expect(screen.getAllByText('Strobe')).toHaveLength(2);
    expect(screen.getByText('Moldura')).toBeInTheDocument();
    expect(screen.getByText('PRÉVIA')).toBeInTheDocument();
  });

  it('mostra o estado ao vivo', () => {
    render(<Preview params={DEFAULT_PARAMS} active applied={false} owner="automation" />);
    expect(screen.getByText('AUTOMAÇÃO')).toBeInTheDocument();
  });
});
