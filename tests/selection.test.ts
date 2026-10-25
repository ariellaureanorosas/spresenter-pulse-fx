import { describe, expect, it } from 'vitest';
import {
  findLayer,
  findOutput,
  highestAvailableLayer,
  isLayerDisabled,
  layerLabel,
  outputLabel,
  resolveSelection,
  sanitizeLayer,
  sanitizeOutput,
  selectionKey,
  targetKey,
} from '../src/shared/selection';
import type { LayerDto, OutputDto } from '../src/shared/types';

const LAYERS: LayerDto[] = [
  { index: 0, name: 'Fundo' },
  { index: 1, name: 'Câmera' },
  { index: 2, name: 'Conteúdo' },
  { index: 3, name: 'Efeitos' },
  { index: 4, name: 'Borda' },
  { index: 5, name: 'Imagem e Vídeo' },
];

const OUTPUTS: OutputDto[] = [
  { index: 0, name: 'Saída 1', width: 1920, height: 1080, disabledLayers: [] },
  { index: 1, name: 'Saída 2', disabledLayers: [5, 3] },
];

describe('seleção de saída e camada', () => {
  it('considera o maior índice não desativado a camada mais alta', () => {
    expect(highestAvailableLayer(OUTPUTS[0], LAYERS)).toBe(5);
    expect(highestAvailableLayer(OUTPUTS[1], LAYERS)).toBe(4);
  });

  it('cai para o maior índice mesmo se todas estiverem desativadas', () => {
    const allDisabled: OutputDto = { index: 2, name: '', disabledLayers: [0, 1, 2, 3, 4, 5] };
    expect(highestAvailableLayer(allDisabled, LAYERS)).toBe(5);
  });

  it('resolve a primeira seleção para a camada mais alta', () => {
    const resolved = resolveSelection(OUTPUTS, LAYERS, { output: '0', layer: 0 }, false);
    expect(resolved.selection).toEqual({ output: '0', layer: 5 });
    expect(resolved.changed).toBe(true);
    expect(resolved.reason).toBe('initial');
  });

  it('preserva uma seleção válida', () => {
    const resolved = resolveSelection(OUTPUTS, LAYERS, { output: '0', layer: 2 }, true);
    expect(resolved.selection).toEqual({ output: '0', layer: 2 });
    expect(resolved.changed).toBe(false);
    expect(resolved.reason).toBeNull();
  });

  it('troca uma saída inexistente pela primeira', () => {
    const resolved = resolveSelection(OUTPUTS, LAYERS, { output: '9', layer: 2 }, true);
    expect(resolved.selection.output).toBe('0');
    expect(resolved.selection.layer).toBe(2);
    expect(resolved.reason).toBe('output-missing');
  });

  it('move para a camada mais alta se a atual estiver desativada', () => {
    const resolved = resolveSelection(OUTPUTS, LAYERS, { output: '1', layer: 5 }, true);
    expect(resolved.selection).toEqual({ output: '1', layer: 4 });
    expect(resolved.reason).toBe('layer-disabled');
  });

  it('move para a camada mais alta se a atual não existir', () => {
    const resolved = resolveSelection(OUTPUTS, LAYERS, { output: '0', layer: 42 }, true);
    expect(resolved.selection.layer).toBe(5);
    expect(resolved.reason).toBe('layer-missing');
  });

  it('não mexe na seleção quando não há saídas', () => {
    const resolved = resolveSelection([], LAYERS, { output: '3', layer: 1 }, true);
    expect(resolved.selection).toEqual({ output: '3', layer: 1 });
    expect(resolved.changed).toBe(false);
    expect(resolved.reason).toBeNull();
  });
});

describe('helpers de exibição e sanitização', () => {
  it('sanitiza saída e camada', () => {
    expect(sanitizeOutput(2)).toBe('2');
    expect(sanitizeOutput(' 04 ')).toBe('04');
    expect(sanitizeOutput('x', '1')).toBe('1');
    expect(sanitizeLayer('3.9')).toBe(3);
    expect(sanitizeLayer(-4)).toBe(0);
    expect(sanitizeLayer('abc', 2)).toBe(2);
  });

  it('encontra itens e consulta camadas desativadas', () => {
    expect(findOutput(OUTPUTS, '1')?.index).toBe(1);
    expect(findLayer(LAYERS, 4)?.name).toBe('Borda');
    expect(isLayerDisabled(OUTPUTS[1], 5)).toBe(true);
    expect(isLayerDisabled(OUTPUTS[0], 5)).toBe(false);
  });

  it('monta labels legíveis e chaves estáveis', () => {
    expect(outputLabel(OUTPUTS, '1')).toBe('Saída 2');
    expect(outputLabel(OUTPUTS, '8')).toBe('Saída 8');
    expect(layerLabel(LAYERS, 5)).toBe('Imagem e Vídeo');
    expect(layerLabel(LAYERS, 9)).toBe('Camada 9');
    expect(targetKey('0', 5)).toBe('0:5');
    expect(selectionKey({ output: '1', layer: 3 })).toBe('1:3');
  });
});
