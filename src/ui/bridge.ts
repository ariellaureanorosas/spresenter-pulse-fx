import { onMessage, postMessage } from '@spresenter/plugin-sdk/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type ConfirmationRequest, isLogicEvent, type UiCommand } from '../shared/messages';
import { describeClamp } from '../shared/params';
import type { ToastLevel, UiState } from '../shared/types';
import { type Handshake, startHandshake } from './handshake';

export interface ToastItem {
  id: number;
  level: ToastLevel;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface PushToastOptions {
  level: ToastLevel;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

const TOAST_DURATION: Record<ToastLevel, number> = {
  info: 4200,
  success: 4200,
  warning: 7000,
  error: 9000,
};

export interface PulseBridge {
  state: UiState | null;
  connected: boolean;
  toasts: ToastItem[];
  confirmation: ConfirmationRequest | null;
  send: (command: UiCommand) => void;
  pushToast: (options: PushToastOptions) => void;
  dismissToast: (id: number) => void;
  confirmConfirmation: () => void;
  cancelConfirmation: () => void;
}

export function usePulseBridge(): PulseBridge {
  const [state, setState] = useState<UiState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);

  const stateRef = useRef<UiState | null>(null);
  const toastSeq = useRef(0);
  const toastTimers = useRef(new Map<number, number>());

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((options: PushToastOptions) => {
    const id = ++toastSeq.current;
    const item: ToastItem = {
      id,
      level: options.level,
      message: options.message,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
    };
    setToasts((current) => [...current.slice(-3), item]);

    const duration = options.durationMs ?? TOAST_DURATION[options.level];
    if (duration > 0) {
      const timer = window.setTimeout(() => {
        toastTimers.current.delete(id);
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, duration);
      toastTimers.current.set(id, timer);
    }
  }, []);

  const send = useCallback((command: UiCommand) => {
    postMessage(command);
  }, []);

  useEffect(() => {
    let handshake: Handshake | null = null;

    const off = onMessage((raw) => {
      if (!isLogicEvent(raw)) return;

      if (raw.type === 'state') {
        handshake?.stop();
        const next = raw.state;
        if (stateRef.current && next.revision < stateRef.current.revision) return;
        stateRef.current = next;
        setState((current) => {
          if (current && next.revision < current.revision) return current;
          return next;
        });
        return;
      }

      if (raw.type === 'toast') {
        pushToast({ level: raw.level, message: raw.message });
        return;
      }

      if (raw.type === 'error') {
        pushToast({ level: 'error', message: raw.message });
        return;
      }

      if (raw.type === 'clamped') {
        pushToast({
          level: 'warning',
          message: `Automação: ${describeClamp(raw.clamp)}`,
        });
        return;
      }

      if (raw.type === 'confirmationRequired') {
        setConfirmation(raw.request);
      }
    });

    handshake = startHandshake({
      send: (command) => postMessage(command),
      isConnected: () => stateRef.current !== null,
    });

    const requestRefresh = () => send({ type: 'requestState' });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') requestRefresh();
    };

    window.addEventListener('focus', requestRefresh);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      off();
      handshake?.stop();
      window.removeEventListener('focus', requestRefresh);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const timer of toastTimers.current.values()) {
        window.clearTimeout(timer);
      }
      toastTimers.current.clear();
    };
  }, [pushToast, send]);

  const confirmConfirmation = useCallback(() => {
    const request = confirmation;
    const current = stateRef.current;
    setConfirmation(null);
    if (!request) return;

    if (request.action === 'move') {
      send({
        type: 'selectTarget',
        output: request.output,
        layer: request.layer,
        force: true,
      });
      return;
    }

    if (
      current &&
      (current.selection.output !== request.output || current.selection.layer !== request.layer)
    ) {
      pushToast({
        level: 'warning',
        message: 'A seleção mudou. Revise o alvo e tente novamente.',
      });
      send({ type: 'requestState' });
      return;
    }

    if (request.action === 'apply') {
      send({ type: 'applyOverlay', force: true });
      return;
    }

    if (current?.params.mode === 'hit') {
      send({ type: 'fire', force: true });
    } else {
      send({ type: 'startContinuous', force: true });
    }
  }, [confirmation, pushToast, send]);

  const cancelConfirmation = useCallback(() => {
    setConfirmation(null);
    send({ type: 'requestState' });
  }, [send]);

  return {
    state,
    connected: state !== null,
    toasts,
    confirmation,
    send,
    pushToast,
    dismissToast,
    confirmConfirmation,
    cancelConfirmation,
  };
}
