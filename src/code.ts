// Pulse FX — thread de lógica.
//
// Roda isolada (sem DOM) e conversa com o app pelo global `spresenter`.
// A UI é apenas uma superfície: este arquivo é a fonte da verdade, aplica o
// overlay no palco, serializa TODAS as mutações (painel, automação e eventos) e
// persiste as preferências.

import { log } from './logic/logger';
import { parseUiCommand, type UiCommand } from './shared/messages';
import { buildOverlayHtml } from './shared/overlay';
import {
  clampFrequency,
  clampInfo,
  DEFAULT_PARAMS,
  formatHz,
  normalizeMode,
  normalizeParamsWithMeta,
} from './shared/params';
import { createSerialQueue } from './shared/queue';
import {
  findLayer,
  findOutput,
  isLayerDisabled,
  layerLabel,
  sanitizeLayer,
  sanitizeOutput,
  selectionLabel,
  sortLayers,
  sortOutputs,
  targetKey,
} from './shared/selection';
import {
  createSettings,
  LEGACY_STORAGE_KEY,
  type ParsedSettings,
  parseStoredSettings,
  STORAGE_KEY,
  serializeSettings,
} from './shared/storage';
import type {
  ActiveEffect,
  ClampInfo,
  EffectOwner,
  FxParams,
  LayerDto,
  OutputDto,
  PulseMode,
  Selection,
  ToastLevel,
  UiState,
} from './shared/types';

const ELEMENT_ID = 'pulsefx-stage';
const STAGE_ASSET_GUID = 'plugin-pulse-fx-stage';
const STAGE_TITLE = 'Pulse FX';

const PERSIST_DEBOUNCE_MS = 250;
const RERENDER_DEBOUNCE_MS = 45;
const PROBE_CACHE_MS = 800;
const EVENT_REFRESH_DEBOUNCE_MS = 180;

type HostPresentation = Parameters<typeof spresenter.live.apply>[2];
type HostAutomationNode = Parameters<typeof spresenter.automation.registerNode>[0];
type TimerHandle = ReturnType<typeof setTimeout>;

interface LayerProbe {
  status: 'ok' | 'error';
  occupied: boolean | null;
  ours: boolean;
  error?: string;
  readAt: number;
}

interface AppliedInfo {
  output: string;
  layer: number;
  appliedAt: number;
}

interface EffectRuntime {
  effect: ActiveEffect;
  params: FxParams;
  token: string;
  timer: TimerHandle | null;
}

type ConfirmationKind = 'occupied' | 'unverified';

// ── Estado da thread ──────────────────────────────────────────

const queue = createSerialQueue();

let params: FxParams = { ...DEFAULT_PARAMS };
let selection: Selection = { output: '0', layer: 0 };
let settingsHasSelection = false;

let outputs: OutputDto[] = [];
let layers: LayerDto[] = [];

const applied = new Map<string, AppliedInfo>();
const effects = new Map<string, EffectRuntime>();
let uiTargetKey: string | null = null;

let lastClamp: ClampInfo | null = null;
let revision = 0;
let ready = false;

const bootNotices: string[] = [];
let bootNoticesSent = false;

const probeCache = new Map<string, LayerProbe>();
const foreignNoticeKeys = new Set<string>();

let persistTimer: TimerHandle | null = null;
let persistChain: Promise<void> = Promise.resolve();
let settingsWritable = true;

let rerenderTimer: TimerHandle | null = null;
let rerenderUi = false;
let rerenderAll = false;

let envTimer: TimerHandle | null = null;
let eventsRegistered = false;

let renderSeq = 0;
let lastClampEventKey = '';
let lastClampEventAt = 0;

let initPromise: Promise<void> | null = null;
let uiBridgeSeen = false;

// ── Utilidades ────────────────────────────────────────────────

function later(fn: () => void, ms: number): TimerHandle | null {
  try {
    if (typeof setTimeout === 'function') return setTimeout(fn, ms);
  } catch {
    // sem timers: executa a continuação de forma síncrona
  }
  try {
    fn();
  } catch {
    // ignora
  }
  return null;
}

function cancelTimer(timer: TimerHandle | null): void {
  if (timer === null) return;
  try {
    if (typeof clearTimeout === 'function') clearTimeout(timer);
  } catch {
    // ignora
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  const text = String(error ?? '');
  return text || 'Erro desconhecido.';
}

function post(event: unknown): void {
  try {
    spresenter.ui.postMessage(event);
  } catch {
    // a UI pode estar fechada
  }
}

function postToast(level: ToastLevel, message: string): void {
  post({ type: 'toast', level, message });
}

function postError(error: unknown): void {
  const message = errorMessage(error);
  log.error(message);
  post({ type: 'error', message });
}

function makeRenderToken(): string {
  renderSeq = (renderSeq + 1) % 60_466_176;
  return `${Date.now().toString(36)}${renderSeq.toString(36)}`;
}

function isTargetDisabled(target: Selection): boolean {
  return isLayerDisabled(findOutput(outputs, target.output), target.layer);
}

function targetDescription(target: Selection): string {
  return selectionLabel(outputs, layers, target);
}

function invalidateProbe(output?: string, layer?: number): void {
  if (output === undefined || layer === undefined) {
    probeCache.clear();
    return;
  }
  probeCache.delete(targetKey(output, layer));
}

function markApplied(target: Selection, owner: EffectOwner): void {
  const key = targetKey(target.output, target.layer);
  applied.set(key, {
    output: target.output,
    layer: target.layer,
    appliedAt: Date.now(),
  });
  if (owner === 'ui') uiTargetKey = key;
}

// ── Palco / overlay ──────────────────────────────────────────

function buildStagePresentation(): HostPresentation {
  return {
    title: STAGE_TITLE,
    asset: { type: 'presentation', guid: STAGE_ASSET_GUID, title: STAGE_TITLE },
    theme: {
      title: STAGE_TITLE,
      css: {},
      elements: [
        {
          id: ELEMENT_ID,
          type: 'RECTANGLE',
          x: 0,
          y: 0,
          visible: true,
          css: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'transparent',
            overflow: 'hidden',
            'pointer-events': 'none',
          },
        },
      ],
    },
    props: {},
  };
}

