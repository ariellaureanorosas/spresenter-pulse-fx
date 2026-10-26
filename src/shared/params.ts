import type { ClampCause, ClampInfo, FrequencyClamp, FxParams, FxTarget, PulseMode } from './types';

export const FREQUENCY_MIN_HZ = 0.5;
export const FREQUENCY_SAFETY_MAX_HZ = 3;
export const FREQUENCY_HARD_MAX_HZ = 20;

export interface ParamRange {
  min: number;
  max: number;
  step: number;
}

export const PARAM_RANGES: Record<
  'intensity' | 'decayMs' | 'frequencyHz' | 'flashWidth' | 'thickness' | 'softness',
  ParamRange
> = {
  intensity: { min: 0, max: 100, step: 1 },
  decayMs: { min: 30, max: 2000, step: 10 },
  frequencyHz: { min: FREQUENCY_MIN_HZ, max: FREQUENCY_HARD_MAX_HZ, step: 0.1 },
  flashWidth: { min: 5, max: 95, step: 1 },
  thickness: { min: 0, max: 100, step: 1 },
  softness: { min: 0, max: 100, step: 1 },
};

export const DEFAULT_PARAMS: FxParams = {
  mode: 'hit',
  color: '#ffffff',
  target: 'full',
  intensity: 85,
  decayMs: 320,
  frequencyHz: 2,
  flashWidth: 50,
  thickness: 35,
  softness: 50,
  safetyLock: true,
};

export const MODE_LABELS: Record<PulseMode, string> = {
  hit: 'Hit',
  strobe: 'Strobe',
  pulse: 'Pulse',
};

export const TARGET_LABELS: Record<FxTarget, string> = {
  full: 'Tela cheia',
  vignette: 'Vinheta',
  frame: 'Moldura',
};

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Único caminho de clamp de frequência do plugin.
 *
 * - Com a trava ligada, o teto é 3 Hz.
 * - Sem a trava, ainda existe um teto técnico de 20 Hz.
 * - Valores ausentes/inválidos viram 2 Hz (`invalid: true`).
 * - O mínimo é 0,5 Hz em qualquer cenário.
 */
export function clampFrequency(rawHz: unknown, safetyLockOn: boolean): FrequencyClamp {
  const numeric =
    typeof rawHz === 'number'
      ? rawHz
      : typeof rawHz === 'string' && rawHz.trim() !== ''
        ? Number(rawHz)
        : Number.NaN;

  const invalid = !Number.isFinite(numeric) || numeric <= 0;
  const requestedHz = invalid ? DEFAULT_PARAMS.frequencyHz : numeric;
  const limitHz = safetyLockOn ? FREQUENCY_SAFETY_MAX_HZ : FREQUENCY_HARD_MAX_HZ;
  const bounded = Math.min(requestedHz, limitHz);
  const hz = round(Math.max(FREQUENCY_MIN_HZ, bounded), 2);
  const clamped = invalid || hz !== round(requestedHz, 2);

  let cause: ClampCause | null = null;
  if (!invalid && requestedHz > limitHz) {
    cause = safetyLockOn ? 'safety' : 'technical';
  }

  return {
    requestedHz: round(requestedHz, 2),
    hz,
    limitHz,
    clamped,
    cause,
    invalid,
  };
}

export function clampInfo(
  clamp: FrequencyClamp,
  source: ClampInfo['source'],
  at = Date.now(),
): ClampInfo {
  return { ...clamp, source, at };
}

const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  red: '#ff0000',
  green: '#00ff00',
  blue: '#0000ff',
  cyan: '#00ffff',
  aqua: '#00ffff',
  magenta: '#ff00ff',
  fuchsia: '#ff00ff',
  yellow: '#ffff00',
  orange: '#ffa500',
};

/** Normaliza uma cor para um formato seguro (hex ou rgb/rgba controlado). */
export function normalizeColor(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_PARAMS.color;
  const value = raw.trim().toLowerCase();
  if (!value) return DEFAULT_PARAMS.color;

  const named = NAMED_COLORS[value];
  if (named) return named;

  const hex = value.startsWith('#') ? value : `#${value}`;
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (/^#[0-9a-f]{6}$/.test(hex) || /^#[0-9a-f]{8}$/.test(hex)) {
    return hex;
  }

  const rgbMatch = value.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+)(%?))?\s*\)$/,
  );
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if ([r, g, b].some((channel) => channel < 0 || channel > 255)) {
      return DEFAULT_PARAMS.color;
    }
    if (rgbMatch[4] === undefined) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    let alpha = Number(rgbMatch[4]);
    if (rgbMatch[5] === '%') alpha /= 100;
    if (!Number.isFinite(alpha)) return DEFAULT_PARAMS.color;
    alpha = Math.min(1, Math.max(0, alpha));
    return `rgba(${r}, ${g}, ${b}, ${round(alpha, 3)})`;
  }

  return DEFAULT_PARAMS.color;
}

