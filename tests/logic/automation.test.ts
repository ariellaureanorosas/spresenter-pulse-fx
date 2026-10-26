import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeHost, loadLogic } from '../helpers/fakeHost';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('automação', () => {
  it('registra a categoria e os três nós', async () => {
    const host = await loadLogic(createFakeHost());

    expect(host.categories).toEqual([{ key: 'pulse-fx', label: 'Pulse FX', icon: 'sparkles' }]);
    expect(host.nodes.map((node) => node.id)).toEqual(['hit', 'continuous', 'overlay']);
    expect(host.nodes.every((node) => node.category === 'pulse-fx')).toBe(true);
    expect(host.nodes.every((node) => typeof node.execute === 'function')).toBe(true);
  });

  it('dispara um hit no alvo informado e registra o dono', async () => {
    const host = await loadLogic(createFakeHost());

    await host.execute('hit', { output: '1', layer: 3, color: '#22d3ee' });

    expect(host.applications.at(-1)).toMatchObject({ output: '1', layer: 3 });
    const [effect] = host.lastState().effects;
    expect(effect).toMatchObject({ output: '1', layer: 3, mode: 'hit', owner: 'automation' });
    expect(host.lastState().appliedTargets.map((item) => `${item.output}:${item.layer}`)).toEqual([
      '1:3',
    ]);
  });

  it('usa a seleção salva quando output e layer não são informados', async () => {
    const host = await loadLogic(createFakeHost());

    await host.execute('hit', {});

    expect(host.applications.at(-1)).toMatchObject({ output: '0', layer: 5 });
  });

  it('aplica o overlay mesmo em camada ocupada e avisa', async () => {
    const host = createFakeHost();
    host.setForeignContent('0', 5);
    await loadLogic(host);

    await host.execute('hit', {});

    expect(host.applications).toHaveLength(1);
    expect(
      host
        .toasts()
        .some((toast) => toast.level === 'warning' && toast.message.includes('Automação')),
    ).toBe(true);
  });

  it('respeita a trava de segurança e emite o clamp da automação', async () => {
    const host = await loadLogic(createFakeHost());

    await host.execute('continuous', { output: '0', layer: 4, mode: 'pulse', frequency: 8 });

    const [effect] = host.lastState().effects;
    expect(effect).toMatchObject({ mode: 'pulse', owner: 'automation' });
    expect(host.clamps().at(-1)).toMatchObject({ source: 'automation', requestedHz: 8, hz: 3 });
  });

  it('desliga o efeito contínuo e limpa o HTML', async () => {
    const host = await loadLogic(createFakeHost());
    await host.execute('continuous', { output: '0', layer: 4, mode: 'strobe' });
    expect(host.lastState().effects).toHaveLength(1);

    await host.execute('continuous', { enabled: false, output: '0', layer: 4 });

    expect(host.lastState().effects).toHaveLength(0);
    expect(host.lastElementHtml()).toBe('');
    expect(host.toasts().some((toast) => toast.message.includes('desligado'))).toBe(true);
  });

  it('aplica e remove o overlay por automação', async () => {
    const host = await loadLogic(createFakeHost());

    await host.execute('overlay', { action: 'apply', output: '0', layer: 2 });
    expect(host.applications.at(-1)).toMatchObject({ output: '0', layer: 2 });

    await host.execute('overlay', { action: 'remove', output: '0', layer: 2 });
    expect(host.clears).toContainEqual({ output: '0', layer: 2 });
    expect(host.lastState().appliedTargets).toHaveLength(0);
  });

  it('não apaga conteúdo alheio ao remover por automação', async () => {
    const host = await loadLogic(createFakeHost());
    await host.execute('overlay', { action: 'apply', output: '0', layer: 2 });
    host.setForeignContent('0', 2);

    await host.execute('overlay', { action: 'remove', output: '0', layer: 2 });

    expect(host.clears).toHaveLength(0);
    expect(host.toasts().some((toast) => toast.message.includes('nada foi apagado'))).toBe(true);
  });

  it('ignora um alvo inexistente com aviso', async () => {
    const host = await loadLogic(createFakeHost());

    await host.execute('hit', { output: '9', layer: 1 });

    expect(host.applications).toHaveLength(0);
    expect(host.toasts().some((toast) => toast.message.includes('A saída 9'))).toBe(true);
  });
});
