import { DEFAULT_PARAMS } from '../../src/shared/params';
import type { ActiveEffect, ClampInfo, UiState } from '../../src/shared/types';

export const FAKE_OUTPUTS = [
  { index: 0, name: 'Principal', width: 1920, height: 1080, disabledLayers: [] },
  { index: 1, name: 'Palco', width: 1280, height: 720, disabledLayers: [] },
];

export const FAKE_LAYERS = [0, 1, 2, 3, 4, 5].map((index) => ({ index, name: `Camada ${index}` }));

export function makeEffect(overrides: Partial<ActiveEffect> = {}): ActiveEffect {
  return {
    output: '0',
    layer: 5,
    mode: 'hit',
    startedAt: 1_700_000_000_000,
    owner: 'ui',
    ...overrides,
  };
}

export function makeClamp(overrides: Partial<ClampInfo> = {}): ClampInfo {
  return {
    requestedHz: 10,
    hz: 3,
    limitHz: 3,
    clamped: true,
    cause: 'safety',
    invalid: false,
    source: 'automation',
    at: 1_700_000_000_000,
    ...overrides,
  };
}

export function makeState(overrides: Partial<UiState> = {}): UiState {
  return {
    revision: 1,
    params: { ...DEFAULT_PARAMS },
    selection: { output: '0', layer: 5 },
    applied: false,
    layerOccupied: false,
    layerOccupiedByUs: false,
    layerDisabled: false,
    effects: [],
    selectedEffect: null,
    appliedTargets: [],
    lastClamp: null,
    ready: true,
    outputs: FAKE_OUTPUTS,
    layers: FAKE_LAYERS,
    ...overrides,
  };
}
