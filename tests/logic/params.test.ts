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

describe('parâmetros e trava de frequência', () => {
  it('aplica o clamp de segurança e nunca falha em silêncio', async () => {
    const host = await loadLogic(createFakeHost());

    await host.send({ type: 'setParams', params: { frequencyHz: 10 } });

    const state = host.lastState();
    expect(state.params.frequencyHz).toBe(3);
    expect(state.lastClamp).toMatchObject({
      requestedHz: 10,
      hz: 3,
      cause: 'safety',
      source: 'ui',
    });
    // O evento `clamped` é reservado à automação; o painel lê `state.lastClamp`.
    expect(host.clamps()).toHaveLength(0);
  });

  it('usa o teto técnico de 20 Hz com a trava desligada', async () => {
    const host = await loadLogic(createFakeHost());

    await host.send({ type: 'setParams', params: { safetyLock: false, frequencyHz: 25 } });

    const state = host.lastState();
    expect(state.params.safetyLock).toBe(false);
    expect(state.params.frequencyHz).toBe(20);
    expect(state.lastClamp).toMatchObject({ cause: 'technical', limitHz: 20 });
  });

  it('limpa o último clamp ao voltar para uma frequência válida', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'setParams', params: { frequencyHz: 10 } });
    expect(host.lastState().lastClamp).not.toBeNull();

    await host.send({ type: 'setParams', params: { frequencyHz: 2 } });

    expect(host.lastState().lastClamp).toBeNull();
  });

  it('normaliza valores fora de faixa antes de expor o estado', async () => {
    const host = await loadLogic(createFakeHost());

    await host.send({ type: 'setParams', params: { intensity: 999, decayMs: 1, color: 'red' } });

    const state = host.lastState();
    expect(state.params.intensity).toBe(100);
    expect(state.params.decayMs).toBe(30);
    expect(state.params.color).toBe('#ff0000');
  });

  it('restaura os padrões e religa a trava sem tirar o overlay', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'applyOverlay' });
    await host.send({
      type: 'setParams',
      params: { color: '#22d3ee', mode: 'pulse', safetyLock: false, frequencyHz: 12 },
    });

    await host.send({ type: 'restoreDefaults' });

    const state = host.lastState();
    expect(state.params).toEqual(DEFAULT_PARAMS);
    expect(state.applied).toBe(true);
  });

  it('persiste os parâmetros depois do debounce', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'setParams', params: { color: '#ff0000' } });

    await host.advance(300);

    const saved = host.storageWrites.filter((write) => write.key === 'pulsefx.settings').at(-1);
    expect(saved).toBeDefined();
    const value = saved?.value as { params: { color: string } } | undefined;
    expect(value?.params.color).toBe('#ff0000');
  });

  it('re-renderiza o efeito em execução quando um parâmetro muda', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'setParams', params: { mode: 'strobe' } });
    await host.send({ type: 'startContinuous' });

    const before = host.elements.length;
    await host.send({ type: 'setParams', params: { intensity: 40 } });
    await host.advance(100);

    expect(host.elements.length).toBeGreaterThan(before);
    expect(host.lastState().selectedEffect).toMatchObject({ mode: 'strobe' });
  });

  it('não re-dispara o hit quando um parâmetro muda', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'fire' });

    const before = host.elements.length;
    const htmlBefore = host.lastElementHtml();

    await host.send({ type: 'setParams', params: { intensity: 40, color: '#ff0000' } });
    await host.advance(200);

    // Hit é disparo único: a queda em curso continua, sem novo setElement.
    expect(host.elements.length).toBe(before);
    expect(host.lastElementHtml()).toBe(htmlBefore);
    expect(host.lastState().effects).toHaveLength(1);
  });

  it('não re-dispara o hit ao alternar a trava de segurança', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'setParams', params: { safetyLock: false } });
    await host.send({ type: 'fire' });

    const before = host.elements.length;
    await host.send({ type: 'setParams', params: { safetyLock: true } });
    await host.advance(200);

    expect(host.elements.length).toBe(before);
  });
});
