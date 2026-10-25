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

## Ambiente

Requisitos: Node.js 22.12 ou superior, npm e uma instalação do Spresenter com
suporte a plugins.

```bash
npm install
npm run typecheck
npm test
npm run build
npm run package
```

O SDK oficial está vendorizado em `sdk/spresenter-plugin-sdk.tgz`. Mantenha a
versão alinhada ao `manifest.json` e não a substitua por uma cópia não oficial.

## Arquitetura e padrões

- A lógica (`src/code.ts`) é a única fonte da verdade e roda sem DOM.
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

- Funções puras exigem testes em `tests/` com Vitest.
- Correções de bug devem incluir um teste de regressão sempre que possível.
- Antes de abrir um pull request, rode a suíte completa:

```bash
npm run typecheck
npm test
npm run build
npm run package
```

## Commits e pull requests

- Prefira [Conventional Commits](https://www.conventionalcommits.org/pt-br/):
  `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- Mantenha cada commit coeso e com mensagem no imperativo.
- Descreva no pull request o comportamento alterado, como testou e qualquer
  dependência do host que não possa ser verificada localmente.
- Inclua capturas ou logs quando a mudança for visual ou depender do Spresenter.

## Release

1. Atualize a versão em `manifest.json`, `package.json` e `package-lock.json`.
2. Registre a mudança em `CHANGELOG.md`.
3. Rode `npm run typecheck`, `npm test` e `npm run package`.
4. Crie uma tag anotada `vX.Y.Z` e envie `main` e a tag.
5. Publique o ZIP e o arquivo `.sha256` gerados em `release/` na release do
   GitHub.

O workflow de CI valida typecheck, testes, build e empacotamento em cada push e
pull request para `main`.
