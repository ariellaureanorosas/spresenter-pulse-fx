// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeClamp, makeState } from '../helpers/uiState';

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

import { usePulseBridge } from '../../src/ui/bridge';

function emit(raw: unknown): void {
  for (const listener of sdk.listeners) listener(raw);
}

beforeEach(() => {
  sdk.listeners.clear();
  sdk.posted.length = 0;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ponte UI ↔ lógica', () => {
  it('pede o estado no boot e conecta ao receber o primeiro state', () => {
    const { result } = renderHook(() => usePulseBridge());

    expect(sdk.posted).toContainEqual({ type: 'requestState' });
    expect(result.current.connected).toBe(false);

    act(() => emit({ type: 'state', state: makeState({ revision: 1 }) }));

    expect(result.current.connected).toBe(true);
    expect(result.current.state?.revision).toBe(1);
  });

  it('descarta estado com revisão menor', () => {
    const { result } = renderHook(() => usePulseBridge());

    act(() => emit({ type: 'state', state: makeState({ revision: 5 }) }));
    act(() => emit({ type: 'state', state: makeState({ revision: 2 }) }));

    expect(result.current.state?.revision).toBe(5);
  });

  it('converte toast, erro e clamp em avisos visíveis', () => {
    const { result } = renderHook(() => usePulseBridge());

    act(() => {
      emit({ type: 'toast', level: 'info', message: 'Overlay aplicado.' });
      emit({ type: 'error', message: 'Falha inesperada.' });
      emit({ type: 'clamped', clamp: makeClamp() });
    });

    expect(result.current.toasts.map((toast) => toast.level)).toEqual(['info', 'error', 'warning']);
    expect(result.current.toasts[2].message).toContain('Automação');
  });

  it('permite dispensar um aviso', () => {
    const { result } = renderHook(() => usePulseBridge());

    act(() => emit({ type: 'toast', level: 'success', message: 'Pronto.' }));
    const [toast] = result.current.toasts;
    act(() => result.current.dismissToast(toast.id));

    expect(result.current.toasts).toHaveLength(0);
  });

  it('confirma a aplicação reenviando o comando com force', () => {
    const { result } = renderHook(() => usePulseBridge());
    act(() => emit({ type: 'state', state: makeState() }));

    act(() =>
      emit({
        type: 'confirmationRequired',
        request: { action: 'apply', message: 'Ocupada.', output: '0', layer: 5 },
      }),
    );
    act(() => result.current.confirmConfirmation());

    expect(result.current.confirmation).toBeNull();
    expect(sdk.posted).toContainEqual({ type: 'applyOverlay', force: true });
  });

  it('confirma o movimento mesmo se a seleção mudou (o alvo vem do pedido)', () => {
    const { result } = renderHook(() => usePulseBridge());
    act(() => emit({ type: 'state', state: makeState() }));

    act(() =>
      emit({
        type: 'confirmationRequired',
        request: { action: 'move', message: 'Ocupada.', output: '1', layer: 2 },
      }),
    );
    act(() => result.current.confirmConfirmation());

    expect(sdk.posted).toContainEqual({
      type: 'selectTarget',
      output: '1',
      layer: 2,
      force: true,
    });
  });

  it('revisa o alvo em vez de disparar quando a seleção mudou', () => {
    const { result } = renderHook(() => usePulseBridge());
    act(() => emit({ type: 'state', state: makeState() }));

    act(() =>
      emit({
        type: 'confirmationRequired',
        request: { action: 'run', message: 'Ocupada.', output: '1', layer: 2 },
      }),
    );
    act(() => result.current.confirmConfirmation());

    expect(sdk.posted).not.toContainEqual({ type: 'fire', force: true });
    expect(result.current.toasts.some((toast) => toast.message.includes('A seleção mudou'))).toBe(
      true,
    );
    expect(sdk.posted).toContainEqual({ type: 'requestState' });
  });

  it('usa startContinuous para confirmar um efeito contínuo', () => {
    const { result } = renderHook(() => usePulseBridge());
    act(() =>
      emit({
        type: 'state',
        state: makeState({ params: { ...makeState().params, mode: 'strobe' } }),
      }),
    );

    act(() =>
      emit({
        type: 'confirmationRequired',
        request: { action: 'run', message: 'Ocupada.', output: '0', layer: 5 },
      }),
    );
    act(() => result.current.confirmConfirmation());

    expect(sdk.posted).toContainEqual({ type: 'startContinuous', force: true });
  });

  it('cancelar fecha o modal e pede o estado atualizado', () => {
    const { result } = renderHook(() => usePulseBridge());
    act(() =>
      emit({
        type: 'confirmationRequired',
        request: { action: 'apply', message: 'Ocupada.', output: '0', layer: 5 },
      }),
    );

    act(() => result.current.cancelConfirmation());

    expect(result.current.confirmation).toBeNull();
    expect(sdk.posted).toContainEqual({ type: 'requestState' });
  });
});
