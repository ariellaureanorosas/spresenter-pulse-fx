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
  it('registra start, stop e state antes de qualquer await', async () => {
    const host = await loadLogic(createFakeHost());

    expect([...host.requests.keys()].sort()).toEqual(['start', 'state', 'stop']);
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

  it('recusa modo inválido com 400', async () => {
    const host = await loadLogic(createFakeHost());

    const error = await expectStatus(host.callRequest('start', { mode: 'hit' }), 400);
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
