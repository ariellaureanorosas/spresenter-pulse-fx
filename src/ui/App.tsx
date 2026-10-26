import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PARAMS,
  describeClamp,
  FREQUENCY_HARD_MAX_HZ,
  FREQUENCY_SAFETY_MAX_HZ,
  formatHz,
  MODE_LABELS,
  normalizeParamsWithMeta,
  PARAM_RANGES,
  TARGET_LABELS,
} from '../shared/params';
import {
  findOutput,
  highestAvailableLayer,
  isLayerDisabled,
  layerLabel,
  outputLabel,
  sanitizeLayer,
} from '../shared/selection';
import type { FxParams, LayerDto, PulseMode } from '../shared/types';
import { usePulseBridge } from './bridge';
import {
  IconAlert,
  IconAutomation,
  IconBolt,
  IconCheck,
  IconClose,
  IconGauge,
  IconLayers,
  IconMonitor,
  IconPlay,
  IconPulse,
  IconRefresh,
  IconRotate,
  IconShield,
  IconShieldOff,
  IconSparkles,
  IconStop,
} from './components/Icons';
import { Preview } from './components/Preview';
import {
  Badge,
  Button,
  Card,
  ColorField,
  ConfirmDialog,
  cx,
  ModePicker,
  Notice,
  RangeControl,
  SelectField,
  TargetPicker,
  ToastStack,
  ToggleRow,
} from './components/ui';
import { PLUGIN_VERSION } from './version';

const MODE_HINT: Record<PulseMode, string> = {
  hit: 'Cada disparo cria um flash novo, com queda própria. Ideal para acentos e viradas.',
  strobe: 'Piscadas em passos duros. A largura controla quanto tempo o flash fica aceso.',
  pulse: 'Respiração contínua e suave, de 0,5 a 20 Hz conforme a trava de segurança.',
};

const CLAMP_SOURCE: Record<'ui' | 'automation' | 'storage', string> = {
  ui: 'painel',
  automation: 'automação',
  storage: 'preferências salvas',
};

function describeLayer(layers: LayerDto[], index: number): string {
  const name = layerLabel(layers, index);
  if (name === `Camada ${index}`) return name;
  return `Camada ${index} · ${name}`;
}

function outputOptionLabel(output: { index: number; name: string }): string {
  const name = output.name.trim();
  if (!name || name.toLowerCase() === `saída ${output.index}`.toLowerCase()) {
    return `Saída ${output.index}`;
  }
  return `Saída ${output.index} · ${name}`;
}

function formatMilliseconds(value: number): string {
  return `${Math.round(value)} ms`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatIntensity(value: number): string {
  return `${Math.round(value)}%`;
}

function BootScreen({ onRetry }: { onRetry: () => void }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 6500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="pfx-app pfx-boot">
      <div className="pfx-boot-mark" aria-hidden="true">
        <IconPulse size={34} />
      </div>
      <span className="pfx-kicker">Pulse FX</span>
      <h1>Conectando ao palco</h1>
      <p>A lógica do plugin está iniciando e carregando as saídas.</p>
      <div className="pfx-boot-loader" aria-hidden="true">
        <span />
      </div>
      {slow && (
        <>
          <p className="pfx-boot-slow">
            O Spresenter ainda não respondeu. O painel continua tentando conectar automaticamente.
            Se persistir, feche e abra o painel ou confira a instalação do plugin.
          </p>
          <Button size="sm" variant="secondary" icon={<IconRefresh size={14} />} onClick={onRetry}>
            Tentar novamente
          </Button>
        </>
      )}
    </div>
  );
}

