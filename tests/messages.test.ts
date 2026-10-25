import { describe, expect, it } from 'vitest';
import {
  isLogicEvent,
  makeToastEvent,
  parseUiCommand,
} from '../src/shared/messages';

describe('parseUiCommand', () => {
  it('aceita comandos válidos', () => {
    expect(parseUiCommand({ type: 'requestState' })).toEqual({ type: 'requestState' });
    expect(parseUiCommand({ type: 'stopAll' })).toEqual({ type: 'stopAll' });
    expect(
      parseUiCommand({ type: 'selectTarget', output: 1, layer: '4', force: true }),
    ).toEqual({ type: 'selectTarget', output: '1', layer: 4, force: true });
    expect(parseUiCommand({ type: 'fire' })).toEqual({ type: 'fire', force: false });
  });

  it('rejeita payloads inválidos', () => {
    expect(parseUiCommand(null)).toBeNull();
    expect(parseUiCommand({ type: 'setParams' })).toBeNull();
    expect(parseUiCommand({ type: 'selectTarget', output: '0' })).toBeNull();
    expect(parseUiCommand({ type: 'comando-inexistente' })).toBeNull();
  });

  it('aceita setParams com objeto', () => {
    expect(parseUiCommand({ type: 'setParams', params: { intensity: 50 } })).toEqual({
      type: 'setParams',
      params: { intensity: 50 },
    });
  });
});

describe('isLogicEvent', () => {
  it('valida os eventos da lógica', () => {
    expect(isLogicEvent({ type: 'state', state: { revision: 1 } })).toBe(true);
    expect(isLogicEvent({ type: 'toast', level: 'warning', message: 'oi' })).toBe(true);
    expect(isLogicEvent({ type: 'error', message: 'falhou' })).toBe(true);
    expect(isLogicEvent({ type: 'clamped', clamp: { hz: 3 } })).toBe(true);
    expect(
      isLogicEvent({
        type: 'confirmationRequired',
        request: { action: 'apply', message: 'confirmar' },
      }),
    ).toBe(true);
    expect(
      isLogicEvent({ type: 'outputsLayers', outputs: [], layers: [] }),
    ).toBe(true);
  });

  it('descarta eventos desconhecidos ou malformados', () => {
    expect(isLogicEvent({ type: 'toast', level: 'x', message: 'oi' })).toBe(false);
    expect(isLogicEvent({ type: 'state' })).toBe(false);
    expect(isLogicEvent('state')).toBe(false);
  });

  it('monta eventos de toast', () => {
    expect(makeToastEvent('success', 'ok')).toEqual({
      type: 'toast',
      level: 'success',
      message: 'ok',
    });
  });
});
