import { describe, expect, it } from 'vitest';
import { createSerialQueue } from '../src/shared/queue';

describe('createSerialQueue', () => {
  it('executa tarefas na ordem de chegada, mesmo com awaits internos', async () => {
    const queue = createSerialQueue();
    const events: string[] = [];

    const first = queue.run(async () => {
      events.push('a:start');
      await Promise.resolve();
      events.push('a:end');
    });
    const second = queue.run(() => {
      events.push('b');
    });
    const third = queue.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      events.push('c');
    });

    await Promise.all([first, second, third]);
    expect(events).toEqual(['a:start', 'a:end', 'b', 'c']);
  });

  it('continua a fila depois de uma rejeição', async () => {
    const queue = createSerialQueue();
    const events: string[] = [];

    const failing = queue.run(async () => {
      events.push('fail');
      throw new Error('boom');
    });

    const next = queue.run(() => {
      events.push('next');
      return 42;
    });

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe(42);
    expect(events).toEqual(['fail', 'next']);
  });

  it('idle espera a fila drenar', async () => {
    const queue = createSerialQueue();
    let done = false;
    queue.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      done = true;
    });

    expect(done).toBe(false);
    await queue.idle();
    expect(done).toBe(true);
  });

  it('propaga o retorno de cada tarefa', async () => {
    const queue = createSerialQueue();
    await expect(queue.run(() => 'a')).resolves.toBe('a');
    await expect(queue.run(async () => 'b')).resolves.toBe('b');
  });
});
