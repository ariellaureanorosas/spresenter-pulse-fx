# Profissionalização do repositório — 2026-10-25

Registro do gate local executado na rodada de qualidade (lint/format, testes,
scripts de validação, CI e documentação), antes da tag `v1.1.0`.

**Versão:** 1.1.0
**SDK vendorizado:** 0.5.0
**Spresenter de referência:** 0.3.50
**Sistema:** Windows (ambiente de desenvolvimento do mantenedor)
**Node / npm:** 24.19.0 / 11.17.0 (CI roda Node 22 e 24; `engines` exige ≥ 22.12)

## Ferramentas

| Ferramenta | Versão | Papel |
|---|---|---|
| Biome | 2.6.3 | lint + formatação (substitui ESLint + Prettier) |
| TypeScript | 5.x (`tsc --noEmit`) | tipos |
| Vitest | 5.0.5 | testes e cobertura (v8) |
| Testing Library + jsdom | 16.x / 30.x | testes de UI |
| Vite | 8.3.5 | build das duas threads |

## Comandos e resultados

| Comando | Resultado |
|---|---|
| `npm run check` | 62 arquivos verificados, 0 erros |
| `npm run format:check` | sem diferenças |
| `npm run lint` | sem avisos |
| `npm run typecheck` | sem erros |
| `npm test` | 15 arquivos, **127 testes**, todos verdes |
| `npm run test:coverage` | 4,47 s; limites globais e de `src/shared/` atendidos |
| `npm run verify:sdk` | `@spresenter/plugin-sdk@0.5.0` íntegro (`7c0ee0b0c4e5…`) |
| `npm run verify:manifest` | válido — `com.spresenter.pulse-fx 1.1.0`, Spresenter ≥ 0.3.50, SDK 0.5.0 |
| `npm run version:check` | versão sincronizada em manifest/package/lock |
| `npm run verify` | gate completo verde |
| `npm run package` | `release/com.spresenter.pulse-fx-1.1.0.zip` (8 arquivos) |

## Cobertura

| Escopo | Stmts | Branch | Funcs | Lines |
|---|---:|---:|---:|---:|
| Global | 80,97% | 74,08% | 81,87% | 83,27% |
| `src/code.ts` | 78,37% | 69,27% | 95,78% | 80,72% |
| `src/shared/` | 93,81% | 84,69% | 100% | 95,83% |
| `src/ui/` | 80,07% | 73,70% | 61,33% | 83,18% |

## Artefato

| Item | Valor |
|---|---|
| ZIP | `com.spresenter.pulse-fx-1.1.0.zip` |
| Conteúdo | `manifest.json` na raiz, `dist/code.js`, `dist/ui/` (HTML + assets), README, licença e avisos |
| SHA-256 (local, Node 24) | `9736363cf28fefdd74aa0cd9b8361dcfd9f49b9a901bbf9677ded98b7ea42065` |
| SHA-256 (publicado, Node 22) | `f419bc92cd8041ce02ef25a3f04f6d162f30e6c74c6759c451deeb83a62b1f7c` |
| Checksum | `release/com.spresenter.pulse-fx-1.1.0.zip.sha256` (verificado pelo `package` e pelo workflow) |

O ZIP é reproduzível dentro da mesma versão de Node: duas execuções de
`npm run package` no mesmo commit geraram o mesmo SHA-256, porque
`scripts/package.mjs` grava as entradas em ordem estável com timestamp fixo. O
build do CI (Node 22) tem hash próprio, publicado junto do `.sha256` — é esse que
vale para quem baixa a release.

## O que foi validado

- Boot, migração, seleção, parâmetros, overlay, efeitos e automação contra um
  host falso (`tests/logic/`), com timers falsos.
- Ponte UI ↔ lógica (handshake, revisão de estado, confirmações) e painel em
  jsdom (`tests/ui/`).
- Fallback de erro do painel: o `ErrorBoundary` mostra a mensagem e permite
  tentar novamente sem derrubar a thread de lógica.
- Integridade do SDK vendorizado e sincronia de versão nos três arquivos.
- Conteúdo obrigatório do ZIP e checksum recalculado após a gravação.
- Ausência de vulnerabilidades nas dependências de runtime
  (`npm audit --omit=dev --audit-level=high`: 0).

## CI e release reais

| Evento | Resultado |
|---|---|
| CI #1 · `7e6e86d` (Node 22 e 24) | verde, 1 min |
| CI #2 · `9235dc0` (runners fixados em `ubuntu-24.04`) | verde |
| CI #3 · `eba7363` (1.1.0) | verde |
| Release · tag `v1.1.0` | gate + checksum + publicação verdes |
| CodeQL / Dependency review | ignorados pelo guard de GHAS, como esperado |

## Pendências manuais

1. **GitHub**: o repositório é privado no plano gratuito, então rulesets,
   proteção de tag e relato privado de vulnerabilidades não estão disponíveis —
   ver [docs/GITHUB-SETTINGS.md](../GITHUB-SETTINGS.md) para o que está ativo e
   para as opções de bloqueio técnico. Se houver GitHub Code Security, definir
   `ENABLE_GHAS=true` para ativar CodeQL e dependency review.
2. **Release `v1.1.0`**: publicada pela tag `v1.1.0` no commit `eba7363`,
   com `com.spresenter.pulse-fx-1.1.0.zip` e `.sha256`
   (`f419bc92cd8041ce02ef25a3f04f6d162f30e6c74c6759c451deeb83a62b1f7c`). A 1.0.0
   permanece publicada e intocada (tag em `e8ae4fb`).
3. **Mídia**: fora do escopo desta rodada (sem sessão de captura disponível).
   Gravar `docs/media/panel.png`, `hit.gif`, `strobe.gif`, `pulse.gif` e
   `targets.png` conforme `docs/media/README.md` e descomentar o bloco no README.
4. **Verificação visual no app**: a rodada mudou semântica/estrutura de alguns
   elementos do painel (`figure/figcaption` na prévia, scrim do modal, loader de
   boot) sem intenção de alterar o visual. Falta confirmar em uma saída real do
   Spresenter 0.3.50.
