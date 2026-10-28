# Pulse FX — arquitetura e decisões

Documento para quem mantém o plugin. Explica o modelo de execução, os
invariantes que não podem ser quebrados e o porquê das decisões que não são
óbvias a partir do código.

- Instalação e uso: [README](../README.md)
- Catálogo do protocolo UI ↔ lógica: [PROTOCOL.md](PROTOCOL.md)
- Compatibilidade e limitações: [COMPATIBILITY.md](COMPATIBILITY.md)
- Processo de release: [RELEASING.md](RELEASING.md)

## Contexto e restrições

O Pulse FX projeta efeitos de luz (flash, strobe e respiração) por cima da saída
do Spresenter. A arquitetura é imposta pelo host, não escolhida livremente:

- Duas threads: a lógica roda isolada, sem DOM, e a UI roda em um `<iframe>`
  com sandbox. Só a lógica fala com o app.
- A UI nunca chama o host. Ela envia intenções e desenha o estado autoritativo
  devolvido pela lógica.
- O plugin declara o menor privilégio possível (`outputs:read`, `live:read`,
  `live:write`) e não faz requisições de rede próprias.
- `background: true` mantém a lógica viva para a automação funcionar com o
  painel fechado.
- A interface é em português do Brasil; identificadores, arquivos e mensagens de
  commit ficam em inglês.

## Modelo de execução

```
UI (iframe sandbox)  ⇄ postMessage ⇄  lógica (processo isolado)  ⇄  spresenter.*
 React/Tailwind                        fonte da verdade                app
```

- `src/shared/` concentra tipos, constantes, validação, storage e o gerador de
  HTML. Nada nesse diretório toca em `spresenter`, `window` ou `document`.
- `src/code.ts` é a única fonte da verdade do estado. A UI envia intenções e
  desenha o último `state` recebido; ela nunca chama o app.
- Toda mutação (UI, automação, timers e eventos) passa por uma fila serial
  (`createSerialQueue`) para evitar corrida entre painel e nós de automação.
- O overlay é o padrão "stage" de `live-elements.md`: uma apresentação com um
  único `RECTANGLE` (`pulsefx-stage`) é aplicada uma vez por `saída:camada`;
  depois só HTML autocontido com CSS `@keyframes` é empurrado via `setElement`.
  A animação roda no navegador da saída — nenhum frame trafega por IPC.
- Um único renderizador paramétrico, `buildOverlayHtml(params)`, cobre Hit,
  Strobe e Pulse e os três alvos. A prévia reaproveita a mesma geometria e os
  mesmos `@keyframes` por meio de `buildPreviewStyle(params)`, sem `<iframe>`:
  as unidades de moldura viram `cqmin` para medir o palco do painel em vez da
  janela.

## Invariantes

1. **Fonte da verdade única.** Nenhum estado de efeito vive na UI. A UI pode ter
   estado local otimista para sliders, mas o valor aplicado é sempre o que volta
   no evento `state`.
2. **Fila serial.** UI, automação, timers e eventos não mutam o palco em
   paralelo. Qualquer novo caminho de mutação deve entrar na mesma fila.
3. **Um único clamp de frequência.** Toda frequência passa por
   `clampFrequency(hz, safetyLockOn)`. O gerador de HTML reaplica o clamp como
   defesa em profundidade; não crie caminhos paralelos.
4. **Overlay conservador.** `live.clear` só é chamado quando a camada contém o
   stage do Pulse FX. Conteúdo de terceiros nunca é apagado pelo plugin.
5. **Sem IPC por frame.** A animação é CSS; os eventos só trocam o HTML do
   elemento quando os parâmetros mudam.
6. **Menor privilégio.** Não adicionar escopos ao manifesto sem uso real.
7. **`src/shared/` puro.** Sem `window`, `document` ou `spresenter`; é o que
   mantém a lógica testável em Node.
8. **Hit é evento, não estado.** Mudar parâmetros não reinicia um hit em curso:
   a queda termina com os valores do disparo e os novos valem do próximo em
   diante. Strobe e Pulse, que são contínuos, acompanham os sliders ao vivo.

## Protocolo UI ↔ lógica

O protocolo é tipado em `src/shared/messages.ts` com discriminated unions
importadas pelos dois lados. O catálogo completo está em
[PROTOCOL.md](PROTOCOL.md). Em resumo:

- UI → lógica: `requestState`, `setParams`, `selectTarget`, `fire`,
  `startContinuous`, `stop`, `stopAll`, `applyOverlay`, `removeOverlay`,
  `restoreDefaults`, `refreshOutputs`.
- Lógica → UI: `state`, `outputsLayers`, `clamped`, `error`, `toast`,
  `confirmationRequired`.
- `fire`, `startContinuous`, `applyOverlay` e `selectTarget` aceitam `force`
  para confirmar a substituição de camada ocupada.
