import { Component, type ErrorInfo, type ReactNode } from 'react';
import { IconAlert, IconRefresh } from './components/Icons';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Última barreira do painel.
 *
 * A thread de lógica continua viva quando a UI quebra; os efeitos em execução
 * seguem no palco. O fallback só oferece recarregar o painel, sem tentar
 * reconstruir um estado que pode estar inconsistente.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // React já reporta o erro no console do painel. A UI não tem canal de log
    // no host (de propósito: nada de telemetria), então não há para onde enviar.
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="pfx-app pfx-boot" role="alert">
        <div className="pfx-boot-mark pfx-boot-mark--error" aria-hidden="true">
          <IconAlert size={34} />
        </div>
        <span className="pfx-kicker">Pulse FX</span>
        <h1>O painel encontrou um erro</h1>
        <p>
          A lógica do plugin e os efeitos em execução continuam no palco. Tente recarregar o painel;
          se o erro voltar, feche e abra a janela do plugin no Spresenter.
        </p>
        <pre className="pfx-error-detail">{error.message || 'Erro desconhecido.'}</pre>
        <button type="button" className="pfx-button pfx-button--secondary" onClick={this.retry}>
          <IconRefresh size={14} />
          Tentar novamente
        </button>
      </div>
    );
  }
}
