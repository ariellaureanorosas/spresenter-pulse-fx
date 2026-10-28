# Contribuindo com o Pulse FX

Obrigado pelo interesse. Este guia cobre o ambiente, os padrões do projeto e o
fluxo de revisão. Ao participar, você concorda com o
[Código de Conduta](CODE_OF_CONDUCT.md).

## Antes de começar

- Para bugs, abra uma issue descrevendo a versão do Pulse FX, a versão do
  Spresenter, a saída utilizada e os passos para reproduzir.
- Para vulnerabilidades, **não abra uma issue pública**. Siga a
  [política de segurança](SECURITY.md).
- Mudanças de comportamento devem preservar as APIs documentadas do Spresenter.
  Não introduza dependências de APIs internas ou não documentadas.
- O repositório é público: faça um fork, crie um branch e abra um pull request.
  Não é preciso pedir acesso.

## Ambiente

Requisitos: Node.js **22.12 ou superior**, npm **10+** e uma instalação do
Spresenter **0.3.50+** para validar mudanças visuais.

```bash
npm ci

npm run verify       # gate completo: formato, lint, tipos, testes, build e ZIP
npm run check        # Biome: lint + formato (sem escrever)
npm run check:fix    # Biome: aplica correções e formatação
npm run lint         # Biome: somente lint
npm run format:check # Biome: somente formato
npm run typecheck    # tsc --noEmit
npm test             # Vitest
npm run test:watch   # Vitest em watch
npm run test:coverage # Vitest com cobertura e limites mínimos
npm run dev          # watches de código e UI
npm run package      # build + ZIP + SHA-256 em release/
npm run media        # regenera docs/media a partir do build (Playwright)
```

O SDK oficial está vendorizado em `sdk/spresenter-plugin-sdk.tgz` (0.5.0) com
checksum ao lado. Mantenha a versão alinhada ao `manifest.json` e não a
substitua por uma cópia não oficial.

## Arquitetura e padrões

Leia [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) antes de mudanças estruturais.

- A lógica (`src/code.ts`) é a única fonte da verdade e roda sem DOM. Ela acessa
  o host pelo global `spresenter`, tipado em `src/spresenter.d.ts`; o host falso
  de `tests/helpers/fakeHost.ts` substitui esse global nos testes.
- A UI (`src/ui/`) nunca chama o host diretamente; toda comunicação passa por
  mensagens tipadas em `src/shared/messages.ts`.
- Código em `src/shared/` deve permanecer puro e testável, sem `window`,
  `document` ou `spresenter`.
- TypeScript estrito. A interface é em português do Brasil; identificadores,
  arquivos e mensagens de commit ficam em inglês.
- Não adicione escopos ao manifesto sem uso real. O princípio é menor
  privilégio.
- Toda frequência deve passar por `clampFrequency`; não crie caminhos paralelos
  para aplicar efeitos.
- Preserve a fila serial: UI, automação, timers e eventos não podem mutar o palco
  em paralelo.

## Testes

- Funções puras: `tests/shared/` (e `tests/*.test.ts` para as que já existiam).
- Lógica com host falso: `tests/logic/`.
- Componentes e hooks: `tests/ui/` com jsdom e Testing Library.
- Correções de bug devem incluir um teste de regressão sempre que possível.
- Cobertura mínima configurada em `vitest.config.ts`: global ≥ 70% de linhas,
  funções e instruções e ≥ 65% de branches; `src/shared/` ≥ 85% (linhas,
  funções, instruções) e ≥ 80% de branches. Se a mudança reduzir a cobertura,
  adicione testes em vez de baixar o limite.
- Antes de abrir um pull request, rode:

```bash
npm run verify
```

## CI

Os workflows ficam em `.github/workflows/`:

- `verify.yml` — workflow reutilizável com o gate completo; roda em Node 22 e 24
  e empacota somente no 22. É chamado pelo CI e pelo release.
- `ci.yml` — dispara `verify.yml` em push para `main`, pull requests e execução
  manual.
- `release.yml` — publica a release a partir de uma tag `v*` (ver
  [docs/RELEASING.md](docs/RELEASING.md)).
- `codeql.yml` e `dependency-review.yml` — análise de segurança e revisão de
  dependências. Rodam em pull request e em push para `main`, sem segredo
  adicional: o `GITHUB_TOKEN` do repositório público já tem o necessário.

Todos os checks precisam estar verdes antes do merge. Em pull request,
`npm run verify` local é o mesmo caminho executado no CI. A configuração de
rulesets, Code Security e tags está em
[docs/GITHUB-SETTINGS.md](docs/GITHUB-SETTINGS.md).

## Commits e pull requests

- Prefira [Conventional Commits](https://www.conventionalcommits.org/pt-br/):
  `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`, `ci:`.
- Mantenha cada commit coeso e com mensagem no imperativo.
- Descreva no pull request o comportamento alterado, como testou e qualquer
  dependência do host que não possa ser verificada localmente.
- Inclua capturas ou logs quando a mudança for visual ou depender do Spresenter.
- Atualize a documentação afetada no mesmo PR:
  - protocolo → `docs/PROTOCOL.md`;
  - compatibilidade/limitações → `docs/COMPATIBILITY.md`;
  - decisão de arquitetura → `docs/ARCHITECTURE.md`;
  - mudança visível → `CHANGELOG.md`.

## Release

O release é dirigido por tag e automatizado no CI. O passo a passo está em
[docs/RELEASING.md](docs/RELEASING.md). Não publique artefatos manualmente.

## Dúvidas

Consulte [SUPPORT.md](SUPPORT.md).
