# Protocolo UI ↔ lógica

A UI (`src/ui/`) e a lógica (`src/logic/`) conversam apenas por `postMessage`
tipado. A fonte executável é `src/shared/messages.ts`; este documento é o
catálogo legível. Em caso de divergência, o código vence.

## Regras gerais

- A lógica é a **fonte da verdade**. A UI envia intenções e desenha o último
  `state` recebido.
- Toda mensagem da UI passa por `parseUiCommand`; mensagens desconhecidas ou
  malformadas são ignoradas sem exceção.
- Toda mensagem da lógica passa por `isLogicEvent` na UI.
- `state.revision` é monotônico. A UI descarta um `state` com revisão menor que
  a atual, o que protege contra mensagens fora de ordem.
- `force` só existe onde a ação pode substituir conteúdo de terceiros.
- Nenhuma mensagem carrega função, HTML ou objeto do host: apenas dados
  serializáveis.

## UI → lógica (`UiCommand`)

| `type` | Campos | Efeito |
|---|---|---|
| `requestState` | — | Reenvia o `state` completo. Usado no boot, ao voltar o foco e após confirmações. |
| `setParams` | `params: Partial<FxParams>` | Normaliza, aplica clamp e agenda persistência/re-render. |
| `selectTarget` | `output: string`, `layer: number`, `force?: boolean` | Seleciona destino. Se houver overlay ativo, move o stage; camada ocupada exige `force`. |
| `fire` | `force?: boolean` | Dispara um Hit. Sem overlay, aplica automaticamente; camada ocupada exige `force`. |
| `startContinuous` | `force?: boolean` | Inicia Strobe/Pulse. Mesmas regras de `fire`. |
| `stop` | — | Para o efeito do alvo selecionado. |
| `stopAll` | — | Para todos os efeitos, inclusive os iniciados pela automação. |
| `applyOverlay` | `force?: boolean` | Monta o stage transparente na seleção atual. |
| `removeOverlay` | — | Remove o stage **somente** se a camada contém o stage do Pulse FX. |
| `restoreDefaults` | — | Restaura parâmetros e religa a trava; preserva seleção e overlay. |
| `refreshOutputs` | — | Relê `outputs.list()` e `layers.list()`. |

## Lógica → UI (`LogicEvent`)

| `type` | Conteúdo | Quando |
|---|---|---|
| `state` | `state: UiState` | Após qualquer mutação relevante e em resposta a `requestState`. |
| `outputsLayers` | `outputs`, `layers` | Quando o ambiente muda e a UI precisa atualizar apenas as listas. |
| `clamped` | `clamp: ClampInfo` | Quando a **automação** pede uma frequência que é ajustada (com deduplicação para não inundar a UI). |
| `toast` | `level`, `message` | Avisos de produto (auto-apply, falha de storage etc.). |
| `error` | `message` | Erro inesperado em comando ou integração com o host. |
| `confirmationRequired` | `request: ConfirmationRequest` | Ação bloqueada por camada ocupada ou estado não verificado. |

### `UiState`

| Campo | Significado |
|---|---|
| `revision` | Contador monotônico para descarte de estados antigos. |
| `params` | Parâmetros já normalizados e com clamp aplicado. |
| `selection` | `output` + `layer` selecionados. |
| `applied` | O stage do Pulse FX está aplicado na seleção. |
| `layerOccupied` | `true`/`false`/`null` (não verificado) para a camada. |
| `layerOccupiedByUs` | A ocupação é o nosso stage (e não conteúdo de terceiros). |
| `layerDisabled` | A camada está desativada naquela saída. |
| `effects` | Efeitos ativos em qualquer alvo. |
| `selectedEffect` | Efeito ativo no alvo selecionado, se houver. |
| `appliedTargets` | Overlays aplicados em outras saídas/camadas. |
| `lastClamp` | Último clamp, para o cartão de segurança continuar visível. |
| `ready` | Boot concluído e ambiente carregado. |
| `outputs` / `layers` | Listas do host, já sanitizadas. |

### `ConfirmationRequest`

| Campo | Significado |
|---|---|
| `action` | `apply`, `move` ou `run`. |
| `message` | Texto apresentado no modal. |
| `output` / `layer` | Alvo que originou a confirmação. |

A UI responde reenviando o comando original com `force: true`. Antes de
confirmar, ela confere se a seleção ainda é a mesma; se mudou, pede revisão em
vez de aplicar no alvo errado.

## Handshake

O host inicia a lógica e o painel em momentos diferentes; mensagens de UI
enviadas antes de `spresenter.ui.onmessage` existir são descartadas. A UI repete
`requestState` com os atrasos `300, 800, 1600, 3000, 5000, 8000, 12000` ms e
depois a cada 12 s, até receber o primeiro `state`. O comportamento é isolado em
`src/ui/handshake.ts` e testado em `tests/ui/handshake.test.ts`.

## Compatibilidade

- Adicionar um comando ou evento exige atualizar:
  1. `src/shared/messages.ts` (tipo + parser);
  2. `src/logic/` (handler ou emissão);
  3. este documento;
  4. `tests/shared/messages.test.ts`.
- Remover ou renomear um campo é **breaking** para a UI e para plugins que
  reutilizem o protocolo; exige nota no CHANGELOG.
- Campos novos devem ser opcionais na leitura e obrigatórios na escrita.
