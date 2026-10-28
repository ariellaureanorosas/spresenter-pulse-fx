# Mídia do README

Os arquivos desta pasta são usados no `README.md`. Como o plugin é visual, a
mídia é parte da documentação.

## Especificação

| Arquivo | Formato | Tamanho | Conteúdo |
|---|---|---|---|
| `panel.png` | PNG | 1100×2038 | Painel completo, com Pulse em execução |
| `hit.gif` | GIF | 640×360, 1,5 s | Disparo de Hit em tela cheia |
| `strobe.gif` | GIF | 640×360, 2 s | Strobe a 3 Hz com a trava ligada |
| `pulse.gif` | GIF | 640×360, 2,4 s | Pulse em vinheta |
| `targets.png` | PNG | 1600×560 | Tela cheia, vinheta e moldura lado a lado |

## Como regenerar

```bash
npm run media
```

O script `scripts/media.mjs` compila `src/shared/overlay.ts` e a UI de `src/ui/`
e usa o Chromium do Playwright para renderizar. Requer uma vez:

```bash
npx playwright install chromium
```

- **GIFs**: o HTML vem de `buildOverlayHtml` — o mesmo gerador usado em produção.
  A animação é pausada e avançada por `animation-delay` negativo, para que cada
  quadro seja determinístico (sem depender do relógio da captura).
- **`panel.png`**: é a UI React de verdade, servida localmente, com um host falso
  que só responde a `requestState` com um estado plausível.
- **`targets.png`**: cada alvo é renderizado em um iframe 16:9, para que as
  unidades `vmin` da moldura meçam o palco certo.

## Regras

- A legenda deve dizer **renderização do overlay do plugin** ou
  **renderização do painel** — nunca "captura do Spresenter". O fundo escuro dos
  GIFs é um palco neutro; não é uma saída real do aplicativo.
- Não inclua letras de músicas, nomes de pessoas ou conteúdo de terceiros.
- Nomeie em minúsculas, sem espaços.
- Ao trocar uma mídia, atualize a linha correspondente em
  [docs/verification/README.md](../verification/README.md) se a mudança for
  visual.
- Se o Chromium não estiver disponível, não substitua por imagem de outra
  origem: publique sem mídia e registre a pendência.
