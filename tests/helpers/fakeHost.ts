// Host falso do Spresenter para testes da thread de lógica.
//
// Reproduz só o contrato usado por `src/code.ts`: saídas, camadas, live,
// storage, ui e automação. Todas as chamadas são registradas para que os testes
// verifiquem efeitos colaterais (o que foi aplicado, limpo, salvo e enviado).
import { vi } from 'vitest';
import type { UiCommand } from '../../src/shared/messages';
import type { UiState } from '../../src/shared/types';

export interface FakeOutput {
  index: number;
  name: string;
  width?: number;
  height?: number;
  disabledLayers: number[];
}

export interface FakeLayer {
  index: number;
  name?: string;
}

export interface FakeHostOptions {
  outputs?: Array<Partial<FakeOutput> & { index: number }>;
  layers?: FakeLayer[];
  settings?: unknown;
  legacySettings?: unknown;
  /** `live.read` rejeita (camada não verificável). */
  readFails?: boolean;
  /** `live.apply` rejeita. */
  applyFails?: boolean;
  /** `live.clear` rejeita. */
  clearFails?: boolean;
  /** `live.setElement` rejeita. */
  setElementFails?: boolean;
  /** `storage.get` rejeita. */
  storageReadFails?: boolean;
  /** `storage.set` rejeita. */
  storageWriteFails?: boolean;
}

export interface LogicMessage {
  type: string;
  [key: string]: unknown;
}

interface AppliedPresentation {
  asset?: { guid?: string; type?: string; [key: string]: unknown };
  theme?: { elements?: Array<{ id?: string } | null>; [key: string]: unknown };
  [key: string]: unknown;
}

const DEFAULT_LAYERS: FakeLayer[] = [
  { index: 0, name: 'Fundo' },
  { index: 1, name: 'Mídia' },
  { index: 2, name: 'Bíblia' },
  { index: 3, name: 'Letras' },
  { index: 4, name: 'Avisos' },
  { index: 5, name: 'Sobreposição' },
];

const DEFAULT_OUTPUTS: FakeOutput[] = [
  { index: 0, name: 'Principal', width: 1920, height: 1080, disabledLayers: [] },
  { index: 1, name: 'Palco', width: 1280, height: 720, disabledLayers: [] },
];

export class FakeHost {
  readonly outputs: FakeOutput[];
  readonly layers: FakeLayer[];
  readonly contents = new Map<string, AppliedPresentation>();
  readonly applications: Array<{
    output: string;
    layer: number;
    presentation: AppliedPresentation;
  }> = [];
  readonly clears: Array<{ output: string; layer: number }> = [];
  readonly elements: Array<{
    output: string;
    layer: number;
    elementId: string;
    patch: Record<string, unknown>;
  }> = [];
  readonly layerStates: Array<{
    output: string;
    layer: number;
    patch: Record<string, unknown>;
  }> = [];
  readonly storage = new Map<string, unknown>();
  readonly storageWrites: Array<{ key: string; value: unknown }> = [];
  readonly messages: LogicMessage[] = [];
  readonly nodes: Array<Record<string, unknown>> = [];
  readonly categories: Array<Record<string, unknown>> = [];
  readonly listeners = new Map<string, Set<() => void>>();
  readonly api: Record<string, unknown>;

  private readonly options: FakeHostOptions;

