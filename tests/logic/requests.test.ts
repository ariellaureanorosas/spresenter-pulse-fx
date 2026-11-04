import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeHost, loadLogic } from '../helpers/fakeHost';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function expectStatus(promise: Promise<unknown>, status: number): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    const failure = error as Error & { status?: number };
    expect(failure.status).toBe(status);
    return failure;
  }
  throw new Error('o pedido deveria ter falhado');
}

describe('ações externas', () => {
  it('registra start, stop, safetyLock e state antes de qualquer await', async () => {
    const host = await loadLogic(createFakeHost());

    expect([...host.requests.keys()].sort()).toEqual(['safetyLock', 'start', 'state', 'stop']);
  });

  it('liga o strobe no alvo informado e registra o dono external', async () => {
    const host = await loadLogic(createFakeHost());

    const response = (await host.callRequest('start', {
      mode: 'strobe',
      frequency: 2,
      output: '1',
      layer: 3,
    })) as { ok: boolean; effect: Record<string, unknown> };

    expect(response.ok).toBe(true);
    expect(response.effect).toMatchObject({ output: '1', layer: 3, mode: 'strobe' });
    expect(host.applications.at(-1)).toMatchObject({ output: '1', layer: 3 });

    const [effect] = host.lastState().effects;
    expect(effect).toMatchObject({ output: '1', layer: 3, mode: 'strobe', owner: 'external' });
  });

  it('usa a seleção salva quando o alvo é omitido', async () => {
    const host = await loadLogic(createFakeHost());

    await host.callRequest('start', { mode: 'pulse' });

    const [effect] = host.lastState().effects;
    expect(effect).toMatchObject({ output: '0', layer: 5, mode: 'pulse', owner: 'external' });
  });

  it('assume strobe quando o modo não é informado', async () => {
    const host = await loadLogic(createFakeHost());

    await host.callRequest('start', {});

    expect(host.lastState().effects[0]?.mode).toBe('strobe');
  });

  it('respeita a trava e informa a frequência realmente aplicada', async () => {
    const host = await loadLogic(createFakeHost());

    const response = (await host.callRequest('start', {
      mode: 'strobe',
      frequency: 8,
    })) as { effect: { frequencyHz: number; requestedHz: number; clamped: boolean } };

    expect(response.effect).toMatchObject({ requestedHz: 8, frequencyHz: 3, clamped: true });
    expect(host.lastState().effects[0]).toMatchObject({ owner: 'external' });
    expect(host.clamps().at(-1)).toMatchObject({ source: 'external', requestedHz: 8, hz: 3 });
  });

  it('ignora a trava só no disparo e mantém a trava global ligada', async () => {
    const host = await loadLogic(createFakeHost());

    const response = (await host.callRequest('start', {
      mode: 'strobe',
      frequency: 8,
      ignoreSafetyLock: true,
    })) as {
      effect: {
        frequencyHz: number;
        requestedHz: number;
        clamped: boolean;
        ignoreSafetyLock: boolean;
      };
    };

    expect(response.effect).toMatchObject({
      requestedHz: 8,
      frequencyHz: 8,
      clamped: false,
      ignoreSafetyLock: true,
    });
    expect(host.lastState().params.safetyLock).toBe(true);

    const state = (await host.callRequest('state')) as {
      effects: Array<Record<string, unknown>>;
    };
    expect(state.effects[0]).toMatchObject({
      frequencyHz: 8,
      requestedHz: 8,
      ignoreSafetyLock: true,
    });
  });

  it('aceita ignoreSafetyLock em texto e recusa valor inválido', async () => {
    const host = await loadLogic(createFakeHost());

    const response = (await host.callRequest('start', {
      mode: 'pulse',
      frequency: 6,
      ignoreSafetyLock: 'true',
    })) as { effect: { frequencyHz: number } };
    expect(response.effect.frequencyHz).toBe(6);

    await expectStatus(host.callRequest('start', { ignoreSafetyLock: 'talvez' }), 400);
  });

  it('aceita mode hit como disparo único', async () => {
    const host = await loadLogic(createFakeHost());

    // Desliga a trava para testar hit sem clamp
    await host.callRequest('safetyLock', { enabled: false });

    const response = (await host.callRequest('start', {
      mode: 'hit',
      frequency: 10,
      decayMs: 500,
    })) as {
      effect: { mode: string; frequencyHz: number };
    };

    expect(response.effect).toMatchObject({
      mode: 'hit',
      frequencyHz: 10,
    });
  });

  it('desligar a trava acelera o efeito de botão para a frequência pedida', async () => {
    const host = await loadLogic(createFakeHost());

    await host.callRequest('start', { mode: 'strobe', frequency: 8 });
    expect(host.lastState().effects[0]).toMatchObject({ owner: 'external' });

    const before = (await host.callRequest('state')) as {
      effects: Array<Record<string, unknown>>;
    };
    expect(before.effects[0]).toMatchObject({ frequencyHz: 3, requestedHz: 8 });

    await host.callRequest('safetyLock', { enabled: false });
    await host.advance(100);

    const after = (await host.callRequest('state')) as {
      effects: Array<Record<string, unknown>>;
    };
    expect(after.effects[0]).toMatchObject({
      frequencyHz: 8,
      requestedHz: 8,
      ignoreSafetyLock: false,
    });
  });

  it('ligar a trava derruba o modo ignorar de um efeito em execução', async () => {
    const host = await loadLogic(createFakeHost());

    await host.callRequest('start', {
      mode: 'pulse',
      frequency: 8,
      ignoreSafetyLock: true,
    });
    await host.callRequest('safetyLock', { enabled: true });
    await host.advance(100);

    const state = (await host.callRequest('state')) as {
      safetyLock: boolean;
      effects: Array<Record<string, unknown>>;
    };
    expect(state.safetyLock).toBe(true);
    expect(state.effects[0]).toMatchObject({
      frequencyHz: 3,
      requestedHz: 8,
      ignoreSafetyLock: false,
    });
  });

  it('recusa modo inválido com 400', async () => {
    const host = await loadLogic(createFakeHost());

    const error = await expectStatus(host.callRequest('start', { mode: 'invalido' }), 400);
    expect(error.message).toMatch(/mode inválido/);
    expect(host.applications).toHaveLength(0);
  });

  it('recusa frequência não numérica com 400', async () => {
    const host = await loadLogic(createFakeHost());

    await expectStatus(host.callRequest('start', { frequency: 'rápido' }), 400);
    expect(host.applications).toHaveLength(0);
  });

  it('recusa camada inválida com 400', async () => {
    const host = await loadLogic(createFakeHost());

    await expectStatus(host.callRequest('start', { layer: 250 }), 400);
  });

  it('aplica o overlay em camada ocupada e avisa em nome do Companion', async () => {
    const host = createFakeHost();
    host.setForeignContent('0', 5);
    await loadLogic(host);

    await host.callRequest('start', { mode: 'strobe' });

    expect(host.applications).toHaveLength(1);
    expect(
      host
        .toasts()
        .some((toast) => toast.level === 'warning' && toast.message.includes('Companion')),
    ).toBe(true);
  });

  it('start repetido mantém um único efeito na camada', async () => {
    const host = await loadLogic(createFakeHost());

    await host.callRequest('start', { mode: 'strobe', frequency: 2 });
    await host.callRequest('start', { mode: 'strobe', frequency: 4 });

    expect(host.lastState().effects).toHaveLength(1);
  });

  it('stop desliga o efeito iniciado de fora e limpa o palco', async () => {
    const host = await loadLogic(createFakeHost());
    await host.callRequest('start', { mode: 'strobe', output: '1', layer: 3 });

    const response = (await host.callRequest('stop', { output: '1', layer: 3 })) as {
      ok: boolean;
      stopped: boolean;
      owner: string;
    };

    expect(response).toMatchObject({ ok: true, stopped: true, owner: 'external' });
    expect(host.lastState().effects).toHaveLength(0);
    expect(host.lastElementHtml()).toBe('');
  });

  it('stop é idempotente: sem efeito, responde stopped false', async () => {
    const host = await loadLogic(createFakeHost());

    const response = (await host.callRequest('stop', {})) as { ok: boolean; stopped: boolean };

    expect(response).toMatchObject({ ok: true, stopped: false });
  });

  it('stop sem force não derruba o efeito do painel', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'setParams', params: { mode: 'strobe' } });
    await host.send({ type: 'startContinuous' });

    const response = (await host.callRequest('stop', { force: false })) as {
      stopped: boolean;
      owner: string;
    };

    expect(response).toMatchObject({ stopped: false, owner: 'ui' });
    expect(host.lastState().effects[0]).toMatchObject({ owner: 'ui' });
  });

  it('stop com force encerra qualquer dono', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'setParams', params: { mode: 'strobe' } });
    await host.send({ type: 'startContinuous' });

    const response = (await host.callRequest('stop', { force: true })) as { stopped: boolean };

    expect(response.stopped).toBe(true);
    expect(host.lastState().effects).toHaveLength(0);
  });

  it('desliga a trava de 3 Hz pela API, salva e libera frequências maiores', async () => {
    const host = await loadLogic(createFakeHost());

    const response = (await host.callRequest('safetyLock', { enabled: false })) as {
      ok: boolean;
      safetyLock: boolean;
    };

    expect(response).toEqual({ ok: true, safetyLock: false });
    expect(host.lastState().params.safetyLock).toBe(false);
    await host.advance(1000);
    expect(host.storageWrites.some((write) => write.key === 'pulsefx.settings')).toBe(true);

    const started = (await host.callRequest('start', {
      mode: 'strobe',
      frequency: 8,
      output: '0',
      layer: 5,
    })) as { effect: Record<string, unknown> };

    expect(started.effect).toMatchObject({ frequencyHz: 8, clamped: false });
  });

  it('religa a trava e volta a limitar o pedido a 3 Hz', async () => {
    const host = await loadLogic(createFakeHost());

    await host.callRequest('safetyLock', { enabled: false });
    await host.callRequest('safetyLock', { enabled: true });

    const started = (await host.callRequest('start', {
      mode: 'strobe',
      frequency: 8,
      output: '0',
      layer: 5,
    })) as { effect: Record<string, unknown> };

    expect(host.lastState().params.safetyLock).toBe(true);
    expect(started.effect).toMatchObject({ frequencyHz: 3, clamped: true });
  });

  it('recusa safetyLock sem enabled ou com valor inválido', async () => {
    const host = await loadLogic(createFakeHost());

    const missing = await expectStatus(host.callRequest('safetyLock', {}), 400);
    expect(missing.message).toContain('enabled');

    const invalid = await expectStatus(host.callRequest('safetyLock', { enabled: 'talvez' }), 400);
    expect(invalid.message).toContain('enabled');
  });

  it('state devolve efeitos, trava e a lista de saídas e camadas', async () => {
    const host = await loadLogic(createFakeHost());
    await host.callRequest('start', { mode: 'pulse', output: '1', layer: 2 });

    const response = (await host.callRequest('state')) as {
      ok: boolean;
      version: string;
      safetyLock: boolean;
      effects: Array<Record<string, unknown>>;
      outputs: Array<{ index: number; name: string }>;
      layers: Array<{ index: number }>;
    };

    expect(response.ok).toBe(true);
    expect(response.version).toBe('1.0.0');
    expect(response.safetyLock).toBe(true);
    expect(response.effects).toHaveLength(1);
    expect(response.outputs.map((output) => output.index)).toEqual([0, 1]);
    expect(response.layers.map((layer) => layer.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('aceita JSON em texto e query string, como num GET', async () => {
    const host = await loadLogic(createFakeHost());

    await host.callRequest('start', '{"mode":"pulse","frequency":4}');
    expect(host.lastState().effects[0]).toMatchObject({ mode: 'pulse', owner: 'external' });

    await host.callRequest('stop', 'output=0&layer=5');
    expect(host.lastState().effects).toHaveLength(0);
  });
});
