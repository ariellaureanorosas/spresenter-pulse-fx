import type { UiCommand } from '../shared/messages';

/**
 * Ritmo de reconexão do painel com a thread de lógica.
 *
 * O host descarta mensagens de UI recebidas antes de `spresenter.ui.onmessage`
 * existir, então o primeiro pedido pode se perder. Depois da sequência inicial,
 * o último intervalo se repete até a primeira resposta chegar.
 */
export const HANDSHAKE_RETRY_DELAYS_MS = [300, 800, 1600, 3000, 5000, 8000, 12000] as const;

export interface HandshakeOptions {
  send: (command: UiCommand) => void;
  isConnected: () => boolean;
  setTimer?: (fn: () => void, ms: number) => number;
  clearTimer?: (timer: number) => void;
}

export interface Handshake {
  retryNow: () => void;
  stop: () => void;
}

export function startHandshake({
  send,
  isConnected,
  setTimer = (fn, ms) => window.setTimeout(fn, ms),
  clearTimer = (timer) => window.clearTimeout(timer),
}: HandshakeOptions): Handshake {
  let timer: number | null = null;
  let stopped = false;
  let attempt = 0;

  const stop = (): void => {
    stopped = true;
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };

  const request = (): void => {
    if (stopped) return;
    if (isConnected()) {
      stop();
      return;
    }
    send({ type: 'requestState' });
  };

  const schedule = (): void => {
    if (stopped || isConnected()) return;
    const delay =
      HANDSHAKE_RETRY_DELAYS_MS[Math.min(attempt, HANDSHAKE_RETRY_DELAYS_MS.length - 1)];
    attempt += 1;
    timer = setTimer(() => {
      timer = null;
      request();
      schedule();
    }, delay);
  };

  request();
  schedule();

  return {
    retryNow: request,
    stop,
  };
}
