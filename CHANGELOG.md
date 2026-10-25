# Changelog

Todas as mudanças notáveis deste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-10-25

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
- `PLAN.md` com arquitetura, decisões técnicas e registro da verificação no app
  real (Spresenter 0.3.50).

[1.0.0]: https://github.com/ariellaureanorosas/spresenter-pulse-fx/releases/tag/v1.0.0
