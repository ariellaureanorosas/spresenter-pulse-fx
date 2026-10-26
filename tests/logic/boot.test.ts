import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS } from '../../src/shared/params';
import { createFakeHost, loadLogic } from '../helpers/fakeHost';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('boot da lógica', () => {
  it('emite estado pronto com padrões e a camada mais alta disponível', async () => {
    const host = await loadLogic(createFakeHost());
    const state = host.lastState();

    expect(state.ready).toBe(true);
    expect(state.params).toEqual(DEFAULT_PARAMS);
    expect(state.selection).toEqual({ output: '0', layer: 5 });
    expect(state.applied).toBe(false);
    expect(state.layerOccupied).toBe(false);
    expect(state.layerOccupiedByUs).toBe(false);
    expect(state.layerDisabled).toBe(false);
    expect(state.outputs.map((output) => output.index)).toEqual([0, 1]);
    expect(state.layers).toHaveLength(6);
  });

  it('persiste a seleção inicial depois do debounce', async () => {
    const host = await loadLogic(createFakeHost());

    await host.advance(300);

    const saved = host.storageWrites.filter((write) => write.key === 'pulsefx.settings').at(-1);
    expect(saved?.value).toMatchObject({
      schemaVersion: 1,
      output: '0',
      layer: 5,
      hasSelection: true,
    });
  });

  it('restaura parâmetros e seleção salvos', async () => {
    const host = await loadLogic(
      createFakeHost({
        settings: {
          schemaVersion: 1,
          params: { ...DEFAULT_PARAMS, color: '#22d3ee', mode: 'pulse', frequencyHz: 1.5 },
          output: '1',
          layer: 2,
          hasSelection: true,
        },
      }),
    );

    const state = host.lastState();
    expect(state.params).toMatchObject({ color: '#22d3ee', mode: 'pulse', frequencyHz: 1.5 });
    expect(state.selection).toEqual({ output: '1', layer: 2 });
  });

  it('migra as preferências da versão anterior para a chave nova', async () => {
    const host = await loadLogic(
      createFakeHost({
        legacySettings: {
          mode: 'strobe',
          color: '#ff0000',
          duty: 20,
          fall: 500,
          output: '1',
          layer: 3,
        },
      }),
    );

    const state = host.lastState();
    expect(state.params).toMatchObject({ mode: 'strobe', color: '#ff0000', flashWidth: 20 });
    expect(state.params.decayMs).toBe(500);
    expect(state.selection).toEqual({ output: '1', layer: 3 });

    const migrated = host.storageWrites.find(
      (write) => write.key === 'pulsefx.settings' && write.value !== undefined,
    );
    expect(migrated?.value).toMatchObject({ schemaVersion: 1, output: '1', layer: 3 });
  });

  it('não sobrescreve preferências de um schema futuro e avisa no handshake', async () => {
    const host = await loadLogic(
      createFakeHost({ settings: { schemaVersion: 99, params: { color: '#ff0000' } } }),
    );

    expect(host.lastState().params).toEqual(DEFAULT_PARAMS);

    await host.send({ type: 'requestState' });
    await host.advance(500);

    expect(host.toasts().some((toast) => toast.message.includes('versão mais nova'))).toBe(true);
    expect(host.storageWrites.some((write) => write.key === 'pulsefx.settings')).toBe(false);
  });

  it('usa os padrões e avisa quando a leitura do storage falha', async () => {
    const host = await loadLogic(createFakeHost({ storageReadFails: true }));

    expect(host.lastState().params).toEqual(DEFAULT_PARAMS);

    await host.send({ type: 'requestState' });
    expect(host.toasts().some((toast) => toast.message.includes('Não foi possível ler'))).toBe(
      true,
    );
  });

  it('responde requestState com um estado novo e revisão crescente', async () => {
    const host = await loadLogic(createFakeHost());
    const first = host.lastState();

    await host.send({ type: 'requestState' });

    const second = host.lastState();
    expect(second.revision).toBeGreaterThan(first.revision);
  });

  it('sobrevive a um host sem saídas', async () => {
    const host = await loadLogic(createFakeHost({ outputs: [] }));
    const state = host.lastState();

    expect(state.ready).toBe(true);
    expect(state.outputs).toEqual([]);

    await host.send({ type: 'fire' });
    expect(host.toasts().some((toast) => toast.message.includes('Nenhuma saída'))).toBe(true);
  });
});