async function probeLayer(target: Selection, force = false): Promise<LayerProbe> {
  const key = targetKey(target.output, target.layer);
  const cached = probeCache.get(key);
  if (!force && cached && Date.now() - cached.readAt < PROBE_CACHE_MS) {
    return cached;
  }

  let probe: LayerProbe;
  try {
    const liveLayers = await spresenter.live.read(target.output);
    const current = Array.isArray(liveLayers) ? (liveLayers[target.layer] ?? null) : null;
    const theme = current?.theme as { elements?: Array<{ id?: string } | null> } | undefined;
    const elements = Array.isArray(theme?.elements) ? theme?.elements : [];
    const ours =
      !!current &&
      current.asset?.guid === STAGE_ASSET_GUID &&
      elements.some((element) => element?.id === ELEMENT_ID);

    probe = {
      status: 'ok',
      occupied: current !== null && current !== undefined,
      ours,
      readAt: Date.now(),
    };
  } catch (error) {
    probe = {
      status: 'error',
      occupied: null,
      ours: false,
      error: errorMessage(error),
      readAt: Date.now(),
    };
  }

  probeCache.set(key, probe);
  return probe;
}

/**
 * Confere o palco recém-verificado. Se a camada foi substituída por conteúdo
 * alheio, esquece nosso overlay e encerra o efeito sem tocar no conteúdo.
 */
async function readSelectionProbe(force = false): Promise<LayerProbe> {
  const key = targetKey(selection.output, selection.layer);
  const probe = await probeLayer(selection, force);

  if (probe.status === 'ok') {
    if (probe.ours) {
      foreignNoticeKeys.delete(key);
      if (!applied.has(key)) {
        applied.set(key, {
          output: selection.output,
          layer: selection.layer,
          appliedAt: Date.now(),
        });
      }
      if (uiTargetKey === null) uiTargetKey = key;
    } else {
      const hadApplied = applied.has(key);
      if (hadApplied) {
        applied.delete(key);
        if (uiTargetKey === key) uiTargetKey = null;
        discardEffect(key);
        if (!foreignNoticeKeys.has(key)) {
          foreignNoticeKeys.add(key);
          postToast(
            'warning',
            'O overlay do Pulse FX não está mais na camada; o efeito foi encerrado.',
          );
        }
      }
    }
  }

  return probe;
}

async function ensureStage(
  target: Selection,
  owner: EffectOwner,
  allowUnverified: boolean,
): Promise<void> {
  const key = targetKey(target.output, target.layer);
  if (applied.has(key)) {
    if (owner === 'ui') uiTargetKey = key;
    return;
  }

  const probe = await probeLayer(target, true);
  if (probe.status === 'error' && !allowUnverified) {
    throw new Error('Não foi possível verificar a camada antes de aplicar o overlay.');
  }

  if (probe.status === 'ok' && probe.ours) {
    markApplied(target, owner);
    return;
  }

  await spresenter.live.apply(target.output, target.layer, buildStagePresentation());
  await spresenter.live.setState(target.output, target.layer, { show: true });
  invalidateProbe(target.output, target.layer);
  markApplied(target, owner);
}

async function setStageHtml(target: Selection, html: string, silent = false): Promise<boolean> {
  try {
    await spresenter.live.setElement(target.output, target.layer, ELEMENT_ID, { html });
    return true;
  } catch (error) {
    if (!silent) {
      postError(new Error(`Falha ao atualizar o efeito: ${errorMessage(error)}`));
    }
    return false;
  }
}

async function playEffect(
  target: Selection,
  mode: PulseMode,
  effectParams: FxParams,
  owner: EffectOwner,
): Promise<boolean> {
  const key = targetKey(target.output, target.layer);
  const normalized = normalizeParamsWithMeta(
    { ...effectParams, mode },
    effectParams.safetyLock,
  ).params;
  const token = makeRenderToken();
  const html = buildOverlayHtml(normalized, { token });

  const previous = effects.get(key);
  if (previous) cancelTimer(previous.timer);

  const wrote = await setStageHtml(target, html);
  if (!wrote) {
    // Se já havia um efeito, o timer antigo foi cancelado. Remove o registro
    // órfão e tenta limpar o palco para não deixar HTML preso na tela.
    if (previous) {
      discardEffect(key);
      await setStageHtml(target, '', true);
      await emitState();
    }
    return false;
  }

  const runtime: EffectRuntime = {
    effect: {
      output: target.output,
      layer: target.layer,
      mode,
      startedAt: Date.now(),
      owner,
    },
    params: normalized,
    token,
    timer: null,
  };

  if (mode === 'hit') {
    runtime.timer = later(() => {
      const current = effects.get(key);
      if (!current || current.token !== token) return;
      void queue.run(async () => {
        const still = effects.get(key);
        if (!still || still.token !== token) return;
        effects.delete(key);
        await setStageHtml(target, '', true);
        await emitState();
      });
    }, normalized.decayMs + 120);
  }

  effects.set(key, runtime);
  markApplied(target, owner);
  return true;
}

function discardEffect(key: string): void {
  const runtime = effects.get(key);
  if (!runtime) return;
  cancelTimer(runtime.timer);
  effects.delete(key);
}

async function stopRuntime(key: string, clearHtml: boolean): Promise<boolean> {
  const runtime = effects.get(key);
  if (!runtime) return false;
  cancelTimer(runtime.timer);
  effects.delete(key);
  if (clearHtml) {
    await setStageHtml({ output: runtime.effect.output, layer: runtime.effect.layer }, '', true);
  }
  return true;
}

// ── Confirmações ─────────────────────────────────────────────

function confirmationMessage(
  action: 'apply' | 'run' | 'move',
  kind: ConfirmationKind,
  target: Selection,
): string {
  const place = targetDescription(target);
  if (kind === 'unverified') {
    if (action === 'move') {
      return `Não foi possível verificar o conteúdo de ${place}. Mover o overlay para essa camada pode substituir conteúdo existente.`;
    }
    return `Não foi possível verificar o conteúdo de ${place}. Continuar pode substituir conteúdo existente nessa camada.`;
  }

  if (action === 'move') {
    return `Mover o overlay para ${place} vai substituir o conteúdo que já está nessa camada. O conteúdo anterior não será restaurado ao remover o overlay.`;
  }
  if (action === 'run') {
    return `Para disparar sem overlay aplicado, o Pulse FX precisa ocupar ${place}, que já tem conteúdo. O conteúdo atual será substituído e não será restaurado ao remover o overlay.`;
  }
  return `A camada ${place} já tem conteúdo. Aplicar o Pulse FX substitui esse conteúdo, e ele não será restaurado ao remover o overlay.`;
}

function requestConfirmation(
  action: 'apply' | 'run' | 'move',
  kind: ConfirmationKind,
  target: Selection,
): void {
  post({
    type: 'confirmationRequired',
    request: {
      action,
      message: confirmationMessage(action, kind, target),
      output: target.output,
      layer: target.layer,
    },
  });
}

