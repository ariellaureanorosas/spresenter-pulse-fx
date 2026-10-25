import { useEffect, useRef, useState } from 'react';
import { buildPreviewDocument } from '../../shared/overlay';
import { MODE_LABELS, TARGET_LABELS } from '../../shared/params';
import type { FxParams } from '../../shared/types';
import { IconPlay, IconRefresh } from './Icons';
import { Badge, Card, cx } from './ui';

function previewToken(replay: number): string {
  return `preview-${replay.toString(36)}-${Date.now().toString(36)}`;
}

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
  const [doc, setDoc] = useState(() => buildPreviewDocument(params, previewToken(0)));
  const firstRender = useRef(true);
  const signature = JSON.stringify(params);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setDoc(buildPreviewDocument(params, previewToken(replay)));
    }, 85);
    return () => window.clearTimeout(timer);
    // `signature` representa todos os campos visuais; `replay` rearma o hit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, replay]);

  const status = active
    ? owner === 'automation'
      ? 'AUTOMAÇÃO'
      : 'AO VIVO'
    : applied
      ? 'PRONTO'
      : 'PRÉVIA';

  return (
    <Card
      kicker="Prévia local"
      title="Antes de projetar"
      icon={<IconPlay size={15} />}
      action={<Badge tone={active ? 'accent' : applied ? 'success' : 'neutral'} dot>{status}</Badge>}
      className="pfx-preview-card"
      bodyClassName="pfx-preview-body"
    >
      <div className="pfx-stage" aria-label="Simulação do palco">
        <div className="pfx-stage-decor" aria-hidden="true">
          <span className="pfx-stage-grid" />
          <span className="pfx-stage-glow" />
          <span className="pfx-stage-word">SPRESENTER</span>
          <span className="pfx-stage-title">AO VIVO</span>
          <span className="pfx-stage-sub">saída simulada</span>
        </div>
        <iframe
          className="pfx-stage-frame"
          title="Prévia da animação do Pulse FX"
          sandbox=""
          srcDoc={doc}
        />
        <span className={cx('pfx-stage-live', active && 'is-active')} aria-hidden="true">
          <span />
          {MODE_LABELS[params.mode]}
        </span>
      </div>

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
