import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { normalizeColor, toHexColor } from '../../shared/params';
import type { FxTarget, PulseMode, ToastLevel } from '../../shared/types';
import type { ConfirmationRequest } from '../../shared/messages';
import type { ToastItem } from '../bridge';
import {
  IconAlert,
  IconBolt,
  IconCheck,
  IconClose,
  IconInfo,
  IconPulse,
  IconSparkles,
} from './Icons';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

// ── Card ─────────────────────────────────────────────────────

export interface CardProps {
  kicker?: string;
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Card({
  kicker,
  title,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: CardProps) {
  return (
    <section className={cx('pfx-card', className)}>
      {(title || action) && (
        <header className="pfx-card-head">
          <div className="pfx-card-title">
            {icon && <span className="pfx-card-icon">{icon}</span>}
            <div>
              {kicker && <span className="pfx-kicker">{kicker}</span>}
              {title && <h2>{title}</h2>}
            </div>
          </div>
          {action && <div className="pfx-card-action">{action}</div>}
        </header>
      )}
      <div className={cx('pfx-card-body', bodyClassName)}>{children}</div>
    </section>
  );
}

// ── Button / badge ───────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'quiet';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  full,
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'pfx-button',
        `pfx-button--${variant}`,
        `pfx-button--${size}`,
        full && 'is-full',
        className,
      )}
      {...props}
    >
      {icon && <span className="pfx-button-icon">{icon}</span>}
      {children && <span className="pfx-button-label">{children}</span>}
    </button>
  );
}

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({
  tone = 'neutral',
  dot,
  children,
  className,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx('pfx-badge', `pfx-badge--${tone}`, className)}>
      {dot && <span className="pfx-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

// ── Fields ───────────────────────────────────────────────────

export function SelectField({
  label,
  value,
  onChange,
  disabled,
  hint,
  children,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('pfx-field', className)}>
      <span className="pfx-field-label">{label}</span>
      <span className={cx('pfx-select', disabled && 'is-disabled')}>
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          {children}
        </select>
        <svg
          className="pfx-select-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
      {hint && <span className="pfx-field-hint">{hint}</span>}
    </label>
  );
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  hint,
  minLabel,
  maxLabel,
  disabled,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  hint?: ReactNode;
  minLabel?: string;
  maxLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const ratio = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  const style = { '--pfx-range-fill': `${ratio * 100}%` } as CSSProperties;
  const formatted = formatValue ? formatValue(value) : String(value);

  return (
    <div className={cx('pfx-range', disabled && 'is-disabled', className)}>
      <div className="pfx-range-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{formatted}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={style}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="pfx-range-foot">
        <span>{minLabel ?? ''}</span>
        {hint && <span className="pfx-range-hint">{hint}</span>}
        <span>{maxLabel ?? ''}</span>
      </div>
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  icon,
  danger,
}: {
  label: string;
  description: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  icon?: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={cx('pfx-toggle-row', danger && 'is-danger', disabled && 'is-disabled')}>
      <div className="pfx-toggle-copy">
        <span className="pfx-toggle-label">
          {icon && <span className="pfx-toggle-icon">{icon}</span>}
          {label}
        </span>
        <p>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="pfx-switch"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="pfx-switch-knob" />
      </button>
    </div>
  );
}

// ── Notice ───────────────────────────────────────────────────

type NoticeTone = 'info' | 'success' | 'warning' | 'danger' | 'accent';

export function Notice({
  tone = 'info',
  title,
  icon,
  children,
  action,
  className,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const fallbackIcon =
    tone === 'warning' || tone === 'danger' ? (
      <IconAlert size={16} />
    ) : tone === 'success' ? (
      <IconCheck size={16} />
    ) : (
      <IconInfo size={16} />
    );

  return (
    <div
      className={cx('pfx-notice', `pfx-notice--${tone}`, className)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <span className="pfx-notice-icon">{icon ?? fallbackIcon}</span>
      <div className="pfx-notice-copy">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className="pfx-notice-action">{action}</div>}
    </div>
  );
}

// ── Color ────────────────────────────────────────────────────

const COLOR_PRESETS = ['#ffffff', '#ff3b5c', '#ffb224', '#c6ff4a', '#35e0ff', '#b16cff'];

export function ColorField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const pickerValue = toHexColor(value);
  return (
    <div className={cx('pfx-color', disabled && 'is-disabled')}>
      <div className="pfx-color-main">
        <label className="pfx-color-well" title="Escolher cor">
          <input
            type="color"
            value={pickerValue}
            disabled={disabled}
            aria-label="Cor do efeito"
            onChange={(event) => onChange(normalizeColor(event.target.value))}
          />
          <span className="pfx-color-swatch" style={{ background: value }} />
        </label>
        <div className="pfx-color-meta">
          <span className="pfx-field-label">Cor do efeito</span>
          <code>{value}</code>
        </div>
      </div>
      <div className="pfx-color-presets" role="group" aria-label="Cores rápidas">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={cx(
              'pfx-color-preset',
              pickerValue === preset.toLowerCase() && 'is-active',
            )}
            style={{ background: preset }}
            disabled={disabled}
            aria-label={`Usar cor ${preset}`}
            aria-pressed={pickerValue === preset.toLowerCase()}
            title={preset}
            onClick={() => onChange(preset)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Mode / target ────────────────────────────────────────────

const MODE_META: Record<
  PulseMode,
  { label: string; description: string; icon: ReactNode }
> = {
  hit: {
    label: 'Hit',
    description: 'Um flash e queda',
    icon: <IconBolt size={18} />,
  },
  strobe: {
    label: 'Strobe',
    description: 'Pisca em passos',
    icon: <IconSparkles size={18} />,
  },
  pulse: {
    label: 'Pulse',
    description: 'Respiração suave',
    icon: <IconPulse size={18} />,
  },
};

export function ModePicker({
  value,
  onChange,
  disabled,
}: {
  value: PulseMode;
  onChange: (mode: PulseMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="pfx-mode-grid" role="group" aria-label="Modo do efeito">
      {(Object.keys(MODE_META) as PulseMode[]).map((mode) => {
        const meta = MODE_META[mode];
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            className={cx('pfx-mode', active && 'is-active')}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(mode)}
          >
            <span className="pfx-mode-icon">{meta.icon}</span>
            <span className="pfx-mode-label">{meta.label}</span>
            <span className="pfx-mode-description">{meta.description}</span>
          </button>
        );
      })}
    </div>
  );
}

const TARGET_META: Record<FxTarget, { label: string; description: string }> = {
  full: { label: 'Tela cheia', description: 'Cobre toda a saída' },
  vignette: { label: 'Vinheta', description: 'Escurece as bordas' },
  frame: { label: 'Moldura', description: 'Borda luminosa' },
};

export function TargetPicker({
  value,
  onChange,
  disabled,
}: {
  value: FxTarget;
  onChange: (target: FxTarget) => void;
  disabled?: boolean;
}) {
  return (
    <div className="pfx-target-grid" role="group" aria-label="Área do efeito">
      {(Object.keys(TARGET_META) as FxTarget[]).map((target) => {
        const meta = TARGET_META[target];
        const active = value === target;
        return (
          <button
            key={target}
            type="button"
            className={cx('pfx-target', active && 'is-active')}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(target)}
          >
            <span className={cx('pfx-target-visual', `pfx-target-visual--${target}`)}>
              <span />
            </span>
            <span className="pfx-target-label">{meta.label}</span>
            <span className="pfx-target-description">{meta.description}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Confirmation ─────────────────────────────────────────────

const CONFIRM_TITLE: Record<ConfirmationRequest['action'], string> = {
  apply: 'Aplicar nesta camada?',
  move: 'Mover o overlay?',
  run: 'Disparar nesta camada?',
};

const CONFIRM_LABEL: Record<ConfirmationRequest['action'], string> = {
  apply: 'Substituir e aplicar',
  move: 'Substituir e mover',
  run: 'Substituir e disparar',
};

export function ConfirmDialog({
  request,
  onConfirm,
  onCancel,
}: {
  request: ConfirmationRequest | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!request) return;
    const previous = document.activeElement;
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled])'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [request, onCancel]);

  if (!request) return null;

  return (
    <div
      className="pfx-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="pfx-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="pfx-modal-icon">
          <IconAlert size={22} />
        </div>
        <div className="pfx-modal-copy">
          <span className="pfx-kicker">Confirmação necessária</span>
          <h2 id={titleId}>{CONFIRM_TITLE[request.action]}</h2>
          <p id={descriptionId}>{request.message}</p>
        </div>
        <div className="pfx-modal-actions">
          <button ref={cancelRef} type="button" className="pfx-button pfx-button--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="pfx-button pfx-button--danger" onClick={onConfirm}>
            {CONFIRM_LABEL[request.action]}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toasts ───────────────────────────────────────────────────

const TOAST_ICON: Record<ToastLevel, ReactNode> = {
  info: <IconInfo size={16} />,
  success: <IconCheck size={16} />,
  warning: <IconAlert size={16} />,
  error: <IconAlert size={16} />,
};

export function ToastStack({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="pfx-toasts" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <div
          key={item.id}
          className={cx('pfx-toast', `pfx-toast--${item.level}`)}
          role={item.level === 'error' ? 'alert' : 'status'}
        >
          <span className="pfx-toast-icon">{TOAST_ICON[item.level]}</span>
          <p>{item.message}</p>
          {item.actionLabel && item.onAction && (
            <button
              type="button"
              className="pfx-toast-action"
              onClick={() => {
                item.onAction?.();
                onDismiss(item.id);
              }}
            >
              {item.actionLabel}
            </button>
          )}
          <button
            type="button"
            className="pfx-toast-close"
            aria-label="Fechar aviso"
            onClick={() => onDismiss(item.id)}
          >
            <IconClose size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
