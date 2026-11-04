// Contrato das ações externas do plugin (`.../requests/<ação>`).
//
// Este módulo é puro: não conhece o host, o palco nem o motor de efeitos. Ele
// transforma o corpo recebido em uma configuração segura e devolve o motivo
// quando o pedido não pode ser aceito. Quem decide o que fazer é a thread de
// lógica (`src/code.ts`).
//
// A API é feita para ser chamada por máquina (Companion, script, outro plugin),
// então valores inválidos viram erro explícito em vez de silêncio. Números fora
// de faixa continuam sendo normalizados como no painel — o chamador recebe na
// resposta a frequência realmente aplicada.

import { sanitizeOutput } from '../shared/selection';

export type RequestStatus = 400 | 409;

/** Resposta de erro que a thread de lógica converte em `requests.error`. */
export interface RequestError {
  ok: false;
  status: RequestStatus;
  message: string;
}

export type Parsed<T> = { ok: true; value: T } | RequestError;

export interface StartRequest {
  mode: 'strobe' | 'pulse';
  /** Campos aceitos, já validados, no formato que `automationParams` espera. */
  config: Record<string, unknown>;
}

export interface StopRequest {
  config: Record<string, unknown>;
  force: boolean;
}

const MODES = new Set(['strobe', 'pulse']);
const TARGETS = new Set(['full', 'vignette', 'frame']);

const NUMBER_FIELDS = [
  'intensity',
  'decayMs',
  'frequency',
  'flashWidth',
  'thickness',
  'softness',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function fail(message: string): RequestError {
  return { ok: false, status: 400, message };
}

/**
 * O host entrega o corpo já interpretado num `POST`, mas num `GET` o payload é a
 * query string. Aceitamos também JSON em texto para chamadores que só conseguem
 * mandar uma string.
 */
export function readBody(raw: unknown): Record<string, unknown> {
  if (isRecord(raw)) return raw;
  if (typeof raw !== 'string') return {};

  const text = raw.trim();
  if (text === '') return {};

  if (text.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(text);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  try {
    return Object.fromEntries(new URLSearchParams(text));
  } catch {
    return {};
  }
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function readNumber(body: Record<string, unknown>, key: string): Parsed<number | undefined> {
  if (!hasValue(body[key])) return { ok: true, value: undefined };

  const raw = body[key];
  const numeric = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(numeric)) return fail(`${key} precisa ser numérico.`);
  return { ok: true, value: numeric };
}

function readOutput(body: Record<string, unknown>): Parsed<string | undefined> {
  if (!hasValue(body.output)) return { ok: true, value: undefined };

  // Sem fallback: um índice inválido não pode cair na seleção salva sem avisar.
  const output = sanitizeOutput(body.output, '');
  if (output === '') return fail('output inválido: use o índice da saída, como "0" ou "1".');
  return { ok: true, value: output };
}

function readLayer(body: Record<string, unknown>): Parsed<number | undefined> {
  if (!hasValue(body.layer)) return { ok: true, value: undefined };

  const numeric = Number(body.layer);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 99) {
    return fail('layer inválido: use um número inteiro entre 0 e 99.');
  }
  return { ok: true, value: numeric };
}

function readTarget(body: Record<string, unknown>): Parsed<string | undefined> {
  if (!hasValue(body.target)) return { ok: true, value: undefined };

  const target = String(body.target).trim().toLowerCase();
  if (!TARGETS.has(target)) return fail('target inválido: use "full", "vignette" ou "frame".');
  return { ok: true, value: target };
}

function readTargetFields(body: Record<string, unknown>): Parsed<Record<string, unknown>> {
  const config: Record<string, unknown> = {};

  const target = readTarget(body);
  if (!target.ok) return target;
  if (target.value !== undefined) config.target = target.value;

  const output = readOutput(body);
  if (!output.ok) return output;
  if (output.value !== undefined) config.output = output.value;

  const layer = readLayer(body);
  if (!layer.ok) return layer;
  if (layer.value !== undefined) config.layer = layer.value;

  return { ok: true, value: config };
}

/** Valida e monta o pedido de `start` (ligar o efeito contínuo). */
export function parseStartRequest(raw: unknown): Parsed<StartRequest> {
  const body = readBody(raw);

  const mode =
    body.mode === undefined || body.mode === null || String(body.mode).trim() === ''
      ? 'strobe'
      : String(body.mode).trim().toLowerCase();
  if (!MODES.has(mode)) {
    return fail('mode inválido: use "strobe" ou "pulse" (hit é disparo único, não contínuo).');
  }

  const targetFields = readTargetFields(body);
  if (!targetFields.ok) return targetFields;

  const config: Record<string, unknown> = { ...targetFields.value };

  if (hasValue(body.color)) {
    const color = body.color;
    if (typeof color !== 'string') return fail('color precisa ser texto, como "#22d3ee".');
    config.color = color;
  }

  for (const field of NUMBER_FIELDS) {
    const numeric = readNumber(body, field);
    if (!numeric.ok) return numeric;
    if (numeric.value !== undefined) config[field] = numeric.value;
  }

  return { ok: true, value: { mode: mode as StartRequest['mode'], config } };
}

/**
 * Valida e monta o pedido de `stop` (desligar o efeito contínuo).
 *
 * `force: true` encerra qualquer dono na camada; sem ele, o pedido só encerra o
 * que o próprio Companion iniciou — soltar o botão nunca derruba um efeito que o
 * operador ligou no painel.
 */
export function parseStopRequest(raw: unknown): Parsed<StopRequest> {
  const body = readBody(raw);

  const targetFields = readTargetFields(body);
  if (!targetFields.ok) return targetFields;

  const force = body.force === true || String(body.force).trim().toLowerCase() === 'true';

  return { ok: true, value: { config: targetFields.value, force } };
}