- O `state` inclui seleção, parâmetros já normalizados, overlay aplicado,
  ocupação da camada, efeitos ativos em qualquer alvo e o último clamp.
- `clamped` nunca é silencioso. Para o painel, o ajuste volta no próprio `state`
  (`lastClamp`), pois a UI sabe o que pediu; para a automação, um evento
  `clamped` é emitido (deduplicado) e o mesmo dado fica em `state.lastClamp`.

### Handshake

O host descarta mensagens de UI recebidas antes de `spresenter.ui.onmessage`
existir. Por isso a UI repete o primeiro `requestState` (300 ms a 12 s, depois a
cada 12 s) até a primeira resposta. O comportamento está isolado e testado em
`src/ui/handshake.ts`.

## Parâmetros, faixas e padrões

| Campo | Padrão | Faixa | Passo | Visível |
|---|---:|---|---:|---|
| `color` | `#ffffff` | hex/rgb válido | — | sempre |
| `target` | `full` | full / vignette / frame | — | sempre |
| `intensity` | 85 | 0–100 | 1 | sempre |
| `decayMs` | 320 | 30-10000 | 10 | Hit |
| `frequencyHz` | 2.0 | 0.5–3 (trava) / 0.5–20 | 0.1 | Strobe/Pulse |
| `flashWidth` | 50 | 5–95 | 1 | Strobe |
| `thickness` | 35 | 0–100 | 1 | Vinheta/Moldura |
| `softness` | 50 | 0–100 | 1 | Vinheta/Moldura |
| `safetyLock` | `true` | boolean | — | sempre |

`normalizeParamsWithMeta` é o único caminho de validação. Toda frequência passa
por `clampFrequency(hz, safetyLockOn)`, que devolve
`{ hz, requestedHz, limitHz, clamped, cause }`; o valor aplicado é sempre `.hz`.

## Renderização

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

## Semântica de produto

- **Aplicar na saída** monta o stage transparente. Depois o botão vira
  **Remover da saída**. Remover usa `live.clear` somente se a camada contém o
  nosso stage; nunca limpa conteúdo alheio.
- **Disparar/Iniciar sem overlay** aplica automaticamente e avisa por toast. Se
  a camada já tem conteúdo de terceiros, pede confirmação antes (mesmo no
  auto-apply). Nó de automação aplica e prossegue, pois o operador configurou o
  nó; ainda assim registra um toast de aviso.
- **Trocar saída/camada com overlay ativo** move o stage: aplica no novo alvo,
  depois limpa o antigo. Se o novo alvo estiver ocupado, não move até confirmar.
- `live.apply` **substitui** o conteúdo da camada (confirmado no app instalado e
  na documentação). A UI mostra aviso permanente quando a camada está ocupada e
  um modal antes de aplicar; o conteúdo anterior não é restaurado no remove.
- **PARAR TUDO** para todos os efeitos, inclusive de automação, zera o HTML de
  todos os stages e mantém o overlay aplicado. Botão fixo no topo do painel.
- **Restaurar padrões** restaura parâmetros e religa a trava, sem tirar o
  overlay; a UI oferece "Desfazer" no toast.
- **Trava de segurança**: ligada por padrão; persistida como o usuário deixou;
  ao religar com frequência alta, o clamp é imediato, inclusive no efeito em
  execução. Desligada, teto técnico de 20 Hz e aviso persistente.

## Automação

Três nós ficam disponíveis em **Automação → Pulse FX** e continuam funcionando
com o painel fechado (`background: true`):

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
expõe mas a tabela da documentação de automação não lista.

## Persistência

- Chave `pulsefx.settings`, com `schemaVersion: 1`:
  `{ schemaVersion, params, output, layer, hasSelection }`.
- Migração da chave antiga `com.spresenter.pulse-fx.settings.v1` (formato sem
  schema, com `fall`/`duty`/`fullscreen`) para não perder o estado de quem já
  usava uma versão anterior.
- Dados corrompidos, schema futuro ou campos inválidos caem nos padrões; a UI
  recebe um toast. Escrita com debounce de ~250 ms.
- Primeiro uso: trava ligada e camada mais alta disponível.

## Decisões e ambiguidades resolvidas

1. **Escopo de storage**: a documentação oficial diz que `storage.*` não exige
   escopo. Vale a documentação: nada de escopo inventado.
2. **Ordem das camadas**: `layers.list()` não documenta a ordem. No app
   instalado, a configuração lista 0=Fundo … 5=Imagem e Vídeo, ou seja, índice
   maior = mais acima. "Mais alta" = maior índice não desativado.
