import { useId, useMemo, useState } from 'react';
import { buildPreviewStyle } from '../../shared/overlay';
import { MODE_LABELS, TARGET_LABELS } from '../../shared/params';
import type { FxParams } from '../../shared/types';
import { IconPlay, IconRefresh } from './Icons';
import { Badge, Card, cx } from './ui';

export function Preview({
  params,
  active,
  applied,
  owner,
}: {
  params: FxParams;
  active: boolean;
  applied: boolean;
  owner?: 'ui' | 'automation';
}) {
  const [replay, setReplay] = useState(0);
  const rawId = useId();
  const instance = rawId.replace(/[^a-zA-Z0-9_-]/g, '') || 'stage';
  const token = `${instance}-${replay.toString(36)}`;
  const { id, css } = useMemo(() => buildPreviewStyle(params, token), [params, token]);
  const stageLabelId = useId();

  const status = active
    ? owner === 'automation'
      ? 'AUTOMAÇÃO'
      : 'AO VIVO'
    : applied
      ? 'PRONTO'
      : 'PRÉVIA';

  // `mode` e `target` trocam a geometria/animação; remontar o elemento garante
  // que a animação recomece em vez de ficar congelada no fim do hit anterior.
  const sheetKey = `${id}:${params.mode}:${params.target}`;

  return (
    <Card
      kicker="Prévia local"
      title="Antes de projetar"
      icon={<IconPlay size={15} />}
      action={
        <Badge tone={active ? 'accent' : applied ? 'success' : 'neutral'} dot>
          {status}
        </Badge>
      }
      className="pfx-preview-card"
      bodyClassName="pfx-preview-body"
    >
      <figure className="pfx-stage" aria-labelledby={stageLabelId}>
        <figcaption id={stageLabelId} className="pfx-visually-hidden">
          Simulação do palco
        </figcaption>
        <div className="pfx-stage-canvas" aria-hidden="true">
          <style>{css}</style>
          <div key={sheetKey} id={id} className="pfx-preview-sheet" />
          <span className={cx('pfx-stage-live', active && 'is-active')}>
            <span />
            {MODE_LABELS[params.mode]}
          </span>
        </div>
        {/* O palco inteiro é clicável; a dica visual fica no botão do rodapé. */}
        <button
          type="button"
          className="pfx-stage-replay"
          onClick={() => setReplay((value) => value + 1)}
          aria-label="Repetir a prévia"
          title="Clique para repetir a prévia"
        />
      </figure>

      <div className="pfx-preview-foot">
        <div className="pfx-preview-meta">
          <span>{TARGET_LABELS[params.target]}</span>
          <span className="pfx-dot-separator" aria-hidden="true" />
          <span>{MODE_LABELS[params.mode]}</span>
        </div>
        <button
          type="button"
          className="pfx-preview-replay"
          onClick={() => setReplay((value) => value + 1)}
          title="Repetir a prévia"
        >
          <IconRefresh size={13} />
          Repetir
        </button>
      </div>
    </Card>
  );
}
