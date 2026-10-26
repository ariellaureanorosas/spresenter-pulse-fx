import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../src/shared/params';
import {
  createSettings,
  parseStoredSettings,
  SETTINGS_SCHEMA_VERSION,
  STORAGE_KEY,
  serializeSettings,
} from '../src/shared/storage';

describe('parseStoredSettings', () => {
  it('devolve os padrões quando não há nada salvo', () => {
    const parsed = parseStoredSettings(undefined);
    expect(parsed.source).toBe('default');
    expect(parsed.issues).toHaveLength(0);
    expect(parsed.settings.params).toEqual(DEFAULT_PARAMS);
    expect(parsed.settings.hasSelection).toBe(false);
  });

  it('faz round-trip do schema atual', () => {
    const settings = createSettings(
      {
        ...DEFAULT_PARAMS,
        mode: 'pulse',
        color: '#22d3ee',
        target: 'frame',
        frequencyHz: 2.5,
        thickness: 60,
      },
      { output: '2', layer: 4 },
      true,
    );

    const parsed = parseStoredSettings(JSON.parse(JSON.stringify(settings)));
    expect(parsed.source).toBe('current');
    expect(parsed.migrated).toBe(false);
    expect(parsed.settings).toEqual(settings);
    expect(parsed.settings.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(parsed.settings.output).toBe('2');
    expect(parsed.settings.layer).toBe(4);
  });

  it('migra o formato legado do Pulse FX 0.3', () => {
    const legacy = {
      output: '0',
      layer: 3,
      safety: true,
      config: {
        mode: 'hit',
        color: '#ffffff',
        target: 'fullscreen',
        intensity: 60,
        fall: 1860,
        frequency: 1.6,
        duty: 50,
        thickness: 52,
        softness: 70,
      },
    };

    const parsed = parseStoredSettings(legacy);
    expect(parsed.source).toBe('legacy');
    expect(parsed.migrated).toBe(true);
    expect(parsed.settings.output).toBe('0');
    expect(parsed.settings.layer).toBe(3);
    expect(parsed.settings.hasSelection).toBe(true);
    expect(parsed.settings.params).toMatchObject({
      mode: 'hit',
      color: '#ffffff',
      target: 'full',
      intensity: 60,
      decayMs: 1860,
      frequencyHz: 1.6,
      flashWidth: 50,
      thickness: 52,
      softness: 70,
      safetyLock: true,
    });
  });

  it('respeita a trava desligada e o alvo legado no config', () => {
    const parsed = parseStoredSettings({
      safety: false,
      config: {
        mode: 'strobe',
        fullscreen: false,
        target: 'vignette',
        frequency: 6,
        duty: 25,
      },
    });

    expect(parsed.settings.params.safetyLock).toBe(false);
    expect(parsed.settings.params.frequencyHz).toBe(6);
    expect(parsed.settings.params.target).toBe('vignette');
    expect(parsed.settings.params.flashWidth).toBe(25);
    expect(parsed.settings.hasSelection).toBe(false);
  });

  it('trata dados corrompidos como padrões reparados', () => {
    const parsed = parseStoredSettings('not-an-object');
    expect(parsed.source).toBe('default');
    expect(parsed.repaired).toBe(true);
    expect(parsed.issues[0]).toContain('corrompidas');
  });

  it('não sobrescreve schema futuro', () => {
    const parsed = parseStoredSettings({
      schemaVersion: 99,
      params: { ...DEFAULT_PARAMS },
      output: '1',
      layer: 2,
      hasSelection: true,
    });
    expect(parsed.unsafeToOverwrite).toBe(true);
    expect(parsed.source).toBe('default');
    expect(parsed.issues[0]).toContain('schema 99');
  });

  it('repara um schema atual sem a marca de versão', () => {
    const parsed = parseStoredSettings({
      params: { ...DEFAULT_PARAMS, mode: 'pulse' },
      output: '1',
      layer: 5,
      hasSelection: true,
    });
    expect(parsed.source).toBe('current');
    expect(parsed.migrated).toBe(true);
    expect(parsed.repaired).toBe(true);
    expect(parsed.settings.params.mode).toBe('pulse');
  });

  it('avisa e corrige frequência salva inválida', () => {
    const parsed = parseStoredSettings({
      schemaVersion: 1,
      params: { ...DEFAULT_PARAMS, frequencyHz: 'abc' },
      output: '1',
      layer: 1,
      hasSelection: true,
    });
    expect(parsed.settings.params.frequencyHz).toBe(2);
    expect(parsed.issues.join(' ')).toContain('inválida');
  });

  it('serializa sempre no schema atual e sanitiza seleção', () => {
    const serialized = serializeSettings({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      params: { ...DEFAULT_PARAMS },
      output: 'abc',
      layer: -5,
      hasSelection: undefined as unknown as boolean,
    });
    expect(serialized.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(serialized.output).toBe('0');
    expect(serialized.layer).toBe(0);
    expect(serialized.hasSelection).toBe(false);
    expect(STORAGE_KEY).toBe('pulsefx.settings');
  });
});