// ── Clamp / persistência ─────────────────────────────────────

function noteClamp(clamp: ReturnType<typeof clampFrequency>, source: ClampInfo['source']): void {
  const meaningful = clamp.clamped || clamp.invalid;
  if (meaningful) {
    lastClamp = clampInfo(clamp, source);
  } else if (source === 'ui' || source === 'storage') {
    lastClamp = null;
  }

  if (!meaningful || source !== 'automation') return;

  const signature = `${source}:${clamp.requestedHz}:${clamp.hz}:${clamp.cause ?? 'min'}:${clamp.invalid}`;
  const now = Date.now();
  if (signature !== lastClampEventKey || now - lastClampEventAt > 4000) {
    lastClampEventKey = signature;
    lastClampEventAt = now;
    post({ type: 'clamped', clamp: { ...clamp, source, at: now } });
  }
}

function schedulePersist(): void {
  if (persistTimer !== null) cancelTimer(persistTimer);
  persistTimer = later(() => {
    persistTimer = null;
    persistNow();
  }, PERSIST_DEBOUNCE_MS);
}

function persistNow(): void {
  if (!settingsWritable) return;
  const payload = serializeSettings(createSettings(params, selection, settingsHasSelection));
  persistChain = persistChain.then(async () => {
    try {
      await spresenter.storage.set(STORAGE_KEY, payload);
    } catch (error) {
      log.error('Falha ao salvar preferências:', errorMessage(error));
    }
  });
}

// ── Estado para a UI ─────────────────────────────────────────

async function emitState(): Promise<void> {
  const probe = await readSelectionProbe(false);
  const key = targetKey(selection.output, selection.layer);
  const selectedRuntime = effects.get(key);

  const effectList = [...effects.values()]
    .map((runtime) => ({ ...runtime.effect }))
    .sort((a, b) => a.startedAt - b.startedAt);

  const appliedTargets = [...applied.values()]
    .map((item) => ({
      output: item.output,
      layer: item.layer,
      effect: effects.get(targetKey(item.output, item.layer))?.effect.mode ?? null,
    }))
    .sort((a, b) => (a.output === b.output ? a.layer - b.layer : a.output.localeCompare(b.output)));

  const state: UiState = {
    revision: ++revision,
    params: { ...params },
    selection: { ...selection },
    applied: applied.has(key),
    layerOccupied: probe.status === 'ok' ? probe.occupied : null,
    layerOccupiedByUs: probe.status === 'ok' ? probe.ours : false,
    layerDisabled: isTargetDisabled(selection),
    effects: effectList,
    selectedEffect: selectedRuntime ? { ...selectedRuntime.effect } : null,
    appliedTargets,
    lastClamp,
    ready,
    outputs: outputs.map((output) => ({
      ...output,
      disabledLayers: [...output.disabledLayers],
    })),
    layers: layers.map((layer) => ({ ...layer })),
  };

  post({ type: 'state', state });
}

function flushBootNotices(): void {
  if (bootNoticesSent) return;
  bootNoticesSent = true;
  for (const notice of bootNotices.splice(0)) {
    postToast('info', notice);
  }
}

// ── Carregamento / ambiente ──────────────────────────────────

async function loadSettings(): Promise<void> {
  let parsed: ParsedSettings | null = null;
  let canOverwrite = true;

  try {
    const rawCurrent = await spresenter.storage.get(STORAGE_KEY);
    if (rawCurrent !== undefined && rawCurrent !== null) {
      const attempt = parseStoredSettings(rawCurrent);
      if (attempt.unsafeToOverwrite) {
        canOverwrite = false;
        settingsWritable = false;
        parsed = attempt;
        bootNotices.push(...attempt.issues);
      } else if (attempt.source === 'default' && attempt.issues.length > 0) {
        bootNotices.push(...attempt.issues);
      } else {
        parsed = attempt;
      }
    }
  } catch (error) {
    bootNotices.push('Não foi possível ler as preferências; usando os padrões.');
    log.error('storage.get:', errorMessage(error));
  }

  if (!parsed) {
    try {
      const rawLegacy = await spresenter.storage.get(LEGACY_STORAGE_KEY);
      if (rawLegacy !== undefined && rawLegacy !== null) {
        const legacy = parseStoredSettings(rawLegacy, { legacy: true });
        parsed = legacy;
        if (legacy.source === 'legacy') {
          bootNotices.push('Preferências de uma versão anterior foram migradas.');
          if (canOverwrite) {
            try {
              await spresenter.storage.set(STORAGE_KEY, serializeSettings(legacy.settings));
            } catch (error) {
              log.error('migração:', errorMessage(error));
            }
          }
        }
      }
    } catch (error) {
      log.error('storage.get legado:', errorMessage(error));
    }
  }

  if (!parsed) {
    parsed = parseStoredSettings(undefined);
  }

  params = { ...parsed.settings.params };
  selection = {
    output: parsed.settings.output,
    layer: parsed.settings.layer,
  };
  settingsHasSelection = parsed.settings.hasSelection;

  if (parsed.issues.length > 0) {
    for (const issue of parsed.issues) {
      if (!bootNotices.includes(issue)) bootNotices.push(issue);
    }
  }

  const clamp = clampFrequency(params.frequencyHz, params.safetyLock);
  if (clamp.clamped || clamp.invalid) {
    lastClamp = clampInfo(clamp, 'storage');
  }

  if (parsed.migrated && parsed.source === 'current' && canOverwrite) {
    try {
      await spresenter.storage.set(
        STORAGE_KEY,
        serializeSettings(createSettings(params, selection, settingsHasSelection)),
      );
    } catch (error) {
      log.error('reescrita de schema:', errorMessage(error));
    }
  }
}

async function reloadOutputs(): Promise<void> {
  try {
    const [hostOutputs, hostLayers] = await Promise.all([
      spresenter.outputs.list(),
      spresenter.layers.list(),
    ]);

    outputs = sortOutputs(
      hostOutputs.map((output) => ({
        index: Number(output.index) || 0,
        name: String(output.name ?? ''),
        width:
          typeof output.width === 'number' && Number.isFinite(output.width)
            ? output.width
            : undefined,
        height:
          typeof output.height === 'number' && Number.isFinite(output.height)
            ? output.height
            : undefined,
        disabledLayers: Array.isArray(output.disabledLayers)
          ? output.disabledLayers
              .map((layer) => Number(layer))
              .filter((layer) => Number.isInteger(layer) && layer >= 0)
          : [],
      })),
    );

    layers = sortLayers(
      hostLayers.map((layer) => ({
        index: Number(layer.index) || 0,
        name: typeof layer.name === 'string' ? layer.name : undefined,
      })),
    );
  } catch (error) {
    postError(new Error(`Não foi possível listar as saídas: ${errorMessage(error)}`));
  }
}

