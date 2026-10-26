import { describe, expect, it } from 'vitest';
import {
  clampFrequency,
  DEFAULT_PARAMS,
  describeClamp,
  FREQUENCY_HARD_MAX_HZ,
  FREQUENCY_SAFETY_MAX_HZ,
  formatHz,
  normalizeColor,
  normalizeMode,
  normalizeParams,
  normalizeParamsWithMeta,
  normalizeTarget,
  toHexColor,
  transparentColor,
} from '../src/shared/params';

describe('clampFrequency', () => {
  it('aplica a trava de 3 Hz e explica a causa', () => {
    const result = clampFrequency(5, true);
    expect(result).toMatchObject({
      requestedHz: 5,
      hz: FREQUENCY_SAFETY_MAX_HZ,
      limitHz: FREQUENCY_SAFETY_MAX_HZ,
      clamped: true,
      cause: 'safety',
      invalid: false,
    });
    expect(describeClamp(result)).toContain('trava de segurança');
  });

  it('sem a trava, mantém o teto técnico de 20 Hz', () => {
    const result = clampFrequency(25, false);
    expect(result.hz).toBe(FREQUENCY_HARD_MAX_HZ);
    expect(result.cause).toBe('technical');
    expect(result.clamped).toBe(true);
    expect(describeClamp(result)).toContain('teto técnico');
  });

  it('não marca clamp quando o valor já está dentro da faixa', () => {
    const result = clampFrequency(5, false);
    expect(result.hz).toBe(5);
    expect(result.clamped).toBe(false);
    expect(result.cause).toBeNull();
  });

  it('respeita o mínimo de 0,5 Hz', () => {
    const result = clampFrequency(0.1, true);
    expect(result.hz).toBe(0.5);
    expect(result.cause).toBeNull();
    expect(result.clamped).toBe(true);
  });

  it('trata valores inválidos sem lançar', () => {
    const result = clampFrequency('abc', true);
    expect(result.invalid).toBe(true);
    expect(result.hz).toBe(DEFAULT_PARAMS.frequencyHz);
    expect(result.requestedHz).toBe(DEFAULT_PARAMS.frequencyHz);
    expect(describeClamp(result)).toContain('inválida');
  });

  it('normaliza strings numéricas e arredonda', () => {
    expect(clampFrequency('2.345', true).hz).toBe(2.35);
    expect(clampFrequency('', true).invalid).toBe(true);
  });
});

describe('normalização de parâmetros', () => {
  it('normaliza todos os campos, aplicando faixas e a trava', () => {
    const { params, clamp } = normalizeParamsWithMeta({
      mode: 'pulso',
      color: '#abc',
      target: 'Moldura',
      intensity: '120',
      decayMs: 5,
      frequencyHz: 9,
      flashWidth: 2,
      thickness: -5,
      softness: 150,
      safetyLock: false,
    });

    expect(params.mode).toBe('pulse');
    expect(params.color).toBe('#aabbcc');
    expect(params.target).toBe('frame');
    expect(params.intensity).toBe(100);
    expect(params.decayMs).toBe(30);
    expect(params.frequencyHz).toBe(9);
    expect(params.flashWidth).toBe(5);
    expect(params.thickness).toBe(0);
    expect(params.softness).toBe(100);
    expect(params.safetyLock).toBe(false);
    expect(clamp.clamped).toBe(false);
  });

  it('liga a trava por padrão e clampa a frequência', () => {
    const params = normalizeParams({
      frequencyHz: 12,
      mode: 'strobe',
    });
    expect(params.safetyLock).toBe(true);
    expect(params.frequencyHz).toBe(3);
  });

  it('aceita aliases em português para modo e alvo', () => {
    expect(normalizeMode('Estroboscópio')).toBe('strobe');
    expect(normalizeMode('respiração')).toBe('pulse');
    expect(normalizeMode('desconhecido')).toBe('hit');
    expect(normalizeTarget('Vinheta')).toBe('vignette');
    expect(normalizeTarget('borda')).toBe('frame');
    expect(normalizeTarget('tela cheia')).toBe('full');
  });

  it('formata Hz com vírgula decimal', () => {
    expect(formatHz(3)).toBe('3,0 Hz');
    expect(formatHz(2.35)).toBe('2,4 Hz');
  });
});

describe('cores', () => {
  it('normaliza hex, nomes e rgb/rgba', () => {
    expect(normalizeColor('#ABC')).toBe('#aabbcc');
    expect(normalizeColor('22d3ee')).toBe('#22d3ee');
    expect(normalizeColor('red')).toBe('#ff0000');
    expect(normalizeColor('rgba(10, 20, 30, 0.5)')).toBe('rgba(10, 20, 30, 0.5)');
    expect(normalizeColor('rgba(0, 0, 0, 50%)')).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('cai no branco para entradas perigosas ou inválidas', () => {
    expect(normalizeColor('red;}body{display:none')).toBe('#ffffff');
    expect(normalizeColor('rgb(300, 0, 0)')).toBe('#ffffff');
    expect(normalizeColor(42)).toBe('#ffffff');
  });

  it('converte para o formato do input type=color e para transparência', () => {
    expect(toHexColor('rgba(255, 0, 128, 0.5)')).toBe('#ff0080');
    expect(toHexColor('#abc')).toBe('#aabbcc');
    expect(transparentColor('#123456')).toBe('rgba(18, 52, 86, 0)');
  });
});
