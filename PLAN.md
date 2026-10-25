# Pulse FX — plano de implementação

## 1. Arquitetura

Duas threads, como manda a documentação:

```
UI (iframe sandbox)  ⇄ postMessage ⇄  code.ts (processo isolado)  ⇄  spresenter.*
     React/Tailwind                     fonte da verdade                 app
```

- `src/shared/` concentra tipos, constantes, validação, storage e o gerador de HTML.
  Nada nesse diretório toca em `spresenter`, `window` ou `document`.
- `src/code.ts` é a **única** fonte da verdade do estado. A UI envia intenções e
  desenha o último `state` recebido; ela nunca chama o app.
- Toda mutação (UI, automação, timers, eventos) passa por uma fila serial
  (`createSerialQueue`) para evitar corrida entre painel e nós de automação.
- O overlay é o padrão "stage" de `live-elements.md`: uma apresentação com um
  único `RECTANGLE` (`pulsefx-stage`) é aplicada uma vez por `saída:camada`;
  depois só HTML autocontido com CSS `@keyframes` é empurrado via `setElement`.
  A animação roda no navegador da saída — nenhum frame trafega por IPC.
- Um único renderizador paramétrico, `buildOverlayHtml(params)`, cobre Hit,
  Strobe e Pulse e os três alvos. A prévia usa exatamente a mesma função.

## 2. Escopos do manifest (menor privilégio)

```json
"permissions": ["outputs:read", "live:read", "live:write"]
```

- `outputs:read` — `outputs.list()` / `layers.list()`.
- `live:read` — ler a camada antes de aplicar (aviso de conteúdo), detectar o
  stage já aplicado (inclusive após reinício) e reidratar o painel.
- `live:write` — `live.apply`, `live.setState`, `live.setElement`, `live.clear`.
- `storage.*` **não tem escopo**; é isolado por plugin (doc de permissões).
- Nós de automação e `background` **não têm escopo**; exigem `background: true`.
- Não pedimos `live:read` "de brinde": ele é usado de fato para não destruir
  conteúdo sem aviso. `storage` e automação não entram em `permissions`.

Manifest: id `com.spresenter.pulse-fx`, painel `main`, `background: true`,
`minAppVersion: 0.3.0`, `sdk: 0.5.0` (SDK vendorizado no projeto).

## 3. Protocolo UI ↔ lógica (`src/shared/messages.ts`)

Discriminated unions, importadas pelos dois lados.

UI → lógica:
`requestState`, `setParams`, `selectTarget`, `fire`, `startContinuous`, `stop`,
`stopAll`, `applyOverlay`, `removeOverlay`, `restoreDefaults`, `refreshOutputs`.
`fire`, `startContinuous`, `applyOverlay` e `selectTarget` aceitam `force` para
confirmar a substituição de camada ocupada.

Lógica → UI:
`state` (estado completo, autoritativo), `outputsLayers`, `clamped`, `error`,
`toast`, `confirmationRequired`.

- A UI reidrata com `requestState` ao montar, ao ficar visível e ao voltar o foco.
  Como o host descarta mensagens recebidas antes de `spresenter.ui.onmessage`
  existir, o primeiro pedido é repetido (300 ms a 12 s, depois a cada 12 s) até
  a primeira resposta; `src/ui/handshake.ts` isola e testa esse comportamento.
- `state` inclui seleção, parâmetros já normalizados, overlay aplicado, ocupação
  da camada, efeitos ativos em qualquer alvo e o último clamp.
- `clamped` nunca é silencioso; o mesmo dado fica em `state.lastClamp` para
  continuar visível no cartão de segurança.

## 4. Estrutura de arquivos

```
manifest.json
package.json
scripts/package.mjs
sdk/spresenter-plugin-sdk.tgz
src/code.ts                    lógica, stage, fila, storage, automação
src/shared/types.ts            tipos de domínio e DTOs
src/shared/params.ts           defaults, faixas, normalize, clampFrequency, cor
src/shared/overlay.ts          buildOverlayHtml (puro)
src/shared/storage.ts          schemaVersion, migração, validação
src/shared/messages.ts         protocolo tipado + parser
src/shared/queue.ts            fila serial testável
src/ui/App.tsx                 painel React
src/ui/components/...          controles, modal, toasts, ícones
src/ui/index.css               tema escuro + Tailwind
src/ui/index.html              lang=pt-BR
tests/                         Vitest
PLAN.md / README.md
```