async function refreshEnvironment(emit: boolean): Promise<void> {
  await reloadOutputs();

  if (outputs.length === 0) {
    if (emit) await emitState();
    return;
  }

  const foundOutput =
    findOutput(outputs, selection.output) ??
    outputs.find((output) => !output.disabledLayers.includes(selection.layer)) ??
    outputs[0];
  const foundLayer =
    layers.length > 0
      ? (findLayer(layers, selection.layer) ??
        findLayer(layers, highestAvailableLayerSafe(foundOutput)) ??
        layers[0])
      : undefined;
  const desiredLayer =
    !settingsHasSelection && layers.length > 0
      ? highestAvailableLayerSafe(foundOutput)
      : foundLayer && !isLayerDisabled(foundOutput, foundLayer.index)
        ? foundLayer.index
        : highestAvailableLayerSafe(foundOutput);

  const nextSelection = {
    output: String(foundOutput.index),
    layer: desiredLayer,
  };

  const keyBefore = targetKey(selection.output, selection.layer);
  const keyAfter = targetKey(nextSelection.output, nextSelection.layer);
  const moved = keyBefore !== keyAfter || !settingsHasSelection;
  const shouldPersist = !settingsHasSelection || keyBefore !== keyAfter;

  if (moved && keyBefore !== keyAfter && applied.has(keyBefore)) {
    const oldTarget: Selection = { ...selection };
    const oldProbe = await probeLayer(oldTarget, true);
    discardEffect(keyBefore);
    applied.delete(keyBefore);
    invalidateProbe(oldTarget.output, oldTarget.layer);
    if (uiTargetKey === keyBefore) uiTargetKey = null;

    let notice = 'A saída ou camada selecionada não está mais disponível; o efeito foi encerrado.';
    if (oldProbe.status === 'ok' && oldProbe.ours) {
      try {
        await spresenter.live.clear(oldTarget.output, oldTarget.layer);
        notice =
          'A saída ou camada selecionada não está mais disponível; o overlay anterior foi removido.';
      } catch (error) {
        log.error('limpeza de alvo antigo:', errorMessage(error));
        notice =
          'A saída ou camada selecionada não está mais disponível; o efeito foi encerrado, mas o overlay anterior não pôde ser limpo.';
      }
    } else if (oldProbe.status === 'error') {
      notice =
        'A saída ou camada selecionada não está mais disponível; o efeito foi encerrado, mas não foi possível verificar a camada anterior.';
    } else if (oldProbe.occupied) {
      notice =
        'A saída ou camada selecionada não está mais disponível; o efeito foi encerrado e a camada anterior não foi limpa.';
    }

    postToast('warning', notice);
  }

  selection = nextSelection;
  settingsHasSelection = true;
  invalidateProbe(selection.output, selection.layer);
  await readSelectionProbe(true);
  if (shouldPersist) schedulePersist();

  if (emit) await emitState();
}

function highestAvailableLayerSafe(output: OutputDto | undefined): number {
  const disabled = new Set(output?.disabledLayers ?? []);
  const indexes = layers
    .map((layer) => layer.index)
    .filter((index) => Number.isInteger(index) && index >= 0);
  const enabled = indexes.filter((index) => !disabled.has(index));
  if (enabled.length > 0) return Math.max(...enabled);
  if (indexes.length > 0) return Math.max(...indexes);
  return 0;
}

// ── Ações da UI ──────────────────────────────────────────────

function targetIsUsable(target: Selection): boolean {
  if (outputs.length === 0) {
    postToast('warning', 'Nenhuma saída disponível no Spresenter.');
    return false;
  }
  if (!findOutput(outputs, target.output)) {
    postToast('warning', `A saída ${target.output} não está disponível.`);
    return false;
  }
  if (layers.length > 0 && !findLayer(layers, target.layer)) {
    postToast('warning', `A camada ${target.layer} não está disponível.`);
    return false;
  }
  if (isTargetDisabled(target)) {
    postToast(
      'warning',
      `A camada ${layerLabel(layers, target.layer)} está desativada nesta saída.`,
    );
    return false;
  }
  return true;
}

async function ensureTargetForRun(target: Selection, force: boolean): Promise<boolean> {
  const key = targetKey(target.output, target.layer);
  if (applied.has(key)) return true;

  const probe = await probeLayer(target, true);
  if (probe.status === 'error' && !force) {
    requestConfirmation('run', 'unverified', target);
    return false;
  }
  if (probe.status === 'ok' && probe.occupied && !probe.ours && !force) {
    requestConfirmation('run', 'occupied', target);
    return false;
  }

  if (probe.status === 'error') {
    postToast('warning', 'Camada não verificada; o overlay será aplicado mesmo assim.');
  } else if (probe.occupied && !probe.ours) {
    postToast('warning', 'O conteúdo da camada foi substituído pelo overlay do Pulse FX.');
  }

  try {
    await ensureStage(target, 'ui', true);
  } catch (error) {
    postError(new Error(`Não foi possível aplicar o overlay: ${errorMessage(error)}`));
    return false;
  }

  postToast('info', `Overlay aplicado automaticamente em ${targetDescription(target)}.`);
  return true;
}

async function handleApply(force: boolean): Promise<void> {
  const target = { ...selection };
  if (!targetIsUsable(target)) return;

  const key = targetKey(target.output, target.layer);
  if (applied.has(key)) {
    postToast('info', 'O overlay já está aplicado nesta camada.');
    await emitState();
    return;
  }

  const probe = await probeLayer(target, true);
  if (probe.status === 'error' && !force) {
    requestConfirmation('apply', 'unverified', target);
    return;
  }
  if (probe.status === 'ok' && probe.occupied && !probe.ours && !force) {
    requestConfirmation('apply', 'occupied', target);
    return;
  }

  if (probe.status === 'error') {
    postToast('warning', 'Camada não verificada; o overlay será aplicado mesmo assim.');
  } else if (probe.occupied && !probe.ours) {
    postToast('warning', 'O conteúdo anterior da camada foi substituído pelo overlay.');
  }

  try {
    await ensureStage(target, 'ui', true);
  } catch (error) {
    postError(new Error(`Não foi possível aplicar o overlay: ${errorMessage(error)}`));
    return;
  }

  postToast('success', `Overlay aplicado em ${targetDescription(target)}.`);
  await emitState();
}