  constructor(options: FakeHostOptions = {}) {
    this.options = options;
    this.outputs = (options.outputs ?? DEFAULT_OUTPUTS).map((output) => ({
      ...output,
      name: output.name ?? '',
      disabledLayers: [...(output.disabledLayers ?? [])],
    }));
    this.layers = (options.layers ?? DEFAULT_LAYERS).map((layer) => ({ ...layer }));
    if (options.settings !== undefined) this.storage.set('pulsefx.settings', options.settings);
    if (options.legacySettings !== undefined) {
      this.storage.set('com.spresenter.pulse-fx.settings.v1', options.legacySettings);
    }

    this.api = {
      manifest: { id: 'com.spresenter.pulse-fx', version: '1.0.0' },
      outputs: {
        list: async () => this.outputs.map((output) => ({ ...output })),
      },
      layers: {
        list: async () => this.layers.map((layer) => ({ ...layer })),
      },
      live: {
        read: async (output: string) => {
          if (this.options.readFails) throw new Error('live.read falhou');
          const max = this.layers.reduce((highest, layer) => Math.max(highest, layer.index), 0);
          return Array.from(
            { length: max + 1 },
            (_, layer) => this.contents.get(`${output}:${layer}`) ?? null,
          );
        },
        apply: async (output: string, layer: number, presentation: AppliedPresentation) => {
          if (this.options.applyFails) throw new Error('live.apply falhou');
          this.applications.push({ output, layer, presentation });
          this.contents.set(`${output}:${layer}`, presentation);
        },
        clear: async (output: string, layer: number) => {
          if (this.options.clearFails) throw new Error('live.clear falhou');
          this.clears.push({ output, layer });
          this.contents.delete(`${output}:${layer}`);
        },
        setElement: async (
          output: string,
          layer: number,
          elementId: string,
          patch: Record<string, unknown>,
        ) => {
          if (this.options.setElementFails) throw new Error('live.setElement falhou');
          this.elements.push({ output, layer, elementId, patch });
        },
        setState: async (output: string, layer: number, patch: Record<string, unknown>) => {
          this.layerStates.push({ output, layer, patch });
          return { show: true, opacity: 1, blend: 'normal', ...patch };
        },
      },
      storage: {
        get: async (key: string) => {
          if (this.options.storageReadFails) throw new Error('storage.get falhou');
          return this.storage.get(key);
        },
        set: async (key: string, value: unknown) => {
          if (this.options.storageWriteFails) throw new Error('storage.set falhou');
          this.storage.set(key, value);
          this.storageWrites.push({ key, value });
        },
      },
      ui: {
        onmessage: null as ((raw: unknown) => void) | null,
        postMessage: (event: LogicMessage) => {
          this.messages.push(JSON.parse(JSON.stringify(event)) as LogicMessage);
        },
      },
      automation: {
        registerCategory: (definition: Record<string, unknown>) => {
          this.categories.push(definition);
        },
        registerNode: (definition: Record<string, unknown>) => {
          this.nodes.push(definition);
        },
      },
      on: (event: string, listener: () => void) => {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)?.add(listener);
      },
    };
  }

  /** Instala conteúdo alheio (não-Pulse FX) em uma camada. */
  setForeignContent(output: string, layer: number): void {
    this.contents.set(`${output}:${layer}`, {
      title: 'Conteúdo alheio',
      asset: { type: 'presentation', guid: 'foreign-presentation' },
      theme: { elements: [{ id: 'something-else' }] },
    });
  }

  /** Remove o conteúdo de uma camada, como se o operador a tivesse limpado. */
  clearContent(output: string, layer: number): void {
    this.contents.delete(`${output}:${layer}`);
  }

  setReadFails(fails: boolean): void {
    this.options.readFails = fails;
  }

  async flush(turns = 120): Promise<void> {
    for (let index = 0; index < turns; index += 1) {
      await Promise.resolve();
    }
  }

  /** Dispara um comando da UI como o host faria. */
  async send(command: UiCommand): Promise<void> {
    const handler = this.api.ui as { onmessage: ((raw: unknown) => void) | null };
    if (!handler.onmessage) throw new Error('a lógica não registrou ui.onmessage');
    handler.onmessage(command);
    await this.flush();
  }

  /** Executa um nó de automação registrado pelo plugin. */
  async execute(nodeId: string, config: Record<string, unknown> = {}): Promise<void> {
    const node = this.nodes.find((item) => item.id === nodeId);
    if (!node) throw new Error(`nó de automação não registrado: ${nodeId}`);
    const execute = node.execute as (
      payload: unknown,
      config: Record<string, unknown>,
    ) => Promise<void>;
    await execute(null, config);
    await this.flush();
  }

  /** Emite um evento do host (`live` ou `state`). */
  async emit(event: string): Promise<void> {
    for (const listener of this.listeners.get(event) ?? []) listener();
    await this.flush();
  }

  /** Avança timers falsos e drena a fila (persistência, re-render, hit). */
  async advance(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    await this.flush();
  }

  states(): UiState[] {
    return this.messages
      .filter((message) => message.type === 'state')
      .map((message) => message.state as UiState);
  }

  lastState(): UiState {
    const states = this.states();
    const state = states.at(-1);
    if (!state) throw new Error('nenhum estado foi emitido pela lógica');
    return state;
  }

  toasts(): Array<{ level: string; message: string }> {
    return this.messages
      .filter((message) => message.type === 'toast')
      .map((message) => ({ level: String(message.level), message: String(message.message) }));
  }

  errors(): string[] {
    return this.messages
      .filter((message) => message.type === 'error')
      .map((message) => String(message.message));
  }

  confirmations(): Array<Record<string, unknown>> {
    return this.messages
      .filter((message) => message.type === 'confirmationRequired')
      .map((message) => message.request as Record<string, unknown>);
  }

  clamps(): Array<Record<string, unknown>> {
    return this.messages
      .filter((message) => message.type === 'clamped')
      .map((message) => message.clamp as Record<string, unknown>);
  }

  lastElementHtml(): string | undefined {
    const patch = this.elements.at(-1)?.patch;
    return typeof patch?.html === 'string' ? patch.html : undefined;
  }
}

export function createFakeHost(options: FakeHostOptions = {}): FakeHost {
  return new FakeHost(options);
}

/**
 * Carrega `src/code.ts` com um host novo. `vi.resetModules()` garante estado
 * limpo entre testes; o módulo roda o bootstrap no import.
 */
export async function loadLogic(host: FakeHost): Promise<FakeHost> {
  vi.resetModules();
  (globalThis as unknown as Record<string, unknown>).spresenter = host.api;
  await import('../../src/code');
  await host.flush();
  return host;
}
