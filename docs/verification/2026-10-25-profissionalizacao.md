# Profissionalização do repositório — 2026-10-25

Registro do gate local executado após a rodada de qualidade (lint/format,
testes, scripts de validação, CI e documentação), antes do commit desta rodada
sobre `4446041`.

**Versão:** 1.0.0
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
| `npm run verify:manifest` | válido — `com.spresenter.pulse-fx 1.0.0`, Spresenter ≥ 0.3.50, SDK 0.5.0 |
| `npm run version:check` | versão sincronizada em manifest/package/lock |
| `npm run verify` | gate completo verde |
| `npm run package` | `release/com.spresenter.pulse-fx-1.0.0.zip` (8 arquivos) |

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
| ZIP | `com.spresenter.pulse-fx-1.0.0.zip` |
| Conteúdo | `manifest.json` na raiz, `dist/code.js`, `dist/ui/` (HTML + assets), README, licença e avisos |
| SHA-256 | `b4b4ad6cb1a708f4f7e9e191745d7e1351fab6bb9a6f57322e5015a72a23af1a` |
| Checksum | `release/com.spresenter.pulse-fx-1.0.0.zip.sha256` (verificado pelo `package`) |

O ZIP é reproduzível: duas execuções de `npm run package` no mesmo commit
geraram o mesmo SHA-256, porque `scripts/package.mjs` grava as entradas em ordem
estável com timestamp fixo. O hash muda apenas se o conteúdo empacotado mudar
(ou se o Node/zlib for outro).

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

## Pendências manuais

1. **GitHub**: aplicar o checklist de
   [docs/GITHUB-SETTINGS.md](../GITHUB-SETTINGS.md) (ruleset de `main` com
   `Verify` obrigatório, proteção de tag `v*`, relato privado de
   vulnerabilidades). Se houver GitHub Code Security, definir
   `ENABLE_GHAS=true` para ativar CodeQL e dependency review.
2. **Release `v1.0.0`**: a tag original aponta para `4446041`, anterior aos
   scripts de release, e precisa ser recriada no commit desta rodada antes de o
   workflow `Release` publicar. Validar um `dry_run` em Actions primeiro.
3. **Mídia**: fora do escopo desta rodada (sem sessão de captura disponível).
   Gravar `docs/media/panel.png`, `hit.gif`, `strobe.gif`, `pulse.gif` e
   `targets.png` conforme `docs/media/README.md` e descomentar o bloco no README.
4. **Verificação visual no app**: a rodada mudou semântica/estrutura de alguns
   elementos do painel (`figure/figcaption` na prévia, scrim do modal, loader de
   boot) sem intenção de alterar o visual. Falta confirmar em uma saída real do
   Spresenter 0.3.50.