async function handleRemove(): Promise<void> {
  const target = { ...selection };
  const key = targetKey(target.output, target.layer);

  if (!applied.has(key)) {
    postToast('info', 'Nenhum overlay do Pulse FX aplicado nesta camada.');
    await emitState();
    return;
  }

  const probe = await probeLayer(target, true);
  if (probe.status === 'error') {
    discardEffect(key);
    postToast(
      'error',
      'Não foi possível verificar a camada; o overlay não foi removido para não apagar conteúdo alheio.',
    );
    await emitState();
    return;
  }

  if (!probe.occupied) {
    discardEffect(key);
    applied.delete(key);
    if (uiTargetKey === key) uiTargetKey = null;
    invalidateProbe(target.output, target.layer);
    await emitState();
    postToast('info', 'Overlay removido.');
    return;
  }

  if (!probe.ours) {
    discardEffect(key);
    applied.delete(key);
    if (uiTargetKey === key) uiTargetKey = null;
    invalidateProbe(target.output, target.layer);
    await emitState();
    postToast(
      'warning',
      'A camada já tinha outro conteúdo; nada foi apagado. O Pulse FX apenas parou de controlá-la.',
    );
    return;
  }

  discardEffect(key);
  try {
    await spresenter.live.clear(target.output, target.layer);
  } catch (error) {
    postError(new Error(`Não foi possível limpar a camada: ${errorMessage(error)}`));
    await emitState();
    return;
  }

  applied.delete(key);
  if (uiTargetKey === key) uiTargetKey = null;
  invalidateProbe(target.output, target.layer);
  await emitState();
  postToast('success', `Overlay removido de ${targetDescription(target)}.`);
}

async function handleFire(force: boolean): Promise<void> {
  const target = { ...selection };
  if (!targetIsUsable(target)) return;
  if (!(await ensureTargetForRun(target, force))) return;

  const ok = await playEffect(target, 'hit', params, 'ui');
  if (ok) await emitState();
}

async function handleStartContinuous(force: boolean): Promise<void> {
  const target = { ...selection };
  if (!targetIsUsable(target)) return;

  if (params.mode === 'hit') {
    postToast('warning', 'Escolha Strobe ou Pulse para iniciar um efeito contínuo.');
    return;
  }

  if (!(await ensureTargetForRun(target, force))) return;

  const ok = await playEffect(target, params.mode, params, 'ui');
  if (ok) await emitState();
}

async function handleStop(): Promise<void> {
  const key = targetKey(selection.output, selection.layer);
  if (!effects.has(key)) {
    postToast('info', 'Nenhum efeito em execução nesta camada.');
    await emitState();
    return;
  }
  await stopRuntime(key, true);
  await emitState();
  postToast('info', 'Efeito parado.');
}

async function handleStopAll(): Promise<void> {
  if (rerenderTimer !== null) {
    cancelTimer(rerenderTimer);
    rerenderTimer = null;
  }
  rerenderUi = false;
  rerenderAll = false;

  const count = effects.size;
  const targets = new Map<string, Selection>();

  for (const [key, runtime] of [...effects.entries()]) {
    cancelTimer(runtime.timer);
    effects.delete(key);
    targets.set(key, {
      output: runtime.effect.output,
      layer: runtime.effect.layer,
    });
  }

  for (const [key, item] of applied) {
    if (!targets.has(key)) {
      targets.set(key, { output: item.output, layer: item.layer });
    }
  }

  for (const target of targets.values()) {
    await setStageHtml(target, '', true);
  }

  await emitState();
  postToast(
    count > 0 ? 'success' : 'info',
    count > 0 ? `Efeitos parados: ${count}.` : 'Nada em execução.',
  );
}

async function handleSelectTarget(command: {
  output: string;
  layer: number;
  force?: boolean;
}): Promise<void> {
  const target: Selection = {
    output: sanitizeOutput(command.output, selection.output),
    layer: sanitizeLayer(command.layer, selection.layer),
  };
  if (!targetIsUsable(target)) return;

  const newKey = targetKey(target.output, target.layer);
  const oldKey = targetKey(selection.output, selection.layer);

  if (newKey === oldKey) {
    await emitState();
    return;
  }

  const oldUiKey = uiTargetKey;
  const moving = oldUiKey !== null && oldUiKey !== newKey && applied.has(oldUiKey);

  if (!moving) {
    selection = target;
    invalidateProbe(target.output, target.layer);
    schedulePersist();
    await emitState();
    return;
  }

  const oldApplied = applied.get(oldUiKey);
  if (!oldApplied) {
    selection = target;
    schedulePersist();
    await emitState();
    return;
  }
  const oldTarget: Selection = {
    output: oldApplied.output,
    layer: oldApplied.layer,
  };
  const oldRuntime = effects.get(oldUiKey);
  const wasRunning = oldRuntime
    ? {
        mode: oldRuntime.effect.mode,
        owner: oldRuntime.effect.owner,
        startedAt: oldRuntime.effect.startedAt,
        params: { ...oldRuntime.params },
      }
    : null;

  const probe = await probeLayer(target, true);
  if (probe.status === 'error' && !command.force) {
    requestConfirmation('move', 'unverified', target);
    return;
  }
  if (probe.status === 'ok' && probe.occupied && !probe.ours && !command.force) {
    requestConfirmation('move', 'occupied', target);
    return;
  }

  if (probe.status === 'error') {
    postToast('warning', 'Camada de destino não verificada; movendo mesmo assim.');
  } else if (probe.occupied && !probe.ours) {
    postToast('warning', 'O conteúdo da camada de destino foi substituído pelo overlay.');
  }

  try {
    await ensureStage(target, 'ui', true);
  } catch (error) {
    postError(new Error(`Não foi possível mover o overlay: ${errorMessage(error)}`));
    return;
  }

  const oldProbe = await probeLayer(oldTarget, true);
  discardEffect(oldUiKey);

  if (oldProbe.status === 'ok' && oldProbe.ours) {
    try {
      await spresenter.live.clear(oldTarget.output, oldTarget.layer);
    } catch (error) {
      postToast(
        'warning',
        `O overlay novo foi aplicado, mas não foi possível limpar ${targetDescription(oldTarget)}: ${errorMessage(error)}`,
      );
    }
  } else if (oldProbe.status === 'error') {
    postToast(
      'warning',
      `O overlay novo foi aplicado, mas não foi possível verificar ${targetDescription(
        oldTarget,
      )}; a camada antiga não foi limpa.`,
    );
  } else if (oldProbe.status === 'ok' && oldProbe.occupied) {
    postToast('warning', 'A camada antiga já tinha outro conteúdo; ela não foi limpa.');
  }

  applied.delete(oldUiKey);
  invalidateProbe(oldTarget.output, oldTarget.layer);
  invalidateProbe(target.output, target.layer);
  selection = target;
  uiTargetKey = newKey;
  markApplied(target, 'ui');
  schedulePersist();

  if (wasRunning && wasRunning.owner === 'ui') {
    const stillAlive =
      wasRunning.mode !== 'hit' ||
      Date.now() - wasRunning.startedAt < wasRunning.params.decayMs + 120;
    if (stillAlive) {
      await playEffect(
        target,
        wasRunning.mode,
        wasRunning.mode === 'hit' ? { ...wasRunning.params, mode: 'hit' } : params,
        'ui',
      );
    }
  }

  await emitState();
  postToast('info', `Overlay movido para ${targetDescription(target)}.`);
}

