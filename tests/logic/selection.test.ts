import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeHost, loadLogic } from '../helpers/fakeHost';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('seleção de saída e camada', () => {
  it('move o overlay aplicado para o novo alvo e limpa o antigo', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'applyOverlay' });

    await host.send({ type: 'selectTarget', output: '1', layer: 2 });

    expect(host.applications.map((item) => `${item.output}:${item.layer}`)).toEqual(['0:5', '1:2']);
    expect(host.clears).toEqual([{ output: '0', layer: 5 }]);

    const state = host.lastState();
    expect(state.selection).toEqual({ output: '1', layer: 2 });
    expect(state.applied).toBe(true);
  });

  it('não move para uma camada ocupada sem confirmação', async () => {
    const host = createFakeHost();
    host.setForeignContent('1', 2);
    await loadLogic(host);
    await host.send({ type: 'applyOverlay' });

    await host.send({ type: 'selectTarget', output: '1', layer: 2 });

    expect(host.confirmations()[0]).toMatchObject({ action: 'move', output: '1', layer: 2 });
    expect(host.lastState().selection).toEqual({ output: '0', layer: 5 });
    expect(host.clears).toHaveLength(0);
  });

  it('move com force, substituindo o conteúdo alheio', async () => {
    const host = createFakeHost();
    host.setForeignContent('1', 2);
    await loadLogic(host);
    await host.send({ type: 'applyOverlay' });

    await host.send({ type: 'selectTarget', output: '1', layer: 2, force: true });

    expect(host.lastState().selection).toEqual({ output: '1', layer: 2 });
    expect(host.clears).toEqual([{ output: '0', layer: 5 }]);
  });

  it('recusa uma camada desativada na saída e avisa', async () => {
    const host = createFakeHost({
      outputs: [{ index: 0, name: 'Principal', disabledLayers: [4] }],
    });
    await loadLogic(host);

    await host.send({ type: 'selectTarget', output: '0', layer: 4 });

    expect(host.lastState().selection).toEqual({ output: '0', layer: 5 });
    expect(host.toasts().some((toast) => toast.message.includes('desativada'))).toBe(true);
  });

  it('reconcilia a seleção quando o app desativa a camada atual', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'applyOverlay' });

    host.outputs[0].disabledLayers.push(5);
    await host.emit('live');
    await host.advance(250);

    const state = host.lastState();
    expect(state.selection).toEqual({ output: '0', layer: 4 });
    expect(host.clears).toContainEqual({ output: '0', layer: 5 });
    expect(host.toasts().some((toast) => toast.message.includes('não está mais disponível'))).toBe(
      true,
    );
  });

  it('mantém a seleção quando o alvo atual continua válido', async () => {
    const host = await loadLogic(createFakeHost());

    await host.emit('state');
    await host.advance(250);

    expect(host.lastState().selection).toEqual({ output: '0', layer: 5 });
    expect(host.clears).toHaveLength(0);
  });
});
