# Configuração do GitHub

Passos que não vivem no repositório e precisam ser aplicados no GitHub por um
administrador. Faça-os uma vez e revise a cada release.

## Proteção de `main`

Crie um **ruleset** (Settings → Rules → Rulesets → New branch ruleset):

- Target: `main`.
- **Require a pull request before merging** (1 aprovação; dispense para o
  mantenedor apenas se não houver outra pessoa).
- **Require status checks to pass**: selecione o check do workflow `CI` →
  job `Verify` (o nome exibido é `Verify / Checks (Node 22)` e
  `Verify / Build and package (Node 22)`). Marque **Require branches to be up to
  date**.
- **Block force pushes**.
- **Require linear history**.
- **Require conversation resolution**.
- **Restrict deletions**.

## Proteção de tag

Crie outro ruleset com target **Tags** e padrão `v*`:

- **Restrict creations** e **Restrict updates** (somente o mantenedor).
- **Restrict deletions**.

Isso impede que uma tag de release seja movida depois de publicada.

## Segurança

- Settings → Code security: habilite **Private vulnerability reporting** para
  que o link de `SECURITY.md` funcione.
- Habilite **Dependabot alerts** e **Dependabot security updates**.
- Se houver **GitHub Code Security** (GHAS), habilite **Code scanning** e crie a
  variável de repositório `ENABLE_GHAS=true` (Settings → Secrets and variables →
  Actions → Variables). Sem ela, os jobs `CodeQL` e `Dependency review` são
  ignorados; com ela, passam a rodar em PR e push.
- Em Settings → Actions → General, mantenha o token padrão com permissões
  **read-only**; os workflows pedem `contents: write` apenas no job de release.
- Habilite **Require approval for first-time contributors** se o repositório
  receber contribuições externas.

## Repositório

- Descrição: `Efeitos de luz ao vivo (Hit, Strobe, Pulse) para o Spresenter.`
- Tópicos: `spresenter`, `spresenter-plugin`, `lighting`, `live`, `typescript`.
- Labels: `bug`, `enhancement`, `documentation`, `dependencies`,
  `good first issue`.
- Discussions: opcional; se ativar, direcione dúvidas de uso para lá.

## Release

1. Envie a tag (`git push origin v1.1.0`): o workflow **Release** roda o gate,
   confere a tag e publica ZIP + `.sha256` automaticamente.
2. Para revalidar uma tag já existente sem tocar nos assets, use **Actions →
   Release → Run workflow** com `dry_run: true`; ele imprime as notas e sobe
   apenas um artefato de workflow.
3. Confira os dois assets na release.
4. Baixe ambos, confira o checksum e instale o ZIP no Spresenter de referência.

## Checklist de revisão trimestral

- [ ] Rulesets ainda apontam para os checks atuais (`Verify`).
- [ ] `ENABLE_GHAS` reflete o licenciamento disponível.
- [ ] Dependabot sem PRs travados há mais de duas semanas.
- [ ] Alertas de segurança e CodeQL zerados ou triados.
- [ ] Tag `v*` mais recente tem release com os dois assets.