function hasEffectParamsChanged(previous: FxParams, next: FxParams): boolean {
  return (
    previous.color !== next.color ||
    previous.intensity !== next.intensity ||
    previous.decayMs !== next.decayMs ||
    previous.frequencyHz !== next.frequencyHz ||
    previous.flashWidth !== next.flashWidth ||
    previous.thickness !== next.thickness ||
    previous.softness !== next.softness ||
    previous.target !== next.target
  );
}

function scheduleRerender(ui: boolean, all: boolean): void {
  rerenderUi = rerenderUi || ui;
  rerenderAll = rerenderAll || all;

  if (rerenderTimer !== null) cancelTimer(rerenderTimer);
  rerenderTimer = later(() => {
    rerenderTimer = null;
    const runUi = rerenderUi;
    const runAll = rerenderAll;
    rerenderUi = false;
    rerenderAll = false;
    void queue.run(async () => {
      await rerenderEffects(runUi, runAll);
      await emitState();
    });
  }, RERENDER_DEBOUNCE_MS);
}

async function rerenderEffects(ui: boolean, all: boolean): Promise<void> {
  const snapshot = [...effects.entries()].map(([key, runtime]) => ({
    key,
    token: runtime.token,
    effect: { ...runtime.effect },
    params: { ...runtime.params },
  }));

  for (const item of snapshot) {
    const current = effects.get(item.key);
    if (!current || current.token !== item.token) continue;
    if (item.effect.owner === 'ui' && !ui) continue;
    if (item.effect.owner === 'automation' && !all) continue;
    // Hit é disparo único: re-renderizar aqui reiniciaria a animação do zero, e
    // qualquer ajuste de slider viraria um novo flash. A queda em curso termina
    // com os parâmetros do disparo; os novos valem do próximo em diante.
    if (item.effect.mode === 'hit') continue;

    const target: Selection = {
      output: item.effect.output,
      layer: item.effect.layer,
    };

    if (item.effect.owner === 'ui') {
      await playEffect(target, item.effect.mode, { ...params, mode: item.effect.mode }, 'ui');
    } else {
      const clamp = clampFrequency(item.params.frequencyHz, params.safetyLock);
      if (clamp.clamped || clamp.invalid) noteClamp(clamp, 'automation');
      await playEffect(
        target,
        item.effect.mode,
        {
          ...item.params,
          frequencyHz: clamp.hz,
          safetyLock: params.safetyLock,
          mode: item.effect.mode,
        },
        'automation',
      );
    }
  }
}

async function applyParamEffects(previous: FxParams, next: FxParams): Promise<void> {
  const uiRuntimes = [...effects.entries()].filter(([, runtime]) => runtime.effect.owner === 'ui');

  if (previous.mode !== next.mode) {
    if (next.mode === 'hit' || previous.mode === 'hit') {
      if (uiRuntimes.length > 0) {
        for (const [key] of uiRuntimes) {
          await stopRuntime(key, true);
        }
        postToast(
          'info',
          next.mode === 'hit'
            ? 'Modo Hit selecionado; o efeito contínuo foi encerrado.'
            : 'O efeito anterior foi encerrado. Use Iniciar para começar o novo modo.',
        );
      }
    } else if (uiRuntimes.length > 0) {
      scheduleRerender(true, false);
    }
  } else if (hasEffectParamsChanged(previous, next) && uiRuntimes.length > 0) {
    scheduleRerender(true, false);
  }

  if (!previous.safetyLock && next.safetyLock) {
    const automationNeedsClamp = [...effects.values()].some(
      (runtime) =>
        runtime.effect.owner === 'automation' &&
        (clampFrequency(runtime.params.frequencyHz, true).clamped ||
          clampFrequency(runtime.params.frequencyHz, true).invalid),
    );
    if (automationNeedsClamp) scheduleRerender(false, true);
  }
}

async function handleSetParams(patch: Partial<FxParams>): Promise<void> {
  const previous = params;
  const merged: Record<string, unknown> = { ...params };
  const allowed = new Set<keyof FxParams>([
    'mode',
    'color',
    'target',
    'intensity',
    'decayMs',
    'frequencyHz',
    'flashWidth',
    'thickness',
    'softness',
    'safetyLock',
  ]);
  for (const key of Object.keys(patch) as Array<keyof FxParams>) {
    if (allowed.has(key)) merged[key] = patch[key];
  }

  const normalized = normalizeParamsWithMeta(merged);
  const next = normalized.params;

  const frequencyTouched = patch.frequencyHz !== undefined;
  const safetyRaised = !previous.safetyLock && next.safetyLock;

  if (frequencyTouched) {
    noteClamp(clampFrequency(patch.frequencyHz, next.safetyLock), 'ui');
  } else if (safetyRaised && previous.frequencyHz > next.frequencyHz + 0.001) {
    noteClamp(clampFrequency(previous.frequencyHz, true), 'ui');
  } else if (patch.safetyLock !== undefined) {
    noteClamp(clampFrequency(next.frequencyHz, next.safetyLock), 'ui');
  }

  params = next;
  schedulePersist();
  await applyParamEffects(previous, next);
  await emitState();
}

async function handleRestoreDefaults(): Promise<void> {
  const previous = params;
  const next = normalizeParamsWithMeta(DEFAULT_PARAMS).params;
  params = next;
  lastClamp = null;
  schedulePersist();
  await applyParamEffects(previous, next);
  await emitState();
}

// ── Automação ────────────────────────────────────────────────

interface AutomationConfig {
  [key: string]: unknown;
}