export function App() {
  const {
    state,
    toasts,
    confirmation,
    send,
    pushToast,
    dismissToast,
    confirmConfirmation,
    cancelConfirmation,
  } = usePulseBridge();

  const [localParams, setLocalParams] = useState<FxParams | null>(null);
  const remoteParams = useRef<FxParams | null>(null);
  const dirty = useRef(false);
  const settleTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!state) return;
    remoteParams.current = state.params;
    if (!dirty.current) setLocalParams(state.params);
  }, [state]);

  useEffect(
    () => () => {
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    },
    [],
  );

  const scheduleSettle = useCallback(() => {
    dirty.current = true;
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null;
      dirty.current = false;
      if (remoteParams.current) setLocalParams(remoteParams.current);
    }, 420);
  }, []);

  const updateParams = useCallback(
    (patch: Partial<FxParams>) => {
      setLocalParams((current) => {
        const base = current ?? remoteParams.current ?? DEFAULT_PARAMS;
        const safetyLock =
          typeof patch.safetyLock === 'boolean' ? patch.safetyLock : base.safetyLock;
        return normalizeParamsWithMeta({ ...base, ...patch }, safetyLock).params;
      });
      scheduleSettle();
      send({ type: 'setParams', params: patch });
    },
    [scheduleSettle, send],
  );

  const restoreDefaults = useCallback(() => {
    const snapshot = localParams ?? state?.params ?? DEFAULT_PARAMS;
    setLocalParams(normalizeParamsWithMeta(DEFAULT_PARAMS).params);
    scheduleSettle();
    send({ type: 'restoreDefaults' });
    pushToast({
      level: 'info',
      message: 'Parâmetros restaurados ao padrão. A trava de segurança foi religada.',
      actionLabel: 'Desfazer',
      onAction: () => updateParams(snapshot),
      durationMs: 8000,
    });
  }, [localParams, pushToast, scheduleSettle, send, state, updateParams]);

  if (!state) return <BootScreen onRetry={() => send({ type: 'requestState' })} />;

  const params = localParams ?? state.params;
  const { selection, outputs, layers } = state;
  const currentOutput = findOutput(outputs, selection.output);
  const ready = state.ready;
  const activeCount = state.effects.length;
  const selectedEffect = state.selectedEffect;
  const applied = state.applied;
  const layerDisabled = state.layerDisabled;
  const noOutputs = ready && outputs.length === 0;
  const canRun = ready && !noOutputs && !layerDisabled;
  const limitHz = params.safetyLock ? FREQUENCY_SAFETY_MAX_HZ : FREQUENCY_HARD_MAX_HZ;
  const clamp = state.lastClamp;
  const outputName = outputLabel(outputs, selection.output);
  const targetName = `${outputName} · ${describeLayer(layers, selection.layer)}`;
  const otherApplied = state.appliedTargets.filter(
    (item) => item.output !== selection.output || item.layer !== selection.layer,
  );

  const triggerLabel =
    params.mode === 'hit'
      ? 'Disparar hit'
      : selectedEffect?.mode === params.mode && selectedEffect.owner === 'ui'
        ? `Reiniciar ${MODE_LABELS[params.mode].toLowerCase()}`
        : `Iniciar ${MODE_LABELS[params.mode].toLowerCase()}`;

  const outputHint = currentOutput
    ? [
        currentOutput.width && currentOutput.height
          ? `${currentOutput.width} × ${currentOutput.height}`
          : null,
        currentOutput.disabledLayers.length === 1
          ? '1 camada desativada'
          : currentOutput.disabledLayers.length > 1
            ? `${currentOutput.disabledLayers.length} camadas desativadas`
            : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Nenhuma saída detectada';

  const runTitle = selectedEffect
    ? `${MODE_LABELS[selectedEffect.mode]} em execução`
    : applied
      ? 'Overlay pronto'
      : 'Nada em execução';
  const runDescription = selectedEffect
    ? selectedEffect.owner === 'automation'
      ? 'Iniciado pela automação do Spresenter.'
      : 'Iniciado por este painel.'
    : applied
      ? 'A camada está preparada para o próximo efeito.'
      : 'O primeiro disparo aplica o overlay automaticamente.';

  const layerOptions = layers.length > 0 ? layers : [{ index: selection.layer }];

  const selectOutput = (value: string) => {
    const nextOutput = findOutput(outputs, value);
    let nextLayer = selection.layer;
    if (nextOutput && layers.length > 0 && isLayerDisabled(nextOutput, nextLayer)) {
      nextLayer = highestAvailableLayer(nextOutput, layers);
    }
    send({ type: 'selectTarget', output: value, layer: nextLayer });
  };

  const selectLayer = (value: string) => {
    send({
      type: 'selectTarget',
      output: selection.output,
      layer: sanitizeLayer(value, selection.layer),
    });
  };

  return (
    <div className="pfx-app">
      <header className="pfx-header">
        <div className="pfx-header-main">
          <div className="pfx-brand">
            <span className="pfx-logo" aria-hidden="true">
              <IconPulse size={21} />
            </span>
            <div className="pfx-brand-copy">
              <span className="pfx-brand-name">Pulse FX</span>
              <span className="pfx-brand-sub">efeitos de luz ao vivo</span>
            </div>
          </div>

          <div className="pfx-header-actions">
            <span
              className={cx(
                'pfx-connection',
                !ready ? 'is-waiting' : noOutputs ? 'is-warning' : 'is-online',
              )}
              title={noOutputs ? 'Nenhuma saída disponível' : 'Ligado à lógica do plugin'}
            >
              <span className="pfx-connection-dot" aria-hidden="true" />
              {!ready ? 'Iniciando' : noOutputs ? 'Sem saída' : 'Online'}
            </span>
            <button
              type="button"
              className={cx('pfx-stopall', activeCount > 0 && 'is-hot')}
              onClick={() => send({ type: 'stopAll' })}
              title="Parar todos os efeitos, inclusive os da automação"
            >
              <IconStop size={15} />
              <span>Parar tudo</span>
            </button>
          </div>
        </div>

        {!params.safetyLock && (
          <div className="pfx-header-alert" role="alert">
            <IconAlert size={14} />
            <span>Trava desligada — teto técnico de 20 Hz.</span>
            <button type="button" onClick={() => updateParams({ safetyLock: true })}>
              Religar
            </button>
          </div>
        )}
      </header>

      <main className="pfx-main">
        {noOutputs && (
          <Notice
            tone="warning"
            title="Nenhuma saída disponível"
            action={
              <Button
                size="sm"
                variant="secondary"
                icon={<IconRefresh size={14} />}
                onClick={() => send({ type: 'refreshOutputs' })}
              >
                Atualizar
              </Button>
            }
          >
            Abra ou conecte uma saída no Spresenter para escolher a camada do efeito.
          </Notice>
        )}

        <Preview
          params={params}
          active={!!selectedEffect}
          applied={applied}
          owner={selectedEffect?.owner}
        />

        <Card
          kicker="Destino"
          title="Onde o efeito aparece"
          icon={<IconMonitor size={15} />}
          action={
            <button
              type="button"
              className="pfx-icon-button"
              title="Atualizar saídas e camadas"
              aria-label="Atualizar saídas e camadas"
              onClick={() => send({ type: 'refreshOutputs' })}
            >
              <IconRefresh size={15} />
            </button>
          }
        >
          <div className="pfx-target-selects">
            <SelectField
              label="Saída"
              value={selection.output}
              onChange={selectOutput}
              disabled={!ready || noOutputs}
              hint={outputHint}
            >
              {outputs.length === 0 ? (
                <option value={selection.output}>Saída {selection.output}</option>
              ) : (
                outputs.map((output) => (
                  <option key={output.index} value={String(output.index)}>
                    {outputOptionLabel(output)}
                  </option>
                ))
              )}
            </SelectField>

            <SelectField
              label="Camada"
              value={String(selection.layer)}
              onChange={selectLayer}
              disabled={!ready}
              hint="Índices maiores ficam por cima."
            >
              {layerOptions.map((layer) => {
                const disabled = isLayerDisabled(currentOutput, layer.index);
                return (
                  <option key={layer.index} value={String(layer.index)} disabled={disabled}>
                    {describeLayer(layers, layer.index)}
                    {disabled ? ' (desativada)' : ''}
                  </option>
                );
              })}
            </SelectField>
          </div>

          <div className="pfx-layer-status">
            <div className="pfx-layer-status-copy">
              {layerDisabled ? (
                <Badge tone="danger" dot>
                  Camada desativada
                </Badge>
              ) : applied ? (
                <Badge tone="success" dot>
                  Overlay do Pulse FX aplicado
                </Badge>
              ) : state.layerOccupiedByUs ? (
                <Badge tone="success" dot>
                  Stage do Pulse FX na camada
                </Badge>
              ) : state.layerOccupied === true ? (
                <Badge tone="warning" dot>
                  Conteúdo nesta camada
                </Badge>
              ) : state.layerOccupied === false ? (
                <Badge tone="neutral" dot>
                  Camada livre
                </Badge>
              ) : (
                <Badge tone="warning" dot>
                  Não verificada
                </Badge>
              )}
              <span className="pfx-layer-target">{targetName}</span>
            </div>

            <Button
              variant={applied ? 'secondary' : 'primary'}
              size="sm"
              icon={applied ? <IconClose size={14} /> : <IconMonitor size={14} />}
              disabled={applied ? !ready : !canRun}
              onClick={() => send({ type: applied ? 'removeOverlay' : 'applyOverlay' })}
            >
              {applied ? 'Remover da saída' : 'Aplicar na saída'}
            </Button>
          </div>

          {layerDisabled && (
            <Notice
              tone="danger"
              title="Esta camada está desativada na saída"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    send({
                      type: 'selectTarget',
                      output: selection.output,
                      layer: highestAvailableLayer(currentOutput, layers),
                    })
                  }
                >
                  Usar camada livre
                </Button>
              }
            >
              Escolha outra camada para o Pulse FX. O app não permite aplicar conteúdo nesta.
            </Notice>
          )}

          {!layerDisabled &&
            state.layerOccupied === true &&
            !state.layerOccupiedByUs &&
            !applied && (
              <Notice tone="warning" title="Aplicar substitui o conteúdo atual">
                O Pulse FX ocupa a camada inteira. O conteúdo anterior não é restaurado ao remover o
                overlay, por isso o painel pedirá confirmação antes de aplicar.
              </Notice>
            )}

          {otherApplied.length > 0 && (
            <div className="pfx-other-applied">
              <span className="pfx-mini-label">Também ativo em</span>
              <div className="pfx-chip-row">
                {otherApplied.map((item) => (
                  <span
                    key={`${item.output}:${item.layer}`}
                    className="pfx-chip"
                    title="Overlay aplicado por este plugin"
                  >
                    {outputLabel(outputs, item.output)} · {describeLayer(layers, item.layer)}
                    {item.effect ? ` · ${MODE_LABELS[item.effect]}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card kicker="Movimento" title="Escolha o modo" icon={<IconSparkles size={15} />}>
          <ModePicker
            value={params.mode}
            onChange={(mode) => updateParams({ mode })}
            disabled={!ready}
          />
          <p className="pfx-copy pfx-copy--muted">{MODE_HINT[params.mode]}</p>
        </Card>

        <Card
          kicker="Composição"
          title="Ajuste a luz"
          icon={<IconGauge size={15} />}
          action={
            <button
              type="button"
              className="pfx-icon-button"
              title="Restaurar parâmetros padrão"
              aria-label="Restaurar parâmetros padrão"
              disabled={!ready}
              onClick={restoreDefaults}
            >
              <IconRotate size={15} />
            </button>
          }
        >
          <ColorField
            value={params.color}
            onChange={(color) => updateParams({ color })}
            disabled={!ready}
          />

          <RangeControl
            label="Intensidade"
            value={params.intensity}
            min={PARAM_RANGES.intensity.min}
            max={PARAM_RANGES.intensity.max}
            step={PARAM_RANGES.intensity.step}
            onChange={(intensity) => updateParams({ intensity })}
            formatValue={formatIntensity}
            minLabel="0%"
            maxLabel="100%"
            disabled={!ready}
          />

          <div className="pfx-field-block">
            <span className="pfx-field-label">Área do efeito</span>
            <TargetPicker
              value={params.target}
              onChange={(target) => updateParams({ target })}
              disabled={!ready}
            />
          </div>

          <div className="pfx-range-stack">
            {params.mode === 'hit' && (
              <RangeControl
                label="Queda"
                value={params.decayMs}
                min={PARAM_RANGES.decayMs.min}
                max={PARAM_RANGES.decayMs.max}
                step={PARAM_RANGES.decayMs.step}
                onChange={(decayMs) => updateParams({ decayMs })}
                formatValue={formatMilliseconds}
                minLabel="30 ms"
                maxLabel="2 s"
                hint="Duração do flash"
                disabled={!ready}
              />
            )}

            {params.mode !== 'hit' && (
              <RangeControl
                label="Frequência"
                value={params.frequencyHz}
                min={PARAM_RANGES.frequencyHz.min}
                max={limitHz}
                step={PARAM_RANGES.frequencyHz.step}
                onChange={(frequencyHz) => updateParams({ frequencyHz })}
                formatValue={formatHz}
                minLabel={formatHz(PARAM_RANGES.frequencyHz.min)}
                maxLabel={formatHz(limitHz)}
                hint={params.safetyLock ? 'Máximo de 3 Hz' : 'Teto técnico de 20 Hz'}
                disabled={!ready}
              />
            )}

            {params.mode === 'strobe' && (
              <RangeControl
                label="Largura"
                value={params.flashWidth}
                min={PARAM_RANGES.flashWidth.min}
                max={PARAM_RANGES.flashWidth.max}
                step={PARAM_RANGES.flashWidth.step}
                onChange={(flashWidth) => updateParams({ flashWidth })}
                formatValue={formatPercent}
                minLabel="5%"
                maxLabel="95%"
                hint="Tempo aceso por ciclo"
                disabled={!ready}
              />
            )}

            {params.target !== 'full' && (
              <div className="pfx-range-pair">
                <RangeControl
                  label="Espessura"
                  value={params.thickness}
                  min={PARAM_RANGES.thickness.min}
                  max={PARAM_RANGES.thickness.max}
                  step={PARAM_RANGES.thickness.step}
                  onChange={(thickness) => updateParams({ thickness })}
                  formatValue={formatPercent}
                  minLabel="0%"
                  maxLabel="100%"
                  disabled={!ready}
                />
                <RangeControl
                  label="Suavizar"
                  value={params.softness}
                  min={PARAM_RANGES.softness.min}
                  max={PARAM_RANGES.softness.max}
                  step={PARAM_RANGES.softness.step}
                  onChange={(softness) => updateParams({ softness })}
                  formatValue={formatPercent}
                  minLabel="0%"
                  maxLabel="100%"
                  disabled={!ready}
                />
              </div>
            )}
          </div>

          <p className="pfx-copy pfx-copy--muted pfx-geometry-hint">
            {params.target === 'full'
              ? `${TARGET_LABELS[params.target]}: a cor cobre a saída inteira.`
              : params.target === 'vignette'
                ? 'A vinheta usa um gradiente radial; espessura 0 esconde o efeito.'
                : 'A moldura usa sombra interna; espessura 0 esconde o efeito.'}
          </p>
        </Card>

        <Card
          kicker="Proteção"
          title="Trava de frequência"
          icon={params.safetyLock ? <IconShield size={15} /> : <IconShieldOff size={15} />}
          action={
            <Badge tone={params.safetyLock ? 'success' : 'danger'} dot>
              {params.safetyLock ? 'Ativa' : 'Desligada'}
            </Badge>
          }
        >
          <ToggleRow
            label="Trava de segurança"
            description="Limita o painel e a automação a 3 Hz. Ligada por padrão e salva com as preferências."
            checked={params.safetyLock}
            onChange={(safetyLock) => updateParams({ safetyLock })}
            disabled={!ready}
            icon={params.safetyLock ? <IconShield size={15} /> : <IconShieldOff size={15} />}
            danger={!params.safetyLock}
          />

          <div className="pfx-safety-summary">
            <div>
              <span>Teto em vigor</span>
              <strong>{formatHz(limitHz)}</strong>
            </div>
            <div>
              <span>Frequência atual</span>
              <strong>{formatHz(params.frequencyHz)}</strong>
            </div>
          </div>

          <div className="pfx-safety-scale" aria-hidden="true">
            <div className="pfx-safety-track">
              <span className="pfx-safety-zone" />
              <span className="pfx-safety-mark" />
            </div>
            <div className="pfx-safety-labels">
              <span>{formatHz(PARAM_RANGES.frequencyHz.min)}</span>
              <span>3 Hz</span>
              <span>{formatHz(FREQUENCY_HARD_MAX_HZ)}</span>
            </div>
          </div>

          {!params.safetyLock && (
            <Notice
              tone="danger"
              title="Trava desligada"
              action={
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => updateParams({ safetyLock: true })}
                >
                  Religar trava
                </Button>
              }
            >
              O teto técnico de {formatHz(FREQUENCY_HARD_MAX_HZ)} continua ativo, mas flashes
              rápidos podem incomodar ou afetar pessoas com fotossensibilidade. Use com cautela.
            </Notice>
          )}

          {clamp && (
            <Notice tone="warning" title="Frequência ajustada" icon={<IconGauge size={16} />}>
              <p>{describeClamp(clamp)}</p>
              <span className="pfx-notice-meta">
                Origem: {CLAMP_SOURCE[clamp.source]} · aplicado: {formatHz(clamp.hz)}
              </span>
            </Notice>
          )}
        </Card>

        <Card
          kicker="Execução"
          title="Controle ao vivo"
          icon={<IconBolt size={15} />}
          action={
            activeCount > 0 ? (
              <Badge tone="accent" dot>
                {activeCount === 1 ? '1 ativo' : `${activeCount} ativos`}
              </Badge>
            ) : (
              <Badge tone="neutral">Ocioso</Badge>
            )
          }
        >
          <div className={cx('pfx-run-status', selectedEffect && 'is-running')}>
            <span className="pfx-run-pulse" aria-hidden="true" />
            <div className="pfx-run-copy">
              <div className="pfx-run-title">
                <strong>{runTitle}</strong>
                {selectedEffect?.owner === 'automation' && <Badge tone="info">automação</Badge>}
              </div>
              <span>{runDescription}</span>
            </div>
            {applied && !selectedEffect && (
              <span className="pfx-run-check" aria-hidden="true">
                <IconCheck size={18} />
              </span>
            )}
          </div>

          <Button
            variant="primary"
            size="lg"
            full
            disabled={!canRun}
            icon={params.mode === 'hit' ? <IconBolt size={17} /> : <IconPlay size={17} />}
            onClick={() =>
              send({
                type: params.mode === 'hit' ? 'fire' : 'startContinuous',
              })
            }
          >
            {triggerLabel}
          </Button>

          <div className="pfx-run-actions">
            <Button
              variant="secondary"
              full
              disabled={!selectedEffect}
              icon={<IconStop size={14} />}
              onClick={() => send({ type: 'stop' })}
            >
              Parar nesta camada
            </Button>
          </div>

          <p className="pfx-copy pfx-copy--muted">
            {applied
              ? 'O overlay já está aplicado. Disparar não troca a camada.'
              : 'Ao disparar, o overlay é aplicado automaticamente na camada escolhida.'}
            {state.layerOccupied === true && !state.layerOccupiedByUs && !applied
              ? ' Como a camada tem conteúdo, uma confirmação será pedida antes.'
              : ''}
          </p>
        </Card>

        <Card kicker="Automação" title="Pronto para o palco" icon={<IconAutomation size={15} />}>
          <p className="pfx-copy">
            Três nós ficam em <strong>Automação → Pulse FX</strong> e continuam funcionando com o
            painel fechado:
          </p>
          <ul className="pfx-auto-list">
            <li>
              <IconBolt size={14} />
              <span>
                <strong>Disparar hit</strong> — cor, intensidade, queda e alvo próprios.
              </span>
            </li>
            <li>
              <IconSparkles size={14} />
              <span>
                <strong>Strobe / Pulse</strong> — liga e desliga o efeito contínuo.
              </span>
            </li>
            <li>
              <IconLayers size={14} />
              <span>
                <strong>Aplicar / remover overlay</strong> — prepara ou limpa a camada.
              </span>
            </li>
          </ul>
          <p className="pfx-copy pfx-copy--muted">
            A mesma trava de 3 Hz vale para os nós. Painel, automação e eventos usam uma fila serial
            e o mesmo motor de efeitos.
          </p>
        </Card>

        <footer className="pfx-footer">
          <span>Pulse FX v{PLUGIN_VERSION}</span>
          <span className="pfx-dot-separator" aria-hidden="true" />
          <span>Preferências salvas automaticamente</span>
        </footer>
      </main>

      <ToastStack items={toasts} onDismiss={dismissToast} />
      <ConfirmDialog
        request={confirmation}
        onConfirm={confirmConfirmation}
        onCancel={cancelConfirmation}
      />
    </div>
  );
}
