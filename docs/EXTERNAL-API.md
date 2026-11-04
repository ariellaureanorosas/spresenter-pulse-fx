# Ações externas (API do plugin)

O Pulse FX responde a chamadas de fora em:

```
POST http://127.0.0.1:<porta>/api/v1/plugins/com.spresenter.pulse-fx/requests/<ação>
```

Serve para o **Bitfocus Companion** (botão que acende enquanto é segurado), para
scripts e para outros plugins. O plugin **não abre porta e não faz conexões**:
quem chama é o cliente, e o Spresenter entrega a chamada já autenticada.

O contrato é uma máquina falando com outra máquina. Valores inválidos viram
erro explícito (400) em vez de cair em silêncio em um padrão.

## Pré-requisitos

1. **API externa ligada** em Configurações do Spresenter.
2. Um **token** com o escopo `plugins:invoke`. O mesmo token pode ter outros
   escopos, mas esse é o único exigido para chamar o plugin.
3. A **porta** da API, mostrada pelo app junto da configuração da API externa.
   Na instalação de referência é `5050`; a `8080` é o painel web e responde HTML,
   não a API.

```bash
curl -H "Authorization: Bearer <token>" \
  http://127.0.0.1:5050/api/v1/plugins/com.spresenter.pulse-fx/requests/state
```

## Envelope da resposta

A API do Spresenter embrulha o retorno do plugin. O que este documento descreve
é o conteúdo de `data`:

```json
{
  "pluginId": "com.spresenter.pulse-fx",
  "action": "state",
  "data": { "ok": true, "version": "1.4.2", "effects": [] }
}
```

Erros não usam o envelope: vêm com o status HTTP (`400`, `404`, `409`, `401`) e
uma mensagem em português.

## Ações

### `start` — ligar o efeito contínuo

Liga Strobe ou Pulse em uma camada até um `stop`. Reaplicar no mesmo alvo
atualiza os parâmetros e mantém **um** efeito.

| Campo | Tipo | Padrão | Observação |
|---|---|---|---|
| `mode` | string | `strobe` | `strobe`, `pulse` ou `hit` (disparo único). |
| `frequency` | number | `2` | 0,5 a 20; a trava limita a 3 Hz. |
| `color` | string | `#ffffff` | Hex ou `rgb(…)`; formato inválido cai no branco. |
| `intensity` | number | `85` | 0 a 100. |
| `flashWidth` | number | `50` | 5 a 95 (strobe). |
| `target` | string | `full` | `full`, `vignette` ou `frame`. |
| `thickness` | number | `35` | 0 a 100 (vinheta/moldura). |
| `softness` | number | `50` | 0 a 100 (vinheta/moldura). |
| `output` | string | seleção salva | Índice da saída. |
| `layer` | number | seleção salva | 0 a 99. |
| `ignoreSafetyLock` | boolean | `false` | `true` aplica a frequência pedida mesmo com a trava ligada. |

Resposta:

```json
{
  "ok": true,
  "effect": {
    "output": "1",
    "layer": 3,
    "mode": "strobe",
    "frequencyHz": 3,
    "requestedHz": 8,
    "clamped": true,
    "ignoreSafetyLock": false
  }
}
```

`frequencyHz` é o valor **realmente aplicado**; `requestedHz` é o pedido antes
da trava; `clamped` diz se a trava (ou o teto técnico) reduziu o pedido. Para
ligar ou desligar a trava, use `safetyLock`.

`ignoreSafetyLock` vale **só para este disparo** e não altera a configuração
global. O teto técnico de 20 Hz continua valendo: nenhum pedido passa disso. Use
com consciência — a trava de 3 Hz existe para reduzir risco de fotossensibilidade.

### `safetyLock` — trava de 3 Hz

| Campo | Tipo | Padrão | Observação |
|---|---|---|---|
| `enabled` | boolean | obrigatório | `true` liga a trava; `false` libera até 20 Hz. |

```json
{ "ok": true, "safetyLock": false }
```

O pedido é sempre explícito — o plugin não alterna sozinho, para que dois
clientes clicando ao mesmo tempo não dependam da ordem de leitura do estado.
A mudança vale para o painel, a automação e a API, e fica salva nas
configurações.

Desligar a trava **acelera na hora** os efeitos iniciados pela API e pela
automação que estavam reduzidos: eles passam para a frequência pedida, sem
precisar de um novo `start`. Efeitos do painel ficam como estão, porque o valor
original já foi reduzido quando entrou. Ligar a trava reduz imediatamente o que
estiver acima de 3 Hz e **descarta o `ignoreSafetyLock`** dos efeitos em
execução: segurança vence.