## 5. Parâmetros, faixas e padrões

| Campo | Padrão | Faixa | Passo | Visível |
|---|---:|---|---:|---|
| `color` | `#ffffff` | hex/rgb válido | — | sempre |
| `target` | `full` | full / vignette / frame | — | sempre |
| `intensity` | 85 | 0–100 | 1 | sempre |
| `decayMs` | 320 | 30–2000 | 10 | Hit |
| `frequencyHz` | 2.0 | 0.5–3 (trava) / 0.5–20 | 0.1 | Strobe/Pulse |
| `flashWidth` | 50 | 5–95 | 1 | Strobe |
| `thickness` | 35 | 0–100 | 1 | Vinheta/Moldura |
| `softness` | 50 | 0–100 | 1 | Vinheta/Moldura |
| `safetyLock` | `true` | boolean | — | sempre |

`normalizeParamsWithMeta` é o único caminho de validação. Toda frequência passa
por `clampFrequency(hz, safetyLockOn)`, que devolve
`{ hz, requestedHz, limitHz, clamped, cause }`; o valor aplicado é sempre `.hz`.
O builder de HTML também reaplica o clamp como defesa em profundidade.

## 6. Renderização

- **Hit**: keyframes `0% → 100%`, duração `decayMs`, `cubic-bezier(.1,.7,.3,1)`,
  `forwards`, uma iteração. `renderId` novo a cada disparo ⇒ nome de keyframe
  novo ⇒ re-disparo em rajada sempre recomeça do zero.
- **Strobe**: período `1000 / frequencyHz`; `steps(1, end)` para transição dura;
  keyframes `0%` aceso, `flashWidth%` apagado, `100%` apagado. Duty cycle exato.
- **Pulse**: período `1000 / frequencyHz`; keyframes `0% → 50% pico → 100% 0`
  com `ease-in-out`. O ciclo completo (0→pico→0) é 1/freq; usar `alternate` com
  duração 1/freq faria a respiração ter metade da frequência pedida.
- A chapa anima só `opacity`; `pointer-events: none`, `inset: 0`,
  `will-change: opacity`. Unidades `vmin`/`%` — nada de px fixo.
- Tela cheia: fundo sólido. Vinheta: `radial-gradient` com raio interno e
  transição derivados de espessura/suavidade. Moldura: `box-shadow` inset com
  spread = espessura e blur = suavidade.

## 7. Semântica de produto

- **Aplicar na saída** monta o stage transparente. Depois o botão vira
  **Remover da saída**. Remover usa `live.clear` somente se a camada contém o
  nosso stage; nunca limpa conteúdo alheio.
- **Disparar/Iniciar sem overlay** aplica automaticamente e avisa por toast.
  Se a camada já tem conteúdo de terceiros, pede confirmação antes (mesmo no
  auto-apply). Nó de automação aplica e prossegue, pois o operador configurou o
  nó; ainda assim registra um toast de aviso.
- **Trocar saída/camada com overlay ativo** move o stage: aplica no novo alvo,
  depois limpa o antigo. Se o novo alvo estiver ocupado, não move até confirmar.
- `live.apply` **substitui** o conteúdo da camada (confirmado no app instalado e
  na doc). A UI mostra aviso permanente quando a camada está ocupada e um modal
  antes de aplicar; o conteúdo anterior não é restaurado no remove.
- **PARAR TUDO** para todos os efeitos, inclusive de automação, zera o HTML de
  todos os stages e mantém o overlay aplicado. Botão fixo no topo do painel.
- **Restaurar padrões** restaura parâmetros e religa a trava, sem tirar o
  overlay; a UI oferece "Desfazer" no toast.
- **Trava de segurança**: ligada por padrão; persistida como o usuário deixou;
  ao religar com frequência alta, o clamp é imediato, inclusive no efeito em
  execução. Desligada, teto técnico de 20 Hz e aviso persistente.

## 8. Automação (3 nós, `background: true`)

1. **Disparar hit** — cor, intensidade, queda, alvo, espessura/suavidade e
   saída/camada opcionais.
2. **Strobe / pulse** — ação ligar/desligar, modo, saída/camada e parâmetros
   opcionais. Frequência passa pela mesma trava.
