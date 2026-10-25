/**
 * Fila serial mínima. Cada tarefa só começa quando a anterior termina — mesmo
 * que a anterior rejeite. É usada para serializar UI, automação e eventos.
 */
export interface SerialQueue {
  run<T>(task: () => Promise<T> | T): Promise<T>;
  idle(): Promise<void>;
}

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    run<T>(task: () => Promise<T> | T): Promise<T> {
      const result = tail.then(task);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    async idle(): Promise<void> {
      await tail;
    },
  };
}