### `stop` — desligar o efeito contínuo

| Campo | Tipo | Padrão | Observação |
|---|---|---|---|
| `output` | string | seleção salva | Índice da saída. |
| `layer` | number | seleção salva | 0 a 99. |
| `force` | boolean | `false` | `true` encerra qualquer dono na camada. |

Sem `force`, o pedido só encerra o que foi iniciado **por esta API**. É
intencional: soltar o botão do Companion não pode derrubar um efeito que o
operador ligou no painel.

```json
{ "ok": true, "stopped": true, "owner": "external" }
```

Sem efeito na camada, a resposta é `{ "ok": true, "stopped": false }` — chamar
`stop` duas vezes não é erro.

### `state` — estado atual

Devolve o que um cliente precisa para se situar: efeitos ativos, trava de
segurança, seleção salva e a lista de saídas e camadas (para montar menus em vez
de exigir números digitados).

Cada efeito traz a frequência aplicada (`frequencyHz`), a pedida antes da trava
(`requestedHz`) e se foi disparado com `ignoreSafetyLock`. É com isso que um
cliente sabe se o efeito vai acelerar quando a trava for desligada.

```json
{
  "ok": true,
  "version": "1.4.2",
  "safetyLock": true,
  "selection": { "output": "0", "layer": 5 },
  "effects": [
    {
      "output": "1",
      "layer": 3,
      "mode": "strobe",
      "owner": "external",
      "startedAt": 1793756300170,
      "frequencyHz": 3,
      "requestedHz": 8,
      "ignoreSafetyLock": false
    }
  ],
  "outputs": [{ "index": 0, "name": "Principal", "disabledLayers": [] }],
  "layers": [{ "index": 5, "name": "Sobreposição" }]
}
```

## Bitfocus Companion

O caminho recomendado é o módulo **Spresenter Pulse FX**
(`companion-module-spresenter-pulse-fx`), com botões momentâneos, alternância,
feedback de efeito ativo e botão da trava de 3 Hz.

Sem o módulo, use o **HTTP genérico**, com dois gatilhos no mesmo botão:

| Gatilho | Método | URL | Corpo |
|---|---|---|---|
| Button down | POST | `…/requests/start` | `{"mode":"strobe","frequency":8,"color":"#22d3ee","output":"1","layer":3}` |
| Button up | POST | `…/requests/stop` | `{"output":"1","layer":3}` |

Cabeçalhos das duas chamadas:

```
Authorization: Bearer <token>
Content-Type: application/json
```

Segurar liga, soltar desliga. O comportamento *momentary* é do Companion; o
plugin só sabe ligar e desligar.

## Comportamento

- **Concorrência:** as chamadas entram na mesma fila serial do painel e da
  automação. Duas chamadas ao mesmo tempo não se atropelam.
- **Dono do efeito:** o painel mostra a etiqueta **Companion** e descreve o
  efeito como iniciado pelo Companion. **Parar tudo** encerra qualquer dono.
- **Overlay:** se a camada ainda não tem o palco do Pulse FX, ele é aplicado
  automaticamente. Camada com conteúdo de terceiros é substituída, com aviso no
  painel; o conteúdo anterior não é restaurado.
- **Trava:** vale para a API como vale para o painel e a automação. O campo
  `ignoreSafetyLock` permite furar a trava em um disparo específico, sem mudar a
  configuração global; o teto de 20 Hz continua valendo.
- **`GET`:** um `GET` na mesma rota recebe a query string como payload, para
  clientes que só emitem URL. O plugin também aceita corpo JSON em texto.

## Erros

| Status | Quando |
|---|---|
| `400` | campo inválido (`mode`, `target`, `output`, `layer`, número não numérico) ou alvo indisponível |
| `404` | ação desconhecida |
| `409` | o alvo existe, mas o overlay/efeito não pôde ser aplicado |
| `401` / `403` | token ausente, sem `plugins:invoke`, ou API externa desligada |

A mensagem de erro é em português e diz qual campo corrigir.

## Limitação conhecida

O plugin não acompanha a conexão do cliente. Se o Companion for encerrado com o
botão pressionado, o `stop` nunca chega e o efeito **permanece** no palco até
alguém usar **Parar** ou **Parar tudo** no painel do Pulse FX. Isso é
consequência de deixar o ciclo de "segurar" inteiramente com o Companion.

Se isso incomodar em operação real, o próprio Companion pode mandar um `stop`
na inicialização, sem qualquer mudança no plugin.
