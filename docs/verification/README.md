# Verificação manual

Parte do comportamento deste plugin só existe dentro do Spresenter: a projeção
na saída, o handshake do painel, o instalador do app, o navegador embarcado. Isso
não é observável em CI, então esta pasta guarda **apenas o que só o app pode
provar**.

## Regra

Um arquivo novo aqui só nasce quando existir evidência que o gate automatizado
não produz:

- sessão real no app (com trecho do `main-process.log` ou captura);
- falha reproduzida no host e o procedimento que a resolveu;
- comportamento de uma versão específica do Spresenter.

Mudança coberta por teste **não** gera documento: fica no `CHANGELOG.md`, no
`git log` e no resultado do CI. A versão de cada rodada entra na tabela abaixo,
para que o histórico continue legível sem um arquivo por release.

## Registros

| Data | Versão | Ambiente | Evidência | Arquivo |
|---|---|---|---|---|
| 2026-10-25 | 1.0.0 | Spresenter 0.3.50, Windows | boot e handshake do painel; **Disparar hit** em camada livre produziu o flash na saída | [spresenter-0.3.50](2026-10-25-spresenter-0.3.50.md) |
| 2026-10-25 | 1.1.0 | Windows + CI | gate completo; `EPERM` de reinstalação reproduzido e resolvido; CI e release reais | [profissionalizacao](2026-10-25-profissionalizacao.md) |

## O que já foi confirmado no app, por versão

| Versão | Mudança | Situação |
|---|---|---|
| 1.0.0 | overlay, hit, prévia, handshake | confirmado em 0.3.50 |
| 1.1.0 | qualidade e empacotamento, sem mudança de palco | confirmado por gate e instalação |
| 1.2.0 | prévia sem `<iframe>`, xadrez, clique para repetir | instalado; confirmação visual pendente |
| 1.2.1 | dica "Repetir" sobre o palco removida | instalado; bundle sem a dica; confirmação visual pendente |
| 1.3.0 | queda do Hit até 10 s | instalado; queda longa a conferir em saída real |
| 1.3.1 | hit deixa de re-disparar ao mudar parâmetros | corrigido e coberto por teste; conferir na saída real |

## Pendências manuais

1. **Prévia** (1.2.0 a 1.3.0): conferir xadrez escuro, clique no palco e escala
   de moldura/vinheta em uma saída real.
2. **Queda longa**: conferir que um hit de 10 s permanece no palco até o fim e
   limpa 120 ms depois.
3. **Hit sem re-disparo** (1.3.1): conferir na saída real que mexer em sliders
   durante a queda não gera um novo flash.
4. **Strobe e Pulse contínuos** em todas as saídas.
5. **Editor de automação** com o painel fechado.
6. **Limpeza do stage** ao desinstalar/desativar o plugin — a API não expõe
   callback de unload.
7. **Mídia**: `docs/media/panel.png`, `hit.gif`, `strobe.gif`, `pulse.gif`,
   `targets.png`, conforme [docs/media/README.md](../media/README.md).

## Decisões que vieram de verificação

- **`minAppVersion: 0.3.50`.** O app de referência é 0.3.50; os templates
  oficiais embutidos nele usam `minAppVersion` igual à versão do app e `sdk`
  igual ao SDK vendorizado (0.5.0); outro plugin do mesmo autor, instalado e
  funcional, declara exatamente essa combinação. A 1.0.0 declarava
  `minAppVersion: 0.3.0` com `sdk: 0.4.0`, e não há evidência de que o SDK 0.5.0
  funcione em 0.3.0 — por isso a promessa não é feita.
- **Prévia sem `<iframe>`** (1.2.0). O host embute a UI do plugin em um iframe de
  origem opaca (`sandbox="allow-scripts"`); um `srcdoc` aninhado não pintava de
  forma confiável e o palco aparecia branco. A prévia passou a desenhar o efeito
  direto no DOM, com a mesma geometria e os mesmos `@keyframes` da saída.
- **`npm run package:folder`** existe por causa do `EPERM` de reinstalação: copiar
  a raiz do repositório deixava `node_modules/` e `.git/` dentro da pasta do
  plugin, e o instalador não conseguia removê-la com o app aberto.
