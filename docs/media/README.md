# Mídia do README

Os arquivos desta pasta são usados no `README.md`. Como o plugin é visual, a
mídia é parte da documentação.

## Especificação

| Arquivo | Conteúdo |
|---|---|
| `hero.png` | arte de abertura: a marca do painel sobre o fundo do app (1280×440, 2×) |
| `panel-previa.png` | cartão **Prévia local** (Antes de projetar) |
| `panel-destino.png` | cartão **Destino** |
| `panel-movimento.png` | cartão **Movimento** |
| `panel-composicao.png` | cartão **Composição** (Ajuste a luz) |
| `panel-protecao.png` | cartão **Proteção** (trava de frequência) |
| `panel-execucao.png` | cartão **Execução** |
| `panel-automacao.png` | cartão **Automação** |
| `targets.png` | tela cheia, vinheta e moldura lado a lado (1600×560) |

Os prints do painel saem em 660 px de largura com escala 2× (1320 px de PNG),
para continuarem legíveis quando o README os exibe em ~500 px. O `hero.png` é
desenhado em 1280×440, também em 2×, e o README o exibe a 860 px.

## Como regenerar

```bash
npm run media
```

O script `scripts/media.mjs` compila a UI de `src/ui/` e usa o Chromium do
Playwright para renderizar. Requer uma vez:

```bash
npx playwright install chromium
```

- **Painel**: é a UI React de verdade, servida localmente, com um host falso que
  só responde a `requestState`. Cada print é o `section.pfx-card` real, localizado
  pelo kicker (`Destino`, `Movimento`, …). O script falha se o cartão não existir
  ou se a prévia sair apagada — melhor quebrar do que publicar imagem errada.
- **Prévia congelada**: a animação é pausada pela Web Animations API com
  `currentTime` em 50% do ciclo, para o quadro sair no pico. `animation-delay`
  não serve: o tempo já decorrido entra na conta.
- **`hero.png`**: não é recorte do painel. A arte recompõe a marca do app — o
  mesmo gradiente (`#ddff87 → #c6ff4a → #89f7cf`), o mesmo raio relativo e o
  mesmo traço do `IconPulse` — em tamanho grande, sobre o fundo do painel, com
  a linha de pulso repetida ao fundo. Sai do mesmo `npm run media`.
- **`targets.png`**: cada área é renderizada em um iframe 16:9, para que as
  unidades `vmin` da moldura meçam o palco certo.

## Regras

- A ressalva **renderização do painel** vale para os prints — nunca "captura do
  Spresenter". As imagens vêm do build do plugin, não de uma sessão no app. A
  exceção é o `hero.png`: é arte de marca, não tela, então não leva a ressalva.
- Não inclua letras de músicas, nomes de pessoas ou conteúdo de terceiros.
- Nomeie em minúsculas, sem espaços.
- Ao trocar uma mídia, atualize a linha correspondente em
  [docs/verification/README.md](../verification/README.md) se a mudança for
  visual.
- Se o Chromium não estiver disponível, não substitua por imagem de outra
  origem: publique sem mídia e registre a pendência.

## Histórico

Até 28/10/2026 o README abria com três GIFs (`hit`, `strobe`, `pulse`) gerados
pelo mesmo pipeline. Eles saíram porque o `pulse.gif` passava de 1 MB e a
animação não mostrava os controles: um print do painel comunica mais por menos
bytes.

Na mesma data, o recorte do topo do painel (`panel.png`) deu lugar a uma arte de
marca (`hero.png`) e o cartão de prévia passou a figurar no mesmo grid dos
outros seis, como `panel-previa.png`.
