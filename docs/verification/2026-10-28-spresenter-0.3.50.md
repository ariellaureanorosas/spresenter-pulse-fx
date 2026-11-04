# Verificação manual — 2026-10-28, Spresenter 0.3.50

**Plugin:** Pulse FX 1.3.1
**SDK:** 0.5.0
**App:** Spresenter 0.3.50
**Ambiente:** Windows

Sessão real que fechou os itens abertos desde a 1.2.0.

## Prévia local

- O palco mostra o xadrez escuro de transparência, sem o retângulo branco da
  1.1.0.
- Clicar no palco repete a animação.
- Tela cheia, vinheta e moldura aparecem com a mesma geometria na prévia e na
  saída.

## Hit

- Com a queda em 10 s, o flash permanece no palco até o fim e limpa cerca de
  120 ms depois.
- Mexer em cor ou intensidade durante a queda não gera um novo flash: a
  alteração vale para o próximo disparo (correção da 1.3.1).

## Strobe e Pulse

- Os dois modos seguem contínuos nas saídas testadas, sem travar e sem deixar
  efeito órfão na saída anterior ao trocar de destino.

## Automação

- O nó executa com o painel fechado e o efeito continua no palco.
- Ao reabrir, o painel mostra o estado correto (`AO VIVO` / `AUTOMAÇÃO`).

## Parar e limpar

- **PARAR TUDO** encerra todos os efeitos, inclusive os da automação.
- **Parar nesta camada** encerra só o efeito selecionado.
- **Remover da saída** apaga apenas o palco do Pulse FX, sem tocar em conteúdo
  de outra função na mesma camada.
- Ao desinstalar com efeito ativo, o palco sai da saída.

## Mídia

O visual real confere com os prints de `docs/media/`, incluindo os três alvos do
`targets.png`.

## Ainda depende do host

Nada em aberto para a 1.3.1.

## 1.3.2 — rótulo do slider

Conferência feita em 2026-11-03, na mesma instalação do Spresenter 0.3.50:

- `20,0 Hz` aparece em **uma linha** no cartão Proteção, sem quebrar em
  `20,0` / `Hz`.
- A dica central dos sliders continua inteira no painel estreito.

A instalação que originou o teste também fechou o `EPERM` de reinstalação: a
pasta do plugin estava com 204 MB e 11.519 arquivos (instalação feita a partir da
raiz do repositório, com `.git/` e `node_modules/` dentro). Com o app encerrado,
a pasta foi renomeada e removida; o ZIP oficial criou uma instalação de 8
arquivos e 292 KB. O procedimento está em
[Solução de problemas](../../README.md#solução-de-problemas).
