// Logger da thread de lógica.
//
// Centraliza o prefixo e evita que uma falha de logging interrompa o motor.
// O `console` do processo de lógica aparece no log do Spresenter; a UI nunca
// deve logar dados de produção (o `noConsole` do Biome cobre `src/ui`).

const PREFIX = '[Pulse FX]';

type Level = 'error' | 'info' | 'debug';

function write(level: Level, message: string, detail?: unknown): void {
  try {
    const sink = typeof console === 'undefined' ? undefined : console[level];
    if (typeof sink !== 'function') return;
    if (detail === undefined) {
      sink.call(console, `${PREFIX} ${message}`);
    } else {
      sink.call(console, `${PREFIX} ${message}`, detail);
    }
  } catch {
    // Logging é diagnóstico: nunca deve quebrar o fluxo do plugin.
  }
}

export const log = {
  /** Falha recuperável ou inesperada; inclui o motivo quando disponível. */
  error(message: string, detail?: unknown): void {
    write('error', message, detail);
  },
  /** Marco de ciclo de vida (boot, painel conectado). */
  info(message: string): void {
    write('info', message);
  },
  /** Diagnóstico detalhado; fica no nível `debug` do console. */
  debug(message: string): void {
    write('debug', message);
  },
};
