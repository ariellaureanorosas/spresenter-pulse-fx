// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';

let shouldThrow = true;

// React reentrega exceções de render ao window mesmo quando o ErrorBoundary as
// captura. Sem isso, o jsdom imprime o stack como "jsdomError". O silêncio fica
// restrito a este arquivo: nos demais, um erro não tratado continua falhando.
window.addEventListener('error', (event) => {
  event.preventDefault();
});

function Flaky(): ReactElement {
  if (shouldThrow) throw new Error('estado inconsistente');
  return <p>painel recuperado</p>;
}

function Silent(): ReactElement {
  throw new Error();
}

beforeEach(() => {
  shouldThrow = true;
});

afterEach(cleanup);

describe('ErrorBoundary', () => {
  it('mostra o fallback e permite tentar novamente', async () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'O painel encontrou um erro' })).toBeInTheDocument();
    expect(screen.getByText('estado inconsistente')).toBeInTheDocument();

    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(screen.getByText('painel recuperado')).toBeInTheDocument();
  });

  it('mostra uma mensagem padrão quando o erro não tem texto', () => {
    render(
      <ErrorBoundary>
        <Silent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Erro desconhecido.')).toBeInTheDocument();
  });
});
