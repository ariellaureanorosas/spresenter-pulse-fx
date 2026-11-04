# Changelog

Todas as mudanças notáveis deste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.4.3] - 2026-11-04

### Adicionado

- **`hit` na API externa**: modo de disparo único agora aceito em `start`. O efeito roda uma vez e para automaticamente após o `decayMs`. Útil para flashes pontuais sem segurar botão.

## [1.4.2] - 2026-11-04

### Adicionado

- **`ignoreSafetyLock` no `start`**: um disparo específico pode usar a frequência
  pedida mesmo com a trava de 3 Hz ligada, sem alterar a configuração global. O
  teto técnico de 20 Hz continua valendo. É o que permite um botão do Companion
  que ignora a trava enquanto outro obedece.
- **Frequência pedida preservada por efeito**: `state` agora expõe
  `requestedHz` (o pedido), `frequencyHz` (o aplicado) e `ignoreSafetyLock`.

### Alterado

- **Desligar a trava acelera os efeitos em execução.** Efeitos iniciados pela API
  e pela automação que estavam reduzidos passam na hora para a frequência pedida;
  não é mais necessário soltar e apertar o botão. Efeitos do painel continuam
  como estão.
- **Ligar a trava vale até para quem pediu para ignorar**: os efeitos em execução
  voltam a 3 Hz e o modo "ignorar" é descartado até o próximo `start`.
- Um pedido explícito de ligar a trava também é eficaz quando ela **já estava
  ligada** e havia um efeito disparado com `ignoreSafetyLock`.

## [1.4.1] - 2026-11-04

### Adicionado

- **`safetyLock`**: liga ou desliga a trava de 3 Hz pela API externa, com pedido
  explícito (`{ "enabled": false }`), sem alternância implícita. A mudança vale
  para o painel, a automação e a API, e fica salva. Isso permite um botão no
  Companion em vez de abrir o painel do plugin no meio da operação.

### Corrigido

- **Envelope da API documentado.** O Spresenter entrega o retorno do plugin
  dentro de `data`; a referência não dizia isso e clientes liam o topo do JSON.

## [1.4.0] - 2026-11-03

### Adicionado

- **Ações externas para o Bitfocus Companion.** `…/requests/start` liga e
  `…/requests/stop` desliga o efeito contínuo, o que permite um botão que acende
  enquanto é segurado — o comportamento *momentary* é do Companion. O plugin não
  abre porta: quem chama é o Companion, com um token de escopo `plugins:invoke`.
  O efeito iniciado de fora aparece no painel com a etiqueta **Companion**, entra
  na mesma fila serial e respeita a trava de 3 Hz. `stop` sem `force` só encerra o
  que veio de fora, para o "soltar" não derrubar um efeito do painel.
- **`state`** devolve efeitos ativos, trava de segurança, seleção e a lista de
  saídas e camadas, para clientes montarem menus em vez de exigir números.
- Referência completa em [docs/EXTERNAL-API.md](docs/EXTERNAL-API.md).

## [1.3.2] - 2026-10-28

### Corrigido

- **Rótulos numéricos quebravam em duas linhas.** No cartão Proteção, `20,0 Hz`
  saía como `20,0` / `Hz`: o rótulo da ponta direita da escala era posicionado
  com `left: 100%` e ficava com largura zero para quebrar. Ele passou a ser
  ancorado à direita, e os três rótulos da escala não quebram mais. Os extremos
  do rodapé dos sliders (mínimo e máximo) também ganharam `nowrap`, para o caso
  do painel estreito; a dica central continua podendo quebrar.

## [1.3.1] - 2026-10-28

### Corrigido

- **Hit disparava sozinho ao mexer nos parâmetros.** Com um hit em queda, o
  painel re-renderizava o efeito a cada mudança de slider, o que reiniciava a
  animação do zero — um novo flash a cada ajuste. Agora o hit é tratado como
  disparo único: a queda em curso termina com os valores do disparo e as
  alterações valem para o próximo. Strobe e Pulse continuam acompanhando os
  sliders ao vivo.

## [1.3.0] - 2026-10-26

### Adicionado

- A **queda** do modo Hit vai até **10 s** (era 2 s), útil para flashes que
  dissolvem devagar. O padrão continua 320 ms e o valor segue sempre em ms no
  painel. Strobe e Pulse não usam esse ajuste.

## [1.2.1] - 2026-10-26

Ajuste visual na prévia, sem mudança de comportamento.

### Alterado

- Removida a dica "Repetir" que aparecia sobre o palco ao passar o mouse: ela
  duplicava o botão **Repetir** do rodapé. O palco continua reiniciando a
  animação com um clique, e o botão que cobre a área mantém nome acessível e
  anel de foco para teclado.

## [1.2.0] - 2026-10-26

Correção do palco da prévia: ele aparecia branco e não reagia ao clique.

### Corrigido

- **Prévia em branco.** O palco era um `<iframe srcDoc>` com `sandbox=""`
  aninhado no iframe de origem opaca em que o host carrega a UI do plugin, e não
  pintava de forma confiável — sobrava um retângulo branco, no qual o flash
  branco padrão ficava invisível. A prévia agora desenha o efeito direto no DOM,
  com a mesma geometria e os mesmos `@keyframes` da saída.
- **Moldura fora de escala.** A geometria usa `vmin` no overlay; no painel isso
  media a janela, não o palco. A prévia troca por `cqmin` e mede o próprio palco.

