# Pulse FX

<p>
  <a href="https://github.com/ariellaureanorosas/spresenter-pulse-fx/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/ariellaureanorosas/spresenter-pulse-fx/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="Licença: MIT" src="https://img.shields.io/badge/licen%C3%A7a-MIT-22d3ee"></a>
  <a href="manifest.json"><img alt="Spresenter 0.3.50+" src="https://img.shields.io/badge/Spresenter-0.3.50%2B-8b5cf6"></a>
  <a href="package.json"><img alt="Node.js 22.12+" src="https://img.shields.io/badge/Node.js-22.12%2B-339933"></a>
</p>

**Efeitos de luz ao vivo para o Spresenter.** Um flash, uma piscada ou uma
respiração suave projetados por cima da saída, com controle de intensidade,
cor, geometria e uma trava de segurança de frequência.

<!--
Demonstração: grave os arquivos descritos em docs/media/README.md e descomente
o bloco abaixo.

<p align="center">
  <img src="docs/media/hit.gif" alt="Hit do Pulse FX em uma saída do Spresenter" width="640">
</p>

| Hit | Strobe | Pulse |
|---|---|---|
| ![Hit](docs/media/hit.gif) | ![Strobe](docs/media/strobe.gif) | ![Pulse](docs/media/pulse.gif) |
-->

