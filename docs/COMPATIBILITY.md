# Compatibilidade e limitações

## Matriz suportada

| Componente | Versão | Observação |
|---|---|---|
| Pulse FX | 1.3.0 | Versão atual. |
| Spresenter | **0.3.50 ou superior** | `minAppVersion` no manifesto. |
| SDK de plugins | **0.5.0** | Vendorizado em `sdk/spresenter-plugin-sdk.tgz`. |
| Node.js (desenvolvimento) | **22.12 ou superior** | `.nvmrc` fixa 22.12.0; CI testa 22 e 24. |
| npm | 10 ou superior | `engine-strict` ativo. |
| Sistema | Windows (referência), Linux/macOS para build | O plugin roda no navegador embarcado do Spresenter. |

### Por que 0.3.50 e não 0.3.0

O app de referência é 0.3.50, os templates oficiais embutidos no app usam
`minAppVersion` igual à versão do app e o SDK vendorizado é 0.5.0. Não há
evidência de que o SDK 0.5.0 funcione em 0.3.0; por isso o plugin não promete
essa combinação. Ver `docs/verification/2026-10-25-baseline.md`.

Quem estiver em uma versão anterior do Spresenter deve permanecer no Pulse FX
1.0.0, que declara `minAppVersion: 0.3.0`.

## APIs do host usadas

Somente APIs documentadas e presentes no SDK vendorizado:

| Escopo | Uso |
|---|---|
| `outputs:read` | `outputs.list()`, `layers.list()` |
| `live:read` | `live.read` para detectar ocupação e reconhecer o próprio stage |
| `live:write` | `live.apply`, `live.setState`, `live.setElement`, `live.clear` |
| — (sem escopo) | `storage.*`, `automation.registerNode/registerCategory`, `ui.*`, `on(...)` |

`background: true` mantém a lógica viva para a automação. Nenhuma API interna ou
não documentada é usada.

## O que depende do host e não é provado no repositório

- A projeção real do HTML/CSS na saída, em todas as versões do navegador
  embarcado do Spresenter. A API usada é a documentada.
- O comportamento visual do editor de automação ao montar os formulários dos
  nós. Os campos usam apenas `string`, `number` e `boolean`, com `hint`; não
  dependemos do tipo `select`.
- A ordem das camadas em instalações futuras. A convenção de maior índice no
  topo foi confirmada na instalação de referência (0.3.50) e está isolada em
  `src/shared/selection.ts`.
- Não existe, na API documentada, um callback de unload para a thread de
  lógica. O plugin cancela timers e listeners internos e oferece **PARAR TUDO**,
  mas a limpeza de um stage já aplicado ao desinstalar ou desativar depende do
  host. Se for desinstalar com um overlay na tela, remova-o pelo painel antes.
- O balanceamento de carga de saídas múltiplas e a política de eventos `live`
  são do app; o plugin revalida a camada antes de aplicar e reconcilia o estado
  quando o app avisa que algo mudou.

## Navegador embarcado

O overlay usa apenas recursos amplamente suportados:

- CSS `@keyframes`, `animation`, `steps()`, `cubic-bezier()`;
- `opacity`, `inset`, `pointer-events`, `will-change`;
- `radial-gradient`, `box-shadow` inset;
- unidades relativas (`%`, `vmin`).

Não há `backdrop-filter`, `mask`, `@property`, Houdini ou JavaScript de
animação. Se o host atualizar o Chromium embarcado, a recomendação é repetir a
verificação manual em `docs/verification/`.

## Limitações conhecidas

1. **Sem unload**: remover o stage ao desinstalar/desativar depende do host.
2. **Substituição de camada**: `live.apply` substitui o conteúdo; o conteúdo
   anterior não é restaurado pelo plugin.
3. **Automação sem operador**: um nó aplica e avisa, mas não abre modal.
4. **Uma instância de lógica**: os overlays são rastreados por `saída:camada`;
   duas cópias do plugin não devem ser instaladas ao mesmo tempo.
5. **Foto sensibilidade**: flashes rápidos podem incomodar. A trava de 3 Hz vem
   ligada; use-a sempre que possível.

## Histórico de verificação

- [2026-10-25 — Spresenter 0.3.50](verification/2026-10-25-spresenter-0.3.50.md)
- [2026-10-25 — baseline](verification/2026-10-25-baseline.md)
