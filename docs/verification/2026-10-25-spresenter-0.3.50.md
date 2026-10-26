# Verificação manual — 2026-10-25, Spresenter 0.3.50

**Plugin:** Pulse FX 1.0.0
**SDK:** 0.5.0
**App:** Spresenter 0.3.50
**Ambiente:** instalação local de referência (Windows)

## Boot e conexão do painel

- Causa do boot preso: o host descarta mensagens de UI que chegam antes de
  `spresenter.ui.onmessage` existir. O painel enviava `requestState` uma única
  vez; agora repete até a primeira resposta (`src/ui/handshake.ts`).
- Log do app: `Pulse FX carregado` às 15:17:59 e `Painel conectado à lógica` às
  15:18:00, após reabrir o painel.

## Efeitos

- **Disparar hit** em uma camada livre produziu o flash na saída.
- A prévia local usa a mesma geometria e os mesmos `@keyframes` da saída e
  rearma o hit pelo botão **Repetir**.

## Ainda dependem do host/editor

- Strobe/Pulse contínuos em todas as saídas.
- Editor de automação e nós com o painel fechado.
- Limpeza do stage após desinstalação/desativação do plugin (a API não expõe
  callback de unload).
- Ordem de camadas em instalações futuras.
