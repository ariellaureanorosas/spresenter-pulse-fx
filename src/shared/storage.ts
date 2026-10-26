import { DEFAULT_PARAMS, normalizeParamsWithMeta } from './params';
import { sanitizeLayer, sanitizeOutput } from './selection';
import type { FxParams, Selection } from './types';

export const STORAGE_KEY = 'pulsefx.settings';
export const LEGACY_STORAGE_KEY = 'com.spresenter.pulse-fx.settings.v1';
export const SETTINGS_SCHEMA_VERSION = 1;

export interface PersistedSettings {
  schemaVersion: 1;
  params: FxParams;
  output: string;
  layer: number;
  hasSelection: boolean;
}

export type SettingsSource = 'default' | 'current' | 'legacy';

export interface ParsedSettings {
  settings: PersistedSettings;
  source: SettingsSource;
  migrated: boolean;
  repaired: boolean;
  /** true quando os dados são de um schema futuro e NÃO devem ser sobrescritos. */
  unsafeToOverwrite: boolean;
  issues: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function defaultSettings(): PersistedSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    params: { ...DEFAULT_PARAMS },
    output: '0',
    layer: 0,
    hasSelection: false,
  };
}

export function createSettings(
  params: FxParams,
  selection: Selection,
  hasSelection: boolean,
): PersistedSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    params: { ...params },
    output: sanitizeOutput(selection.output),
    layer: sanitizeLayer(selection.layer),
    hasSelection,
  };
}

function defaultResult(reason: string, unsafeToOverwrite = false): ParsedSettings {
  return {
    settings: defaultSettings(),
    source: 'default',
    migrated: false,
    repaired: false,
    unsafeToOverwrite,
    issues: reason ? [reason] : [],
  };
}

function parseLegacy(raw: Record<string, unknown>): ParsedSettings {
  const config = isRecord(raw.config) ? raw.config : raw;
  const safety = config.safety !== false && raw.safety !== false;
  const target =
    config.target ?? (config.fullscreen === true ? 'full' : undefined) ?? (raw.target as unknown);

  const paramsRaw: Record<string, unknown> = {
    mode: config.mode,
    color: config.color,
    target,
    intensity: config.intensity,
    decayMs: config.decayMs ?? config.fall,
    frequencyHz: config.frequencyHz ?? config.frequency,
    flashWidth: config.flashWidth ?? config.duty,
    thickness: config.thickness,
    softness: config.softness,
    safetyLock: safety,
  };

  const { params } = normalizeParamsWithMeta(paramsRaw);
  const hasSelection = raw.output !== undefined || raw.layer !== undefined;

  return {
    settings: {
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      params,
      output: sanitizeOutput(raw.output),
      layer: sanitizeLayer(raw.layer),
      hasSelection,
    },
    source: 'legacy',
    migrated: true,
    repaired: false,
    unsafeToOverwrite: false,
    issues: [],
  };
}

function parseCurrent(raw: Record<string, unknown>, schemaMissing: boolean): ParsedSettings {
  const paramsRaw = isRecord(raw.params) ? raw.params : raw;
  const hasSelection =
    raw.hasSelection === true ||
    (raw.hasSelection === undefined && (raw.output !== undefined || raw.layer !== undefined));

  const { params, clamp } = normalizeParamsWithMeta(paramsRaw);

  const issues: string[] = [];
  if (clamp.invalid) {
    issues.push('A frequência salva era inválida e foi substituída pelo padrão.');
  }

  return {
    settings: {
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      params,
      output: sanitizeOutput(raw.output),
      layer: sanitizeLayer(raw.layer),
      hasSelection,
    },
    source: 'current',
    migrated: schemaMissing,
    repaired: schemaMissing,
    unsafeToOverwrite: false,
    issues,
  };
}

/**
 * Lê qualquer formato já gravado e devolve settings v1 válidos.
 *
 * Formatos aceitos:
 * - v1 (`schemaVersion: 1`, `params`);
 * - v1 sem schema (repara o schema);
 * - legado do Pulse FX 0.3 (`config` com `fall`, `duty`, `fullscreen`);
 * - objeto solto com os campos de parâmetro na raiz.
 *
 * Schema futuro não é migrado nem sobrescrito.
 */
export function parseStoredSettings(
  raw: unknown,
  options: { legacy?: boolean } = {},
): ParsedSettings {
  if (raw === undefined || raw === null) {
    return defaultResult('');
  }

  if (!isRecord(raw)) {
    return {
      ...defaultResult('As preferências salvas estavam corrompidas; usando os padrões.'),
      repaired: true,
    };
  }

  const schema = Number(raw.schemaVersion);
  if (Number.isFinite(schema) && schema > SETTINGS_SCHEMA_VERSION) {
    return defaultResult(
      `As preferências foram salvas por uma versão mais nova (schema ${schema}).`,
      true,
    );
  }

  const looksLegacy =
    options.legacy === true ||
    isRecord(raw.config) ||
    (!('params' in raw) &&
      ('fall' in raw ||
        'duty' in raw ||
        'frequency' in raw ||
        'config' in raw ||
        ('mode' in raw && 'safety' in raw)));

  if (looksLegacy) {
    return parseLegacy(raw);
  }

  if ('params' in raw || 'schemaVersion' in raw || 'hasSelection' in raw) {
    return parseCurrent(raw, schema !== SETTINGS_SCHEMA_VERSION);
  }

  if ('mode' in raw || 'color' in raw || 'intensity' in raw) {
    return parseCurrent(raw, true);
  }

  return {
    ...defaultResult(
      'As preferências salvas não tinham um formato reconhecido; usando os padrões.',
    ),
    repaired: true,
  };
}

export function serializeSettings(settings: PersistedSettings): PersistedSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    params: { ...settings.params },
    output: sanitizeOutput(settings.output),
    layer: sanitizeLayer(settings.layer),
    hasSelection: settings.hasSelection === true,
  };
}