interface RgbaParts {
  r: number;
  g: number;
  b: number;
  a: number;
}

function colorParts(color: string): RgbaParts {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }
  const match = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (!match) return { r: 255, g: 255, b: 255, a: 1 };
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

/** Versão transparente da cor, para os stops iniciais da vinheta. */
export function transparentColor(color: string): string {
  const { r, g, b } = colorParts(normalizeColor(color));
  return `rgba(${r}, ${g}, ${b}, 0)`;
}

/** Converte a cor normalizada para o formato aceito por `<input type="color">`. */
export function toHexColor(color: string): string {
  const { r, g, b } = colorParts(normalizeColor(color));
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function normalizeMode(raw: unknown): PulseMode {
  const value = typeof raw === 'string' ? stripDiacritics(raw) : '';
  if (
    value === 'strobe' ||
    value === 'estrobo' ||
    value === 'estroboscopio' ||
    value === 'estroboscópio'
  ) {
    return 'strobe';
  }
  if (
    value === 'pulse' ||
    value === 'pulso' ||
    value === 'respiracao' ||
    value === 'respiro' ||
    value === 'breathing'
  ) {
    return 'pulse';
  }
  return 'hit';
}

export function normalizeTarget(raw: unknown): FxTarget {
  const value = typeof raw === 'string' ? stripDiacritics(raw).replace(/\s+/g, '-') : '';
  if (value === 'vignette' || value === 'vinheta' || value === 'v') return 'vignette';
  if (
    value === 'frame' ||
    value === 'moldura' ||
    value === 'borda' ||
    value === 'f' ||
    value === 'border'
  ) {
    return 'frame';
  }
  return 'full';
}

function normalizeNumber(
  raw: unknown,
  min: number,
  max: number,
  fallback: number,
  decimals: number,
): number {
  const numeric =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : Number.NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return round(Math.min(max, Math.max(min, numeric)), decimals);
}

export interface NormalizedParams {
  params: FxParams;
  clamp: FrequencyClamp;
}

/**
 * Normaliza qualquer entrada (UI, storage, automação) para um `FxParams`
 * completo e seguro. A frequência resultante já passou por `clampFrequency`.
 */
export function normalizeParamsWithMeta(raw: unknown, safetyOverride?: boolean): NormalizedParams {
  const record =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const safetyLock =
    typeof safetyOverride === 'boolean' ? safetyOverride : record.safetyLock !== false;

  const clamp = clampFrequency(record.frequencyHz, safetyLock);

  return {
    params: {
      mode: normalizeMode(record.mode),
      color: normalizeColor(record.color),
      target: normalizeTarget(record.target),
      intensity: normalizeNumber(
        record.intensity,
        PARAM_RANGES.intensity.min,
        PARAM_RANGES.intensity.max,
        DEFAULT_PARAMS.intensity,
        0,
      ),
      decayMs: normalizeNumber(
        record.decayMs,
        PARAM_RANGES.decayMs.min,
        PARAM_RANGES.decayMs.max,
        DEFAULT_PARAMS.decayMs,
        0,
      ),
      frequencyHz: clamp.hz,
      flashWidth: normalizeNumber(
        record.flashWidth,
        PARAM_RANGES.flashWidth.min,
        PARAM_RANGES.flashWidth.max,
        DEFAULT_PARAMS.flashWidth,
        0,
      ),
      thickness: normalizeNumber(
        record.thickness,
        PARAM_RANGES.thickness.min,
        PARAM_RANGES.thickness.max,
        DEFAULT_PARAMS.thickness,
        0,
      ),
      softness: normalizeNumber(
        record.softness,
        PARAM_RANGES.softness.min,
        PARAM_RANGES.softness.max,
        DEFAULT_PARAMS.softness,
        0,
      ),
      safetyLock,
    },
    clamp,
  };
}

export function normalizeParams(raw: unknown, safetyOverride?: boolean): FxParams {
  return normalizeParamsWithMeta(raw, safetyOverride).params;
}

export function formatHz(hz: number): string {
  return `${hz.toFixed(1).replace('.', ',')} Hz`;
}

export function describeClamp(clamp: FrequencyClamp): string {
  if (clamp.invalid) {
    return `Frequência inválida; usando ${formatHz(clamp.hz)}.`;
  }
  if (clamp.cause === 'safety') {
    return `Pedido de ${formatHz(clamp.requestedHz)} limitado a ${formatHz(
      clamp.hz,
    )} pela trava de segurança.`;
  }
  if (clamp.cause === 'technical') {
    return `Pedido de ${formatHz(clamp.requestedHz)} limitado ao teto técnico de ${formatHz(
      clamp.limitHz,
    )}.`;
  }
  return `Frequência ajustada para ${formatHz(clamp.hz)} (mínimo de ${formatHz(
    FREQUENCY_MIN_HZ,
  )}).`;
}
