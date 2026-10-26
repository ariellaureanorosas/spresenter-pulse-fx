// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEffect, makeState } from '../helpers/uiState';

const sdk = vi.hoisted(() => ({
  listeners: new Set<(raw: unknown) => void>(),
  posted: [] as unknown[],
}));

vi.mock('@spresenter/plugin-sdk/ui', () => ({
  onMessage: (handler: (raw: unknown) => void) => {
    sdk.listeners.add(handler);
    return () => sdk.listeners.delete(handler);
  },
  postMessage: (message: unknown) => {
    sdk.posted.push(message);
  },
}));

import { App } from '../../src/ui/App';

function emit(raw: unknown): void {
  act(() => {
    for (const listener of sdk.listeners) listener(raw);
  });
}

const user = userEvent.setup();

beforeEach(() => {
  sdk.listeners.clear();
  sdk.posted.length = 0;
});

// `globals: false` no Vitest: o auto-cleanup do Testing Library não roda.
afterEach(cleanup);

describe('painel', () => {
  it('mostra a tela de boot até o primeiro estado chegar', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Conectando ao palco' })).toBeInTheDocument();
    expect(sdk.posted).toContainEqual({ type: 'requestState' });

    emit({ type: 'state', state: makeState() });

    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aplicar na saída/i })).toBeInTheDocument();
  });

  it('envia applyOverlay, stopAll e setParams a partir dos controles', async () => {
    render(<App />);
    emit({ type: 'state', state: makeState() });

    await user.click(screen.getByRole('button', { name: /aplicar na saída/i }));
    expect(sdk.posted).toContainEqual({ type: 'applyOverlay' });

    await user.click(screen.getByRole('button', { name: /parar tudo/i }));
    expect(sdk.posted).toContainEqual({ type: 'stopAll' });

    const modes = screen.getByRole('group', { name: 'Modo do efeito' });
    await user.click(within(modes).getByRole('button', { name: /pulse/i }));

    expect(sdk.posted).toContainEqual({ type: 'setParams', params: { mode: 'pulse' } });
  });

  it('troca o botão para remover quando o overlay está aplicado', async () => {
    render(<App />);
    emit({ type: 'state', state: makeState({ applied: true, layerOccupied: true }) });

    await user.click(screen.getByRole('button', { name: /remover da saída/i }));

    expect(sdk.posted).toContainEqual({ type: 'removeOverlay' });
  });

  it('exibe o efeito em execução e os outros alvos aplicados', () => {
    render(<App />);
    emit({
      type: 'state',
      state: makeState({
        applied: true,
        selectedEffect: makeEffect({ mode: 'pulse', owner: 'ui' }),
        effects: [makeEffect({ mode: 'pulse', owner: 'ui' })],
        appliedTargets: [
          { output: '0', layer: 5, effect: 'pulse' },
          { output: '1', layer: 2, effect: 'strobe' },
        ],
      }),
    });

    expect(screen.getByText('Também ativo em')).toBeInTheDocument();
    expect(screen.getByText(/Palco · Camada 2 · Strobe/)).toBeInTheDocument();
  });

  it('confirma a substituição de conteúdo pela caixa de diálogo', async () => {
    render(<App />);
    emit({ type: 'state', state: makeState({ layerOccupied: true }) });
    emit({
      type: 'confirmationRequired',
      request: {
        action: 'apply',
        message: 'A camada 5 já tem conteúdo.',
        output: '0',
        layer: 5,
      },
    });

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Aplicar nesta camada?')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /substituir e aplicar/i }));

    expect(sdk.posted).toContainEqual({ type: 'applyOverlay', force: true });
  });

  it('fecha a confirmação com Escape', async () => {
    render(<App />);
    emit({ type: 'state', state: makeState() });
    emit({
      type: 'confirmationRequired',
      request: { action: 'run', message: 'Ocupada.', output: '0', layer: 5 },
    });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(sdk.posted).toContainEqual({ type: 'requestState' });
  });

  it('bloqueia o disparo quando a camada está desativada', () => {
    render(<App />);
    emit({ type: 'state', state: makeState({ layerDisabled: true }) });

    expect(screen.getByRole('button', { name: /aplicar na saída/i })).toBeDisabled();
    expect(screen.getByText('Esta camada está desativada na saída')).toBeInTheDocument();
  });

  it('avisa quando não há saídas disponíveis', () => {
    render(<App />);
    emit({ type: 'state', state: makeState({ outputs: [], ready: true }) });

    expect(screen.getByText('Nenhuma saída disponível')).toBeInTheDocument();
    expect(screen.getByText('Sem saída')).toBeInTheDocument();
  });
});
