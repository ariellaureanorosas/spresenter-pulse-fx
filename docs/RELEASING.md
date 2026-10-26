# Release

O release é dirigido por tag. O workflow publica o ZIP e o checksum; ninguém
sobe artefato manualmente.

## Pré-requisitos

- CI verde em `main`.
- `CHANGELOG.md` com a seção `## [x.y.z]` preenchida.
- Acesso de escrita ao repositório e à página de releases.

## Passo a passo

1. **Defina a versão** (SemVer):

   ```bash
   npm run version:set -- 1.1.0
   ```

   O script atualiza `manifest.json`, `package.json` e `package-lock.json` e
   falha se houver divergência.

2. **Atualize o changelog**: mova os itens de `[Unreleased]` para
   `## [1.1.0] - AAAA-MM-DD`. Mantenha o formato Keep a Changelog.

3. **Valide localmente**:

   ```bash
   npm run verify
   ```

4. **Abra o PR** com o bump e o changelog. O merge precisa de CI verde.

5. **Crie a tag anotada** a partir de `main`:

   ```bash
   git checkout main
   git pull --ff-only
   git tag -a v1.1.0 -m "Pulse FX 1.1.0"
   git push origin v1.1.0
   ```

6. **Acompanhe o workflow** `Release`. Ele:
   - reexecuta a verificação completa em Node 22 e 24;
   - recusa tag fora de `main` e tag que não seja `v<manifest.version>`;
   - extrai as notas do `CHANGELOG.md` (`scripts/release-notes.mjs`);
   - confere o SHA-256 do ZIP baixado do job de build antes de publicar;
   - publica a release com `com.spresenter.pulse-fx-<versão>.zip` e `.sha256`.

7. **Confirme** a release e o checksum. Baixe o ZIP e o `.sha256` para a mesma
   pasta e rode:

   ```bash
   cd pasta-do-download
   sha256sum -c com.spresenter.pulse-fx-1.1.0.zip.sha256
   ```

   No Windows, sem `sha256sum`, compare o valor:

   ```powershell
   Get-FileHash .\com.spresenter.pulse-fx-1.1.0.zip -Algorithm SHA256
   Get-Content .\com.spresenter.pulse-fx-1.1.0.zip.sha256
   ```

   O arquivo `.sha256` guarda apenas o nome do ZIP; por isso o comando precisa
   rodar na pasta onde os dois arquivos estão.

O ZIP é **reprodutível**: as entradas entram em ordem fixa e com timestamp
constante (`scripts/package.mjs`). Rebuildar o mesmo commit, no mesmo Node, gera
o mesmo SHA-256 — se o hash divergir, o conteúdo mudou. Versões diferentes do
Node/zlib podem produzir um ZIP equivalente com hash diferente; nesse caso o
`.sha256` publicado continua sendo a referência.

## Dry-run

Use **Actions → Release → Run workflow** informando uma tag existente e
`dry_run: true` para validar tag, versão e notas sem publicar. O dry-run não cria
release nem altera assets: ele imprime as notas e sobe um artefato de workflow
`release-dry-run`.

## Regras

- **Nunca** sobrescreva uma release publicada. Se o artefato estiver errado,
  publique a próxima versão (`vX.Y.Z+1`) e marque a anterior como retirada.
- A tag precisa apontar para um commit de `main`.
- `manifest.json` é a fonte única da versão; a UI recebe o valor no build.
- O ZIP precisa conter `manifest.json` na raiz, `dist/code.js`,
  `dist/ui/index.html`, `README.md`, `LICENSE` e `THIRD_PARTY_NOTICES.md`.
- O checksum é obrigatório; sem ele, a release é considerada incompleta.

## Rollback

1. Não apague a release antiga; ela é o histórico.
2. Se o problema for de instalação, oriente reinstalar a versão anterior.
3. Corrija em `main`, publique `vX.Y.Z+1` com a correção.
4. Registre o incidente no CHANGELOG (seção `Corrigido`).