function firstDefined(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function resolveAutomationTarget(config: AutomationConfig): Selection | null {
  const rawOutput = firstDefined(config.output);
  const output =
    rawOutput === undefined ? selection.output : sanitizeOutput(rawOutput, selection.output);

  const rawLayer = firstDefined(config.layer);
  let layer = selection.layer;
  if (rawLayer !== undefined) {
    const numeric = Number(rawLayer);
    if (Number.isFinite(numeric) && numeric >= 0) layer = sanitizeLayer(numeric, selection.layer);
  }

  const target = { output, layer };
  if (!targetIsUsable(target)) return null;
  return target;
}

function automationParams(config: AutomationConfig, mode: PulseMode): FxParams {
  // Nós de automação têm parâmetros próprios: campos não informados usam os
  // padrões do plugin, não o estado atual do painel. A trava, porém, é uma
  // configuração global e vale para o painel e para a automação.
  const merged: Record<string, unknown> = {
    ...DEFAULT_PARAMS,
    safetyLock: params.safetyLock,
  };
  const fields: Array<keyof FxParams> = [
    'color',
    'target',
    'intensity',
    'decayMs',
    'frequencyHz',
    'flashWidth',
    'thickness',
    'softness',
  ];
  for (const field of fields) {
    const value = firstDefined(config[field]);
    if (value !== undefined) merged[field] = value;
  }
  const frequency = firstDefined(config.frequency);
  if (frequency !== undefined) merged.frequencyHz = frequency;
  merged.mode = mode;
  const { params: normalized, clamp } = normalizeParamsWithMeta(merged);
  noteClamp(clamp, 'automation');
  return normalized;
}

async function prepareAutomationTarget(target: Selection): Promise<boolean> {
  const key = targetKey(target.output, target.layer);
  if (applied.has(key)) return true;

  const probe = await probeLayer(target, true);
  if (probe.status === 'error') {
    postToast('warning', 'Automação: camada não verificada; aplicando mesmo assim.');
  } else if (probe.occupied && !probe.ours) {
    postToast(
      'warning',
      `Automação: o conteúdo de ${targetDescription(target)} foi substituído pelo overlay.`,
    );
  }

  try {
    await ensureStage(target, 'automation', true);
    return true;
  } catch (error) {
    postError(new Error(`Automação: falha ao aplicar overlay: ${errorMessage(error)}`));
    return false;
  }
}

async function automationHit(config: AutomationConfig): Promise<void> {
  const target = resolveAutomationTarget(config);
  if (!target) return;
  if (!(await prepareAutomationTarget(target))) return;

  const effectParams = automationParams(config, 'hit');
  await playEffect(target, 'hit', effectParams, 'automation');
  await emitState();
}

async function automationContinuous(config: AutomationConfig): Promise<void> {
  const target = resolveAutomationTarget(config);
  if (!target) return;

  const enabled = config.enabled !== false && String(config.enabled) !== 'false';
  const key = targetKey(target.output, target.layer);

  if (!enabled) {
    const stopped = await stopRuntime(key, true);
    await emitState();
    if (stopped) postToast('info', 'Automação: efeito contínuo desligado.');
    return;
  }

  const mode: PulseMode = normalizeMode(config.mode) === 'pulse' ? 'pulse' : 'strobe';
  if (!(await prepareAutomationTarget(target))) return;

  const effectParams = automationParams(config, mode);
  await playEffect(target, mode, effectParams, 'automation');
  await emitState();
}

async function automationOverlay(config: AutomationConfig): Promise<void> {
  const action = String(config.action ?? 'apply')
    .trim()
    .toLowerCase();
  const target = resolveAutomationTarget(config);
  if (!target) return;

  if (action === 'remove' || action === 'remover' || action === 'clear' || action === 'limpar') {
    const key = targetKey(target.output, target.layer);
    const probe = await probeLayer(target, true);

    if (probe.status === 'error') {
      postToast('error', 'Automação: não foi possível verificar a camada; nada foi apagado.');
      await emitState();
      return;
    }

    if (probe.occupied && probe.ours) {
      discardEffect(key);
      try {
        await spresenter.live.clear(target.output, target.layer);
      } catch (error) {
        postError(new Error(`Automação: falha ao remover o overlay: ${errorMessage(error)}`));
        await emitState();
        return;
      }
      applied.delete(key);
      if (uiTargetKey === key) uiTargetKey = null;
      invalidateProbe(target.output, target.layer);
      await emitState();
      postToast('success', `Automação: overlay removido de ${targetDescription(target)}.`);
      return;
    }

    discardEffect(key);
    applied.delete(key);
    if (uiTargetKey === key) uiTargetKey = null;
    invalidateProbe(target.output, target.layer);
    await emitState();
    postToast(
      'info',
      probe.occupied
        ? 'Automação: a camada tinha outro conteúdo; nada foi apagado.'
        : 'Automação: a camada não continha o overlay; nada foi apagado.',
    );
    return;
  }

  if (!(await prepareAutomationTarget(target))) return;
  await emitState();
  postToast('info', `Automação: overlay aplicado em ${targetDescription(target)}.`);
}

function registerAutomation(): void {
  try {
    spresenter.automation.registerCategory?.({
      key: 'pulse-fx',
      label: 'Pulse FX',
      icon: 'sparkles',
    });
  } catch (error) {
    log.error('registerCategory:', errorMessage(error));
  }

  const register = (definition: HostAutomationNode): void => {
    try {
      spresenter.automation.registerNode(definition);
    } catch (error) {
      log.error('registerNode:', errorMessage(error));
    }
  };

  const executeNode =
    (task: (config: AutomationConfig) => Promise<void>) =>
    async (_payload: unknown, rawConfig: unknown): Promise<void> => {
      try {
        const config: AutomationConfig =
          rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
            ? (rawConfig as AutomationConfig)
            : {};
        await ensureReady();
        await queue.run(() => task(config));
      } catch (error) {
        postError(error);
      }
    };

  register({
    id: 'hit',
    name: 'Pulse FX — Disparar hit',
    description: 'Um pulso de cor único que acende e cai sozinho.',
    category: 'pulse-fx',
    config: {
      color: {
        type: 'string',
        label: 'Cor',
        default: '#ffffff',
        hint: 'Hex (#ffffff, #22d3ee) ou rgb(…).',
      },
      intensity: {
        type: 'number',
        label: 'Intensidade (%)',
        default: 85,
        hint: '0 a 100.',
      },
      decayMs: {
        type: 'number',
        label: 'Queda (ms)',
        default: 320,
        hint: '30 a 10000.',
      },
      target: {
        type: 'string',
        label: 'Alvo',
        default: 'full',
        hint: 'full | vignette | frame.',
      },
      thickness: {
        type: 'number',
        label: 'Espessura',
        default: 35,
        hint: '0 a 100 (vinheta/moldura).',
      },
      softness: {
        type: 'number',
        label: 'Suavizar',
        default: 50,
        hint: '0 a 100 (vinheta/moldura).',
      },
      output: {
        type: 'string',
        label: 'Saída (opcional)',
        default: '',
        hint: 'Índice da saída. Vazio usa a seleção salva do painel.',
      },
      layer: {
        type: 'number',
        label: 'Camada (opcional)',
        default: -1,
        hint: '-1 usa a seleção salva do painel.',
      },
    },
    execute: executeNode(async (config) => {
      await automationHit(config);
    }),
  });

  register({
    id: 'continuous',
    name: 'Pulse FX — Strobe/Pulse',
    description: 'Liga ou desliga o efeito contínuo, com a mesma trava de segurança.',
    category: 'pulse-fx',
    config: {
      enabled: {
        type: 'boolean',
        label: 'Ligado',
        default: true,
        hint: 'false desliga o efeito da camada.',
      },
      mode: {
        type: 'string',
        label: 'Modo',
        default: 'strobe',
        hint: 'strobe | pulse.',
      },
      frequency: {
        type: 'number',
        label: 'Frequência (Hz)',
        default: 2,
        hint: '0,5 a 20; limitada a 3 Hz com a trava ligada.',
      },
      color: {
        type: 'string',
        label: 'Cor',
        default: '#ffffff',
        hint: 'Hex (#ffffff, #22d3ee) ou rgb(…).',
      },
      intensity: {
        type: 'number',
        label: 'Intensidade (%)',
        default: 85,
        hint: '0 a 100.',
      },
      flashWidth: {
        type: 'number',
        label: 'Largura do flash (%)',
        default: 50,
        hint: '5 a 95 (strobe).',
      },
      target: {
        type: 'string',
        label: 'Alvo',
        default: 'full',
        hint: 'full | vignette | frame.',
      },
      thickness: {
        type: 'number',
        label: 'Espessura',
        default: 35,
        hint: '0 a 100 (vinheta/moldura).',
      },
      softness: {
        type: 'number',
        label: 'Suavizar',
        default: 50,
        hint: '0 a 100 (vinheta/moldura).',
      },
      output: {
        type: 'string',
        label: 'Saída (opcional)',
        default: '',
        hint: 'Índice da saída. Vazio usa a seleção salva do painel.',
      },
      layer: {
        type: 'number',
        label: 'Camada (opcional)',
        default: -1,
        hint: '-1 usa a seleção salva do painel.',
      },
    },
    execute: executeNode(async (config) => {
      await automationContinuous(config);
    }),
  });

  register({
    id: 'overlay',
    name: 'Pulse FX — Aplicar/remover overlay',
    description: 'Aplica ou remove o palco transparente do Pulse FX em uma camada.',
    category: 'pulse-fx',
    config: {
      action: {
        type: 'string',
        label: 'Ação',
        default: 'apply',
        hint: 'apply | remove.',
      },
      output: {
        type: 'string',
        label: 'Saída (opcional)',
        default: '',
        hint: 'Índice da saída. Vazio usa a seleção salva do painel.',
      },
      layer: {
        type: 'number',
        label: 'Camada (opcional)',
        default: -1,
        hint: '-1 usa a seleção salva do painel.',
      },
    },
    execute: executeNode(async (config) => {
      await automationOverlay(config);
    }),
  });
}

// ── Ponte UI ─────────────────────────────────────────────────

async function handleCommand(command: UiCommand): Promise<void> {
  await ensureReady();

  switch (command.type) {
    case 'requestState':
      await refreshEnvironment(false);
      await readSelectionProbe(true);
      await emitState();
      flushBootNotices();
      return;
    case 'setParams':
      await handleSetParams(command.params);
      return;
    case 'selectTarget':
      await handleSelectTarget({
        output: command.output,
        layer: command.layer,
        force: command.force,
      });
      return;
    case 'fire':
      await handleFire(command.force === true);
      return;
    case 'startContinuous':
      await handleStartContinuous(command.force === true);
      return;
    case 'stop':
      await handleStop();
      return;
    case 'stopAll':
      await handleStopAll();
      return;
    case 'applyOverlay':
      await handleApply(command.force === true);
      return;
    case 'removeOverlay':
      await handleRemove();
      return;
    case 'restoreDefaults':
      await handleRestoreDefaults();
      return;
    case 'refreshOutputs':
      await refreshEnvironment(false);
      post({ type: 'outputsLayers', outputs, layers });
      await emitState();
      return;
    default:
      return;
  }
}

function setupUiBridge(): void {
  spresenter.ui.onmessage = (raw: unknown) => {
    const command = parseUiCommand(raw);
    if (!command) return;
    if (!uiBridgeSeen) {
      uiBridgeSeen = true;
      log.info('Painel conectado à lógica.');
    }
    void queue.run(async () => {
      try {
        await handleCommand(command);
      } catch (error) {
        postError(error);
      }
    });
  };
}

function registerEvents(): void {
  if (eventsRegistered) return;
  eventsRegistered = true;

  const scheduleRefresh = (): void => {
    if (envTimer !== null) cancelTimer(envTimer);
    envTimer = later(() => {
      envTimer = null;
      void queue.run(async () => {
        if (!ready) return;
        await refreshEnvironment(true);
      });
    }, EVENT_REFRESH_DEBOUNCE_MS);
  };

  try {
    spresenter.on('live', scheduleRefresh);
    spresenter.on('state', scheduleRefresh);
  } catch (error) {
    log.error('eventos:', errorMessage(error));
  }
}

async function initialize(): Promise<void> {
  await queue.run(async () => {
    try {
      await loadSettings();
    } catch (error) {
      postError(error);
    }

    try {
      await refreshEnvironment(false);
    } catch (error) {
      postError(error);
    }

    ready = true;
    try {
      await readSelectionProbe(true);
      await emitState();
    } catch (error) {
      postError(error);
    }
  });
}

function ensureReady(): Promise<void> {
  if (!initPromise) initPromise = initialize();
  return initPromise;
}

// ── Bootstrap (registro síncrono, antes de qualquer await) ───

registerAutomation();
setupUiBridge();
registerEvents();
void ensureReady();

log.info(`Pulse FX carregado (trava ≤ 3 Hz, teto técnico ${formatHz(20)}).`);