3. **Aplicar / remover overlay** — ação, saída e camada.

Todos executam na mesma fila e no mesmo motor da UI. Campos de parâmetro não
informados usam os padrões do plugin; `output` vazio e `layer: -1` usam a
seleção salva do painel. A trava de segurança é global e vale também para os
nós. Campos de config usam apenas `string`/`number`/`boolean` (documentado), com
`hint` listando os valores aceitos — sem depender do tipo `select`, que o SDK
expõe mas a tabela da doc de automação não lista.

## 9. Persistência

- Chave nova `pulsefx.settings`, com `schemaVersion: 1`:
  `{ schemaVersion, params, output, layer, hasSelection }`.
- Migração da chave antiga `com.spresenter.pulse-fx.settings.v1` (formato sem
  schema, com `fall`/`duty`/`fullscreen`) para não perder o estado de quem já
  usava uma versão anterior.
- Dados corrompidos, schema futuro ou campos inválidos caem nos padrões; a UI
  recebe um toast. Escrita com debounce de ~250 ms.
- Primeiro uso: trava ligada e camada mais alta disponível.

## 10. Ambiguidades e decisões

1. **Escopo de storage**: o prompt sugere um escopo; a doc oficial diz que
   `storage.*` não exige escopo. Vale a doc: nada de escopo inventado.
2. **Ordem das camadas**: `layers.list()` não documenta a ordem. No app
   instalado, a configuração lista 0=Fundo … 5=Imagem e Vídeo, ou seja, índice
   maior = mais acima. "Mais alta" = maior índice não desativado.
3. **`live.apply`**: substitui o conteúdo da camada. Avisamos e confirmamos.
4. **Pulse**: a doc sugere `alternate` com duração do ciclo; isso produz metade
   da frequência. Implementamos keyframes 0/50/100 para que 1 Hz = uma
   respiração completa por segundo, mantendo a curva suave.
5. **Alterações ao vivo com overlay aplicado e ocioso**: não re-renderizamos um
   Hit/Strobe/Pulse parado (isso iniciaria o efeito sem o operador mandar). Com
   efeito rodando, toda mudança re-renderiza em ~45 ms, reiniciando limpo.
6. **Cleanup ao desativar**: a API documentada não expõe callback de unload no
   processo de lógica. Paramos timers e listeners internamente e o painel tem
   PARAR TUDO; a limpeza do stage ao desinstalar/desativar depende do host.
   Documentado como limitação no README/relatório.
7. **SDK**: o SDK vendorizado é 0.5.0; o app instalado é 0.3.50. Usamos somente
   APIs presentes na documentação atual e mantemos `minAppVersion` em 0.3.0.
8. **Aviso de camada ocupada em automação**: não há operador para confirmar um
   nó; a automação aplica e prossegue (como pedido), mas um toast avisa quando
   há UI aberta. O conteúdo anterior não é restaurado.

## 11. Testes

Vitest para funções puras:

- `clampFrequency` (trava ligada/desligada, mínimo, teto técnico, inválidos).
- normalização de parâmetros, cores, aliases de modo/alvo.
- `buildOverlayHtml` por modo × alvo (snapshot + asserções de duração, período,
  duty cycle, transição dura, keyframe único por disparo, unidades relativas).
- migração/validação de storage (schema novo, legado, corrompido, futuro).
- fila serial (ordem e continuidade após rejeição).
- handshake UI↔lógica (`src/ui/handshake.ts`): pedido imediato, repetição até
  conectar, parada na primeira resposta e repetição do último intervalo.

Aceite final: `npm run typecheck`, `npm test`, `npm run build`,
`npm run package`.

## 12. Verificação no app real (2026-10-25, Spresenter 0.3.50)

- Causa do boot preso: o host descarta mensagens de UI que chegam antes de
  `spresenter.ui.onmessage` existir. O painel enviava `requestState` uma única
  vez; agora repete até a primeira resposta (`src/ui/handshake.ts`).
- Log do app: `Pulse FX carregado` às 15:17:59 e `Painel conectado à lógica` às
  15:18:00, após reabrir o painel.
- Teste manual: **Disparar hit** em uma camada livre produziu o flash na saída.
- Ainda dependem do host/editor: Strobe/Pulse contínuos em todas as saídas,
  editor de automação, nós com o painel fechado e limpeza após
  desinstalação/desativação do plugin.
