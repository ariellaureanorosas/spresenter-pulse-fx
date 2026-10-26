import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeHost, loadLogic } from '../helpers/fakeHost';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const STAGE_GUID = 'plugin-pulse-fx-stage';
const STAGE_ELEMENT = 'pulsefx-stage';

describe('overlay do palco', () => {
  it('aplica o stage transparente com o elemento estável e liga a camada', async () => {
    const host = await loadLogic(createFakeHost());

    await host.send({ type: 'applyOverlay' });

    expect(host.applications).toHaveLength(1);
    const { output, layer, presentation } = host.applications[0];
    expect(output).toBe('0');
    expect(layer).toBe(5);
    expect(presentation.asset?.guid).toBe(STAGE_GUID);
    expect(presentation.theme?.elements?.[0]?.id).toBe(STAGE_ELEMENT);
    expect(host.layerStates.at(-1)).toMatchObject({ output: '0', layer: 5, patch: { show: true } });

    const state = host.lastState();
    expect(state.applied).toBe(true);
    expect(state.layerOccupied).toBe(true);
    expect(state.layerOccupiedByUs).toBe(true);
    expect(host.toasts().at(-1)).toMatchObject({ level: 'success' });
  });

  it('não substitui conteúdo alheio sem confirmação', async () => {
    const host = createFakeHost();
    host.setForeignContent('0', 5);
    await loadLogic(host);

    await host.send({ type: 'applyOverlay' });

    expect(host.applications).toHaveLength(0);
    const [confirmation] = host.confirmations();
    expect(confirmation).toMatchObject({ action: 'apply', output: '0', layer: 5 });
    expect(String(confirmation.message)).toContain('substitui esse conteúdo');
  });

  it('aplica com force e avisa que o conteúdo anterior foi substituído', async () => {
    const host = createFakeHost();
    host.setForeignContent('0', 5);
    await loadLogic(host);

    await host.send({ type: 'applyOverlay', force: true });

    expect(host.applications).toHaveLength(1);
    expect(
      host
        .toasts()
        .some((toast) => toast.level === 'warning' && toast.message.includes('substituído')),
    ).toBe(true);
    expect(host.lastState().applied).toBe(true);
  });

  it('remove o overlay somente quando a camada ainda contém o nosso stage', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'applyOverlay' });

    await host.send({ type: 'removeOverlay' });

    expect(host.clears).toEqual([{ output: '0', layer: 5 }]);
    expect(host.lastState().applied).toBe(false);
    expect(host.lastState().layerOccupied).toBe(false);
  });

  it('não apaga conteúdo de terceiros ao remover o overlay', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'applyOverlay' });

    // Simula o app/outro plugin substituindo a camada depois da aplicação.
    host.setForeignContent('0', 5);

    await host.send({ type: 'removeOverlay' });

    expect(host.clears).toHaveLength(0);
    expect(host.lastState().applied).toBe(false);
    expect(host.toasts().some((toast) => toast.message.includes('nada foi apagado'))).toBe(true);
  });

  it('dispara um hit aplicando o overlay automaticamente', async () => {
    const host = await loadLogic(createFakeHost());

    await host.send({ type: 'fire' });

    expect(host.applications).toHaveLength(1);
    const html = host.lastElementHtml() ?? '';
    expect(html).toContain('@keyframes');
    expect(html).toContain('animation');

    const state = host.lastState();
    expect(state.effects).toHaveLength(1);
    expect(state.selectedEffect).toMatchObject({ owner: 'ui', mode: 'hit' });
    expect(host.toasts().some((toast) => toast.message.includes('aplicado automaticamente'))).toBe(
      true,
    );
  });

  it('limpa o HTML do hit depois da queda', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'fire' });

    await host.advance(600);

    expect(host.lastState().effects).toHaveLength(0);
    expect(host.lastElementHtml()).toBe('');
  });

  it('pede confirmação antes de disparar sobre conteúdo alheio', async () => {
    const host = createFakeHost();
    host.setForeignContent('0', 5);
    await loadLogic(host);

    await host.send({ type: 'fire' });

    expect(host.applications).toHaveLength(0);
    expect(host.elements).toHaveLength(0);
    expect(host.confirmations()[0]).toMatchObject({ action: 'run', output: '0', layer: 5 });
  });

  it('inicia e para um efeito contínuo no alvo selecionado', async () => {
    const host = await loadLogic(createFakeHost());
    await host.send({ type: 'setParams', params: { mode: 'strobe' } });

    await host.send({ type: 'startContinuous' });
    expect(host.lastState().selectedEffect).toMatchObject({ mode: 'strobe', owner: 'ui' });

    await host.send({ type: 'stop' });
    expect(host.lastState().selectedEffect).toBeNull();
    expect(host.lastState().effects).toHaveLength(0);
    expect(host.lastElementHtml()).toBe('');
  });

  it('para todos os efeitos inclusive os de automação, mantendo o overlay', async () => {
    const host = await loadLogic(createFakeHost());
    await host.execute('continuous', { output: '0', layer: 4, mode: 'pulse' });
    expect(host.lastState().effects).toHaveLength(1);

    await host.send({ type: 'stopAll' });

    expect(host.lastState().effects).toHaveLength(0);
    expect(
      host.lastState().appliedTargets.map((target) => `${target.output}:${target.layer}`),
    ).toEqual(['0:4']);
  });

  it('reporta erro quando o host recusa atualizar o efeito', async () => {
    const host = await loadLogic(createFakeHost({ setElementFails: true }));

    await host.send({ type: 'fire' });

    expect(host.errors().some((message) => message.includes('Falha ao atualizar o efeito'))).toBe(
      true,
    );
    expect(host.lastState().effects).toHaveLength(0);
  });
});