[Instalação](#instalação) · [Como usar](#como-usar) · [Automação](#automação) ·
[Desenvolvimento](#desenvolvimento) · [Documentação](#documentação) ·
[Solução de problemas](#solução-de-problemas)

> Compatível com Spresenter **0.3.50** ou superior.
> Repositório privado: instalação e releases exigem acesso de colaborador.

O plugin é composto por duas threads, como a documentação do Spresenter exige:
a lógica roda isolada, sem DOM, e o painel React apenas envia intenções e
desenha o estado autoritativo devolvido por ela. Toda a animação acontece no
navegador da saída com CSS `@keyframes`; nenhum frame trafega por IPC.

| Modo | Comportamento |
|---|---|
| **Hit** | Um flash único que acende e cai sozinho. Cada disparo gera um keyframe novo, então rajadas sempre recomeçam do zero. |
| **Strobe** | Piscadas em passos duros, com duty cycle ajustável e frequência de 0,5 a 20 Hz (3 Hz com a trava). |
| **Pulse** | Respiração contínua e suave, com um ciclo completo (0 → pico → 0) por período. |

| Alvo | Geometria |
|---|---|
| **Tela cheia** | A cor cobre a saída inteira. |
| **Vinheta** | Gradiente radial que preserva o centro e fecha as bordas. |
| **Moldura** | Sombra interna (`box-shadow` inset) com espessura e suavização. |

## Requisitos

- Spresenter **0.3.50 ou superior**, com suporte a plugins.
- Para desenvolver: Node.js **22.12 ou superior** e npm 10+.
- Matriz completa em [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).
- O SDK oficial está vendorizado em `sdk/spresenter-plugin-sdk.tgz` (versão
  0.5.0, a mesma referência usada no build).

O plugin usa somente APIs documentadas e presentes no SDK vendorizado. O
manifesto declara o mínimo necessário:

```json
"permissions": ["outputs:read", "live:read", "live:write"],
"background": true
```

`storage` e os nós de automação não exigem escopo adicional; `background: true`
é o que mantém a lógica viva para a automação funcionar com o painel fechado.

## Instalação

### Pacote da release

> O repositório é **privado**. O download exige acesso de colaborador ao GitHub.

1. Baixe o ZIP e o checksum na
   [página de releases](https://github.com/ariellaureanorosas/spresenter-pulse-fx/releases).
2. No Spresenter, abra **Configurações → Plugins → Instalar (.zip/pasta)** e
   escolha `com.spresenter.pulse-fx-<versão>.zip`.
3. Abra o painel **Pulse FX** na dock ou em uma janela flutuante.

O ZIP contém o `manifest.json` na raiz, o build em `dist/`, o README, a licença
e os avisos de terceiros. Para conferir o download, compare o SHA-256 com o
arquivo `.sha256` publicado na mesma release.

### A partir do código-fonte

```bash
npm install
npm run package
```

O instalador estará em `release/com.spresenter.pulse-fx-<versão>.zip`. O comando
também gera o respectivo `.sha256` para conferência.

### Modo de desenvolvimento

```bash
npm install
npm run dev
npm run package:folder   # gera release/com.spresenter.pulse-fx-<versão>/
```

Em **Configurações → Plugins → Carregar pasta (dev)**, selecione a pasta gerada
por `package:folder` — ela contém apenas `manifest.json`, `dist/` e os arquivos
de licença. Alterações em `src/` são recompiladas para `dist/` pelos watches.

**Não selecione a raiz do repositório.** O instalador copia a pasta inteira:
`node_modules/`, `.git/` e `docs/` vão junto, e a próxima reinstalação pode
falhar com `EPERM` porque o Windows não consegue remover a pasta antiga. Se já
instalou assim, veja [Solução de problemas](#falha-ao-copiar-arquivos--eperm-ao-instalar).

Se preferir um build único:

```bash
npm run build
```

## Como usar

1. Escolha a **saída** e a **camada** em que o efeito vai aparecer. Índices
   maiores ficam por cima; camadas desativadas naquela saída não podem ser
   escolhidas.
2. Clique em **Aplicar na saída** para montar o palco transparente do Pulse FX,
   ou simplesmente dispare: o overlay é aplicado automaticamente no primeiro
   disparo, com um aviso.
3. Escolha o modo **Hit**, **Strobe** ou **Pulse**, a cor, a intensidade, a área
   e os ajustes do modo.
4. Use **Disparar hit** / **Iniciar strobe** / **Iniciar pulse** para executar.
   O botão **Parar nesta camada** encerra o efeito selecionado; **PARAR TUDO**,
   sempre visível no topo, interrompe todos os efeitos, inclusive os iniciados
   pela automação.
5. **Remover da saída** limpa a camada somente quando ela contém o stage do
   Pulse FX. Conteúdo de outra função nunca é apagado pelo remove.

### Prévia local

O cartão **Antes de projetar** mostra o efeito sobre um xadrez de transparência,
para você ver exatamente o que o overlay deixa passar. **Clique em qualquer
ponto da prévia** — ou use o botão **Repetir** — para reiniciar a animação. A
prévia usa o mesmo CSS da saída; mudar modo, cor, intensidade ou alvo atualiza o
palco na hora.

### Troca de saída ou camada com overlay ativo

Ao escolher outro destino, o overlay é **movido**: o novo palco é aplicado
primeiro e o antigo é limpo em seguida. Se o destino já tiver conteúdo de
terceiros, o painel pede confirmação antes, porque `live.apply` substitui o
conteúdo da camada. O conteúdo anterior **não é restaurado** ao remover o
overlay.

### Segurança de frequência

- A **trava de segurança** vem ligada por padrão e é persistida.
- Com a trava, toda frequência — painel, automação e valores restaurados — é
  limitada a **3 Hz** por um único caminho de código.
- Sem a trava, o teto técnico continua sendo **20 Hz**.
- O painel mostra um aviso persistente enquanto a trava estiver desligada e um
  aviso de clamp sempre que um valor pedido for ajustado, com a origem
  (painel, automação ou preferências salvas).
- O slider de frequência acompanha o limite em vigor; valores vindos da
  automação ou de dados antigos também passam pelo mesmo clamp.

> Flashes rápidos podem incomodar ou afetar pessoas com fotossensibilidade.
> Use a trava ligada sempre que possível.

### Restaurar padrões

O botão de restaurar, no cabeçalho de **Ajuste a luz**, volta todos os
parâmetros ao padrão e **religa a trava**. A seleção e o overlay aplicado são
preservados. Um toast oferece **Desfazer** por alguns segundos.

## Automação

Com `background: true`, três nós ficam disponíveis em **Automação → Pulse FX**
e continuam funcionando com o painel fechado. Eles usam o mesmo motor, a mesma
fila serial e a mesma trava de frequência do painel.

### Pulse FX — Disparar hit

| Campo | Tipo | Padrão | Observação |
|---|---|---|---|
| `color` | string | `#ffffff` | Hex (`#ffffff`, `#22d3ee`) ou `rgb(…)`. |
| `intensity` | number | `85` | 0 a 100. |
| `decayMs` | number | `320` | Queda em ms, 30 a 2000. |
| `target` | string | `full` | `full`, `vignette` ou `frame`. |
| `thickness` | number | `35` | Espessura, 0 a 100 (vinheta/moldura). |
| `softness` | number | `50` | Suavização, 0 a 100 (vinheta/moldura). |
| `output` | string | vazio | Índice da saída; vazio usa a seleção salva. |
| `layer` | number | `-1` | `-1` usa a seleção salva. |

### Pulse FX — Strobe/Pulse

| Campo | Tipo | Padrão | Observação |
|---|---|---|---|
| `enabled` | boolean | `true` | `false` desliga o efeito contínuo da camada. |
| `mode` | string | `strobe` | `strobe` ou `pulse`. |
| `frequency` | number | `2` | 0,5 a 20; limitada a 3 Hz com a trava. |
| `color` | string | `#ffffff` | Cor do efeito. |
| `intensity` | number | `85` | 0 a 100. |
| `flashWidth` | number | `50` | Largura do flash, 5 a 95 (strobe). |
| `target` | string | `full` | `full`, `vignette` ou `frame`. |
| `thickness` | number | `35` | Espessura, 0 a 100 (vinheta/moldura). |
| `softness` | number | `50` | Suavização, 0 a 100 (vinheta/moldura). |
| `output` | string | vazio | Índice da saída; vazio usa a seleção salva. |
| `layer` | number | `-1` | `-1` usa a seleção salva. |

### Pulse FX — Aplicar/remover overlay

| Campo | Tipo | Padrão | Observação |
|---|---|---|---|
| `action` | string | `apply` | `apply` ou `remove`. |
| `output` | string | vazio | Índice da saída; vazio usa a seleção salva. |
| `layer` | number | `-1` | `-1` usa a seleção salva. |

A automação não tem operador para responder a um modal. Se a camada tiver
conteúdo de terceiros, o nó **aplica e avisa** por toast quando o painel estiver
aberto; o conteúdo anterior não é restaurado. Remover é sempre conservador: o
nó só chama `live.clear` quando reconhece o stage do Pulse FX na camada.

Campos não informados usam os padrões da tabela, independentemente do que está
ajustado no painel. A seleção de saída/camada e a trava de segurança são
compartilhadas com o painel; com a trava desligada, a automação também pode
chegar ao teto técnico de 20 Hz.

## Persistência

- Chave atual: `pulsefx.settings`, com `schemaVersion: 1`:
  `{ schemaVersion, params, output, layer, hasSelection }`.
- Escrita com debounce de aproximadamente 250 ms.
- Migração automática da chave legada
  `com.spresenter.pulse-fx.settings.v1` (formato com `config`, `fall`, `duty`,
  `fullscreen`), preservando cor, modo, intensidade, alvo, queda, frequência e
  geometria.
- Dados corrompidos, campos inválidos ou frequência fora da faixa caem nos
  padrões com aviso.
- Um schema futuro **não é sobrescrito**; o plugin usa os padrões e avisa, para
  não destruir preferências de uma versão mais nova.
- Primeiro uso: trava ligada, saída 0 e a camada mais alta disponível.

## Desenvolvimento

```bash
npm ci
npm run verify      # formato, lint, tipos, testes com cobertura, build e ZIP
npm run dev         # watches de código e UI
npm run test:watch  # Vitest em watch
```

O `verify` é o mesmo gate do CI. O pacote final contém `manifest.json` na raiz,
`dist/`, README, licença e avisos de terceiros. O script `scripts/package.mjs`
usa `adm-zip`, valida versão/manifesto/SDK e gera o checksum SHA-256, sem
depender de ferramentas externas.

Cada push e pull request para `main` executa formatação, lint, typecheck, a
suíte completa com cobertura, auditoria das dependências de runtime, build e
empacotamento no GitHub Actions, em Node 22 e 24. O workflow reutilizável
`.github/workflows/verify.yml` é o mesmo gate chamado pelo release; a tag só
publica depois que ele passa. CodeQL e revisão de dependências rodam quando
GitHub Code Security está habilitado.

### Estrutura

```
manifest.json          metadados, escopos, painel e background
src/code.ts            motor (estado, palco, efeitos, storage, automação, ponte da UI)
src/logic/             logger da thread de lógica
src/shared/            tipos, parâmetros, overlay, storage, mensagens e fila (puro)
src/ui/                painel React (App, components, styles, bridge, ErrorBoundary)
tests/                 Vitest: shared/, logic/ e ui/
docs/                  arquitetura, protocolo, compatibilidade, release e verificação
scripts/               validação de manifesto/SDK, versão, notas de release e ZIP
sdk/                   SDK oficial vendorizado (0.5.0) + checksum
```

O mapa de módulos detalhado e as decisões de arquitetura estão em
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentação

- [Arquitetura e decisões](docs/ARCHITECTURE.md)
- [Protocolo UI ↔ lógica](docs/PROTOCOL.md)
- [Compatibilidade e limitações](docs/COMPATIBILITY.md)
- [Processo de release](docs/RELEASING.md)
- [Configuração do GitHub](docs/GITHUB-SETTINGS.md)
- [Verificação manual](docs/verification/)
- [Suporte](SUPPORT.md) · [Contribuição](CONTRIBUTING.md) · [Segurança](SECURITY.md)

## Limitações

O que depende do host e não é provado no repositório está detalhado em
[docs/COMPATIBILITY.md](docs/COMPATIBILITY.md). Em resumo:

- Não há callback de unload: remova o overlay pelo painel antes de desinstalar.
- `live.apply` substitui o conteúdo da camada; o plugin não o restaura.
- A automação aplica e avisa, mas não abre modal de confirmação.
- A projeção real depende do navegador embarcado do Spresenter.

## Solução de problemas

- **“Nenhuma saída disponível”** — confira se a saída está aberta/conectada no
  Spresenter e use o botão **Atualizar** no cartão de destino.
- **“Conectando ao palco” por muito tempo** — o painel repete o pedido de estado
  automaticamente até a lógica responder e, após 6,5 s, oferece **Tentar
  novamente**. Se persistir, feche e reabra o painel; confira se `dist/code.js`
  existe e se o log do app mostra “Painel conectado à lógica”.
- **O efeito não aparece** — a camada pode estar desativada na saída, o overlay
  pode ter sido substituído por outra função, ou a saída não está projetando.
  O cartão de destino mostra o estado da camada antes de aplicar.
- **Aviso de frequência ajustada** — algum caminho pediu acima do limite; o
  valor aplicado é o mostrado no aviso. Com a trava ligada o máximo é 3 Hz;
  desligada, 20 Hz.
- **“Falha ao copiar arquivos” / `EPERM` ao instalar** — o Spresenter remove a
  pasta antiga do plugin antes de copiar a nova, e o Windows recusa a remoção
  quando a pasta está em uso ou veio de uma instalação feita a partir da raiz do
  repositório (com `node_modules/` e `.git/`).
  1. Feche o Spresenter por completo (confira no Gerenciador de Tarefas se
     sobrou `Spresenter.exe`).
  2. Apague a pasta antiga:
     ```powershell
     Remove-Item "$env:APPDATA\spresenter\plugins\com.spresenter.pulse-fx" -Recurse -Force
     ```
  3. Instale o ZIP de novo. Se a remoção também falhar, reinicie o computador e
     repita antes de abrir o app.
- **Overlay antigo depois de desinstalar** — a API não expõe unload; limpe a
  camada pelo app ou reinstale e use **Remover da saída**.

## Contribuição e segurança

Contribuições seguem o [guia de contribuição](CONTRIBUTING.md) e o
[Código de Conduta](CODE_OF_CONDUCT.md), com Conventional Commits, TypeScript
estrito e testes para toda lógica nova. Para relatar uma vulnerabilidade, use o
canal privado descrito em [SECURITY.md](SECURITY.md); não abra uma issue
pública.

## Licença

MIT — veja [LICENSE](LICENSE). Autor: **Ariel Laureano Rosas**.

O release inclui componentes de terceiros sob MIT; consulte
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
