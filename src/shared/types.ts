// Tipos compartilhados entre a thread de lógica e a UI. Nada aqui depende de
// `spresenter`, DOM ou React.

export type PulseMode = 'hit' | 'strobe' | 'pulse';
export type FxTarget = 'full' | 'vignette' | 'frame';

export type ClampCause = 'safety' | 'technical';
export type ClampSource = 'ui' | 'automation' | 'storage';
export type EffectOwner = 'ui' | 'automation';
export type ToastLevel = 'info' | 'success' | 'warning' | 'error';

/** Parâmetros do efeito, já normalizados. `safetyLock` vive junto de propósito:
 *  toda função que renderiza/valida recebe o mesmo estado de segurança. */
export interface FxParams {
  mode: PulseMode;
  color: string;
  target: FxTarget;
  intensity: number;
  decayMs: number;
  frequencyHz: number;
  flashWidth: number;
  thickness: number;
  softness: number;
  safetyLock: boolean;
}

export interface Selection {
  output: string;
  layer: number;
}

/** Resultado de `clampFrequency`. `hz` é o valor que pode ser aplicado. */
export interface FrequencyClamp {
  requestedHz: number;
  hz: number;
  limitHz: number;
  clamped: boolean;
  cause: ClampCause | null;
  invalid: boolean;
}

export interface ClampInfo extends FrequencyClamp {
  source: ClampSource;
  at: number;
}

export interface OutputDto {
  index: number;
  name: string;
  width?: number;
  height?: number;
  disabledLayers: number[];
}

export interface LayerDto {
  index: number;
  name?: string;
}

export interface ActiveEffect {
  output: string;
  layer: number;
  mode: PulseMode;
  startedAt: number;
  owner: EffectOwner;
}

export interface AppliedTarget {
  output: string;
  layer: number;
  effect: PulseMode | null;
}

/** Estado completo enviado à UI. A lógica é a fonte da verdade. */
export interface UiState {
  /** Monotônico. A UI descarta estados mais antigos que o atual. */
  revision: number;
  params: FxParams;
  selection: Selection;
  applied: boolean;
  layerOccupied: boolean | null;
  layerOccupiedByUs: boolean;
  layerDisabled: boolean;
  effects: ActiveEffect[];
  selectedEffect: ActiveEffect | null;
  appliedTargets: AppliedTarget[];
  lastClamp: ClampInfo | null;
  ready: boolean;
  outputs: OutputDto[];
  layers: LayerDto[];
}

export type ConfirmationAction = 'apply' | 'move' | 'run';