### Adicionado

- Malha quadriculada de transparência no palco, em tom escuro, no lugar do decor
  escuro que ficava escondido atrás do iframe.
- **Clique em qualquer ponto da prévia** reinicia a animação, além do botão
  **Repetir**. A área é um botão de verdade: funciona com teclado e tem anel de
  foco.
- Com `prefers-reduced-motion`, a prévia mostra o efeito no pico, parado, em vez
  de sumir.

## [1.1.0] - 2026-10-25

Rodada de qualidade: o comportamento no palco não muda, mas o plugin passa a ser
verificável, empacotado de forma reproduzível e documentado.

### Adicionado

- 127 testes automatizados: caracterização do motor contra um host falso,
  utilitários puros, ponte do painel, `ErrorBoundary` e interface em jsdom, com
  limites mínimos de cobertura por escopo.
- Biome para lint e formatação, com gate no CI.
- `ErrorBoundary` no painel: uma falha de renderização mostra a mensagem e
  permite tentar novamente sem derrubar a thread de lógica.
- Validação de manifesto, integridade do SDK vendorizado e sincronia de versão
  no empacotamento.
- Workflow de release por tag com ZIP, SHA-256 e notas extraídas do CHANGELOG.

### Alterado

- `minAppVersion` passou de `0.3.0` para **`0.3.50`**, a versão do app usada como
  referência e a mesma combinação (`0.3.50` + SDK `0.5.0`) dos templates oficiais
  e de outros plugins instalados. Quem estiver em versão anterior do Spresenter
  deve permanecer no Pulse FX 1.0.0.
- O ZIP passou a ser reproduzível: mesmo commit e mesmo Node geram o mesmo
  SHA-256, então o checksum publicado pode ser conferido por quem reconstrói o
  pacote.
- Versão do plugin com fonte única (`manifest.json`), injetada no build da UI.
- Documentação reorganizada em `docs/`; o antigo `PLAN.md` virou
  `docs/ARCHITECTURE.md`.

### Segurança

- Actions do GitHub fixadas por SHA e auditoria das dependências de runtime no
  CI.
- Dependabot com agrupamento e período de espera para pacotes recém-publicados.
- CodeQL e revisão de dependências em pull request, quando GitHub Code Security
  está disponível.

### Documentação

- README revisado, com instalação pela página de releases e estrutura real do
  repositório.
- Documentação de arquitetura, protocolo, compatibilidade, release e verificação
  no app real.
- Guia de contribuição, política de segurança, código de conduta, suporte e
  checklist de configuração do GitHub.

## [1.0.0] - 2026-10-25

Primeira versão instalável do Pulse FX.

### Adicionado

- Efeitos **Hit**, **Strobe** e **Pulse** com cor, intensidade e geometria
  configuráveis.
- Alvos **tela cheia**, **vinheta** e **moldura**, renderizados por CSS
  `@keyframes` na saída, sem IPC por frame.
- Painel em português do Brasil com prévia local, seleção de saída/camada e
  controles contextuais por modo.
- Trava de segurança de frequência ligada por padrão, persistida e aplicada a
  todos os caminhos; teto configurável de 3 Hz com a trava e teto técnico de
  20 Hz sem ela.
- **PARAR TUDO** sempre visível e confirmação antes de substituir conteúdo de
  terceiros em uma camada.
- Aplicação automática do overlay no primeiro disparo e movimentação segura
  entre saídas/camadas.
- Três nós de automação em background: disparar hit, ligar/desligar
  strobe/pulse e aplicar/remover overlay.
- Persistência versionada com migração da chave legada, proteção contra schema
  futuro e escrita com debounce.
- 67 testes automatizados cobrindo parâmetros, renderização, storage, fila,
  seleção, mensagens e handshake.

### Corrigido

- Painel preso em “O Spresenter ainda não respondeu” quando o host descartava o
  primeiro pedido de estado antes de o listener da lógica existir. O handshake
  agora repete o pedido até a primeira resposta, com ação **Tentar novamente**.

### Segurança

- Frequência centralizada em `clampFrequency(hz, safetyLockOn)`, com defesa em
  profundidade também no gerador de HTML.
- Remoção conservadora: o overlay só é limpo quando o stage pertence ao Pulse
  FX.

### Documentação

- README em português com instalação, uso, automação, persistência, solução de
  problemas e limitações dependentes do Spresenter.
- Documentação de arquitetura, decisões técnicas e registro da verificação no
  app real (Spresenter 0.3.50).

[1.3.2]: https://github.com/ariellaureanorosas/spresenter-pulse-fx/releases/tag/v1.3.2
[1.3.1]: https://github.com/ariellaureanorosas/spresenter-pulse-fx/releases/tag/v1.3.1
[1.3.0]: https://github.com/ariellaureanorosas/spresenter-pulse-fx/releases/tag/v1.3.0
[1.2.1]: https://github.com/ariellaureanorosas/spresenter-pulse-fx/releases/tag/v1.2.1
[1.2.0]: https://github.com/ariellaureanorosas/spresenter-pulse-fx/releases/tag/v1.2.0
[1.1.0]: https://github.com/ariellaureanorosas/spresenter-pulse-fx/releases/tag/v1.1.0
[1.0.0]: https://github.com/ariellaureanorosas/spresenter-pulse-fx/releases/tag/v1.0.0