3. **`live.apply`**: substitui o conteúdo da camada. Avisamos e confirmamos.
4. **Pulse**: a documentação sugere `alternate` com duração do ciclo; isso
   produz metade da frequência. Implementamos keyframes 0/50/100 para que 1 Hz =
   uma respiração completa por segundo, mantendo a curva suave.
5. **Alterações ao vivo com overlay aplicado e ocioso**: não re-renderizamos um
   Hit/Strobe/Pulse parado (isso iniciaria o efeito sem o operador mandar). Com
   efeito rodando, toda mudança re-renderiza em ~45 ms, reiniciando limpo.
6. **Cleanup ao desativar**: a API documentada não expõe callback de unload no
   processo de lógica. Paramos timers e listeners internamente e o painel tem
   PARAR TUDO; a limpeza do stage ao desinstalar/desativar depende do host.
   Documentado como limitação no README.
7. **SDK**: o SDK vendorizado é 0.5.0; o app de referência é 0.3.50. Usamos
   somente APIs presentes na documentação atual e declaramos
   `minAppVersion: 0.3.50` — a mesma combinação usada pelos templates oficiais e
   por outros plugins instalados no app de referência.
8. **Aviso de camada ocupada em automação**: não há operador para confirmar um
   nó; a automação aplica e prossegue, mas um toast avisa quando há UI aberta. O
   conteúdo anterior não é restaurado.
9. **Versão do plugin**: `manifest.json` é a fonte única. `package.json` e
   `package-lock.json` são sincronizados por script; a UI recebe a versão no
   build via `__PLUGIN_VERSION__`.

## Mapa de módulos

```
src/code.ts              motor: estado, fila serial, overlay, efeitos, persistência,
                         automação e ponte da UI (mantido único nesta versão)
src/logic/logger.ts      log prefixado, sem quebrar o fluxo em caso de falha
src/shared/              tipos, params, overlay, storage, messages, queue, selection
src/ui/                  painel React (App, components, styles, bridge, handshake)
src/ui/version.ts        versão injetada no build a partir de manifest.json
scripts/                 validação de manifesto/SDK, versão única e empacotamento
tests/                   unitários compartilhados, caracterização da lógica e UI
```

O motor permanece em um arquivo único de propósito nesta versão: a lógica é
serializada por uma fila e depende de estado de módulo (mapas de overlays,
runtimes de efeito, cache de probe). A extração em módulos menores continua
possível, mas exige mover esse estado para um objeto explícito de contexto e
não deve ser feita sem uma suíte de caracterização — que é justamente a que
existe hoje em `tests/logic/` (host falso em `tests/helpers/fakeHost.ts`).

`src/shared/` permanece puro (sem `spresenter` e sem DOM) e é reaproveitado tanto
pela lógica quanto pelo painel; por isso tem a meta de cobertura mais alta.

## Qualidade e testes

- `tests/shared/` cobre funções puras (parâmetros, overlay, storage, fila,
  seleção, mensagens, handshake).
- `tests/logic/` carrega o motor real (`src/code.ts`) contra um host falso
  (`tests/helpers/fakeHost.ts`), com timers falsos. É a caracterização do
  comportamento que a UI consome: boot/migração, overlay, parâmetros, seleção e
  automação.
- `tests/ui/` roda em jsdom com Testing Library e cobre a ponte, o
  `ErrorBoundary` e o painel.
- `vitest.config.ts` define limites de cobertura (globais e mais altos para
  `src/shared/`). O CI roda a suíte em Node 22 e 24.
- `scripts/` valida o manifesto, o SHA-256 e a identidade do SDK vendorizado,
  a sincronia de versão e o conteúdo do ZIP. Nada disso depende de ferramenta
  externa além do Node.
- `tests/setup.ts` silencia logs esperados de caminhos de erro; um teste que
  precise observar log deve instalar o próprio espião.

## Como validar uma mudança

1. `npm run verify` — formatação, lint, tipos, testes com cobertura, build,
   validação de manifesto/SDK e empacotamento.
2. Para mudanças visuais: comparar a prévia do painel com a saída real em
   **Spresenter 0.3.50**; se a checagem for manual, registre conforme
   [docs/verification/README.md](verification/README.md).
3. Para mudanças de protocolo: atualizar [PROTOCOL.md](PROTOCOL.md) e os testes
   de `messages`.
4. Para mudanças de comportamento do host: atualizar [COMPATIBILITY.md](COMPATIBILITY.md).

## Não-objetivos

- Adicionar permissões ou depender de APIs internas/não documentadas do host.
- Novos modos, alvos ou efeitos sem decisão de produto.
- Telemetria, analytics ou chamadas de rede próprias.
- Framework de i18n: a UI é pt-BR por decisão de produto.
- Publicação no npm: `"private": true` no `package.json` impede a publicação do
  pacote. O plugin é distribuído como ZIP na release; o repositório é público,
  mas o npm não é canal de distribuição.
