import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HANDSHAKE_RETRY_DELAYS_MS, startHandshake } from '../src/ui/handshake';

function createTimers() {
  let sequence = 0;
  const pending = new Map<number, ReturnType<typeof setTimeout>>();

  return {
    setTimer: (fn: () => void, ms: number): number => {
      const id = ++sequence;
      pending.set(id, setTimeout(fn, ms));
      return id;
    },
    clearTimer: (id: number): void => {
      const timer = pending.get(id);
      if (timer !== undefined) {
        clearTimeout(timer);
        pending.delete(id);
      }
    },
  };
}

describe('startHandshake', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pede o estado imediatamente e repete enquanto não conecta', () => {
    const timers = createTimers();
    const send = vi.fn();
    const handshake = startHandshake({
      send,
      isConnected: () => false,
      ...timers,
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({ type: 'requestState' });

    vi.advanceTimersByTime(300);
    expect(send).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(800);
    expect(send).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(1600);
    expect(send).toHaveBeenCalledTimes(4);

    handshake.stop();
  });

  it('para de repetir assim que a primeira resposta chega', () => {
    const timers = createTimers();
    const send = vi.fn();
    let connected = false;
    const handshake = startHandshake({
      send,
      isConnected: () => connected,
      ...timers,
    });

    vi.advanceTimersByTime(300);
    expect(send).toHaveBeenCalledTimes(2);

    connected = true;
    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(2);

    handshake.stop();
  });

  it('repete o último intervalo indefinidamente até conectar', () => {
    const timers = createTimers();
    const send = vi.fn();
    const handshake = startHandshake({
      send,
      isConnected: () => false,
      ...timers,
    });

    const total = HANDSHAKE_RETRY_DELAYS_MS.reduce((sum, delay) => sum + delay, 0);
    vi.advanceTimersByTime(total);
    const afterSequence = send.mock.calls.length;

    const last = HANDSHAKE_RETRY_DELAYS_MS[HANDSHAKE_RETRY_DELAYS_MS.length - 1];
    vi.advanceTimersByTime(last);
    expect(send).toHaveBeenCalledTimes(afterSequence + 1);

    vi.advanceTimersByTime(last);
    expect(send).toHaveBeenCalledTimes(afterSequence + 2);

    handshake.stop();
  });

  it('retryNow envia na hora e respeita o estado conectado', () => {
    const timers = createTimers();
    const send = vi.fn();
    let connected = false;
    const handshake = startHandshake({
      send,
      isConnected: () => connected,
      ...timers,
    });

    handshake.retryNow();
    expect(send).toHaveBeenCalledTimes(2);

    connected = true;
    handshake.retryNow();
    expect(send).toHaveBeenCalledTimes(2);

    handshake.stop();
  });

  it('stop cancela o pedido agendado', () => {
    const timers = createTimers();
    const send = vi.fn();
    const handshake = startHandshake({
      send,
      isConnected: () => false,
      ...timers,
    });

    handshake.stop();
    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
