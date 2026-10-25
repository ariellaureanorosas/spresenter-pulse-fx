import type {
  ClampInfo,
  ConfirmationAction,
  FxParams,
  LayerDto,
  OutputDto,
  ToastLevel,
  UiState,
} from './types';

export type UiCommand =
  | { type: 'requestState' }
  | { type: 'setParams'; params: Partial<FxParams> }
  | { type: 'selectTarget'; output: string; layer: number; force?: boolean }
  | { type: 'fire'; force?: boolean }
  | { type: 'startContinuous'; force?: boolean }
  | { type: 'stop' }
  | { type: 'stopAll' }
  | { type: 'applyOverlay'; force?: boolean }
  | { type: 'removeOverlay' }
  | { type: 'restoreDefaults' }
  | { type: 'refreshOutputs' };

export interface ConfirmationRequest {
  action: ConfirmationAction;
  message: string;
  output: string;
  layer: number;
}

export type LogicEvent =
  | { type: 'state'; state: UiState }
  | { type: 'outputsLayers'; outputs: OutputDto[]; layers: LayerDto[] }
  | { type: 'clamped'; clamp: ClampInfo }
  | { type: 'toast'; level: ToastLevel; message: string }
  | { type: 'error'; message: string }
  | { type: 'confirmationRequired'; request: ConfirmationRequest };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function parseUiCommand(raw: unknown): UiCommand | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') return null;

  switch (raw.type) {
    case 'requestState':
      return { type: 'requestState' };
    case 'setParams':
      if (!isRecord(raw.params)) return null;
      return { type: 'setParams', params: raw.params as Partial<FxParams> };
    case 'selectTarget':
      if (raw.output === undefined || raw.output === null) return null;
      if (raw.layer === undefined || raw.layer === null) return null;
      return {
        type: 'selectTarget',
        output: String(raw.output),
        layer: Number(raw.layer),
        force: raw.force === true,
      };
    case 'fire':
      return { type: 'fire', force: raw.force === true };
    case 'startContinuous':
      return { type: 'startContinuous', force: raw.force === true };
    case 'stop':
      return { type: 'stop' };
    case 'stopAll':
      return { type: 'stopAll' };
    case 'applyOverlay':
      return { type: 'applyOverlay', force: raw.force === true };
    case 'removeOverlay':
      return { type: 'removeOverlay' };
    case 'restoreDefaults':
      return { type: 'restoreDefaults' };
    case 'refreshOutputs':
      return { type: 'refreshOutputs' };
    default:
      return null;
  }
}

const LOGIC_EVENT_TYPES = new Set([
  'state',
  'outputsLayers',
  'clamped',
  'toast',
  'error',
  'confirmationRequired',
]);

const TOAST_LEVELS = new Set(['info', 'success', 'warning', 'error']);

export function isLogicEvent(raw: unknown): raw is LogicEvent {
  if (!isRecord(raw) || typeof raw.type !== 'string') return false;
  if (!LOGIC_EVENT_TYPES.has(raw.type)) return false;

  if (raw.type === 'state') {
    return isRecord(raw.state);
  }
  if (raw.type === 'outputsLayers') {
    return Array.isArray(raw.outputs) && Array.isArray(raw.layers);
  }
  if (raw.type === 'clamped') {
    return isRecord(raw.clamp);
  }
  if (raw.type === 'toast') {
    return typeof raw.message === 'string' && TOAST_LEVELS.has(String(raw.level));
  }
  if (raw.type === 'error') {
    return typeof raw.message === 'string';
  }
  if (raw.type === 'confirmationRequired') {
    return isRecord(raw.request) && typeof raw.request.message === 'string';
  }
  return false;
}

export function makeToastEvent(level: ToastLevel, message: string): LogicEvent {
  return { type: 'toast', level, message };
}
