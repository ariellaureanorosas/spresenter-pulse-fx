import type { LayerDto, OutputDto, Selection } from './types';

export type SelectionReason = 'initial' | 'output-missing' | 'layer-missing' | 'layer-disabled';

export interface ResolvedSelection {
  selection: Selection;
  changed: boolean;
  reason: SelectionReason | null;
}

export function selectionKey(selection: Selection): string {
  return `${selection.output}:${selection.layer}`;
}

export function targetKey(output: string, layer: number): string {
  return `${output}:${layer}`;
}

export function sanitizeOutput(raw: unknown, fallback = '0'): string {
  const value =
    typeof raw === 'number' && Number.isFinite(raw)
      ? String(Math.max(0, Math.trunc(raw)))
      : String(raw ?? '').trim();
  return /^\d+$/.test(value) ? value : fallback;
}

export function sanitizeLayer(raw: unknown, fallback = 0): number {
  const numeric =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : Number.NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(99, Math.max(0, Math.floor(numeric)));
}

export function isLayerDisabled(output: OutputDto | undefined, layer: number): boolean {
  return !!output && output.disabledLayers.includes(layer);
}

/**
 * A ordem documentada das camadas é a da lista do app: índice maior = mais
 * acima. A camada "mais alta" é o maior índice não desativado na saída.
 */
export function highestAvailableLayer(output: OutputDto | undefined, layers: LayerDto[]): number {
  const disabled = new Set(output?.disabledLayers ?? []);
  const indexes = layers
    .map((layer) => layer.index)
    .filter((index) => Number.isInteger(index) && index >= 0);
  const enabled = indexes.filter((index) => !disabled.has(index));
  if (enabled.length > 0) return Math.max(...enabled);
  if (indexes.length > 0) return Math.max(...indexes);
  return 0;
}

export function findOutput(outputs: OutputDto[], output: string): OutputDto | undefined {
  return outputs.find((item) => String(item.index) === output);
}

export function findLayer(layers: LayerDto[], layer: number): LayerDto | undefined {
  return layers.find((item) => item.index === layer);
}

export function resolveSelection(
  outputs: OutputDto[],
  layers: LayerDto[],
  current: Selection,
  hasSelection: boolean,
): ResolvedSelection {
  if (outputs.length === 0) {
    return { selection: current, changed: false, reason: null };
  }

  const fallbackOutput = outputs[0];
  let output = findOutput(outputs, current.output);
  let reason: SelectionReason | null = null;
  let layer = current.layer;

  if (!hasSelection) {
    output = fallbackOutput;
    reason = 'initial';
  } else if (!output) {
    output = fallbackOutput;
    reason = 'output-missing';
  }

  const resolvedOutput = output ?? fallbackOutput;
  const outputIndex = String(resolvedOutput.index);
  const layerIndexes = layers
    .map((item) => item.index)
    .filter((index) => Number.isInteger(index) && index >= 0);

  if (layerIndexes.length === 0) {
    const selection = { output: outputIndex, layer };
    return {
      selection,
      changed: selection.output !== current.output || selection.layer !== current.layer,
      reason,
    };
  }

  if (reason === 'initial') {
    layer = highestAvailableLayer(resolvedOutput, layers);
  } else if (!layerIndexes.includes(layer)) {
    layer = highestAvailableLayer(resolvedOutput, layers);
    reason = reason ?? 'layer-missing';
  } else if (isLayerDisabled(resolvedOutput, layer)) {
    const replacement = highestAvailableLayer(resolvedOutput, layers);
    if (replacement !== layer) {
      layer = replacement;
      reason = reason ?? 'layer-disabled';
    }
  }

  const selection = { output: outputIndex, layer };
  return {
    selection,
    changed: selection.output !== current.output || selection.layer !== current.layer,
    reason,
  };
}

export function outputLabel(outputs: OutputDto[], output: string): string {
  const found = findOutput(outputs, output);
  if (!found) return `Saída ${output}`;
  return found.name.trim() || `Saída ${output}`;
}

export function layerLabel(layers: LayerDto[], layer: number): string {
  const found = findLayer(layers, layer);
  const name = found?.name?.trim();
  if (name) return name;
  return `Camada ${layer}`;
}

export function selectionLabel(
  outputs: OutputDto[],
  layers: LayerDto[],
  selection: Selection,
): string {
  return `${outputLabel(outputs, selection.output)} · ${layerLabel(layers, selection.layer)}`;
}

export function sortOutputs(outputs: OutputDto[]): OutputDto[] {
  return [...outputs].sort((a, b) => a.index - b.index);
}

export function sortLayers(layers: LayerDto[]): LayerDto[] {
  return [...layers].sort((a, b) => a.index - b.index);
}
