# Configuração do GitHub

Estado real do repositório e das proteções que dependem da visibilidade e do
plano. Este documento existe para não prometer uma proteção que o GitHub não
oferece nem descrever uma que não esteja ativa.

O repositório é **público**. Com isso, os recursos que o plano gratuito reserva a
repositórios públicos passam a valer: rulesets, proteção de tag, relato privado
de vulnerabilidades, secret scanning e push protection.

## Proteções do repositório

| Item | Configuração |
|---|---|
| Ruleset `main` | pull request obrigatório, checks do CI verdes, histórico linear, conversas resolvidas, force push e deleção bloqueados |
| Proteção de tag `v*` | criação e atualização restritas ao mantenedor |
| Relato privado de vulnerabilidades | habilitado — `SECURITY.md` aponta para esse canal |
| Secret scanning | habilitado, com push protection |
| Dependabot alerts e security updates | habilitados |
| Actions fixadas por SHA | exigido pelo repositório |
| Token padrão do `GITHUB_TOKEN` | somente leitura |
| Actions podem aprovar pull requests | não |

Os checks exigidos no ruleset são os produzidos por `verify.yml`:

- `Verify / Checks (Node 22)`
- `Verify / Checks (Node 24)`
- `Verify / Build and package (Node 22)`

O SHA pinning é verificado pelo próprio GitHub: um `uses:` sem SHA completo passa
a falhar no workflow, não apenas na revisão.

## Estado verificado

Verificado em **2026-10-28**, depois da abertura do repositório.

| Item | Evidência |
|---|---|
| Visibilidade | `gh repo view`: `visibility PUBLIC`, `isPrivate false` |
| Discussions | `hasDiscussionsEnabled true` |
| Licença detectada | MIT |
| Ruleset `main protegido` | id `26058875`, `target branch`, `enforcement active`, `current_user_can_bypass never` |
| Ruleset `tags de release` | id `26058876`, `target tag`, `include refs/tags/v*`, regras `deletion` e `update` |
| Push direto em `main` | rejeitado: `push declined due to repository rule violations` e `3 of 3 required status checks are expected` |
| Relato privado de vulnerabilidades | `GET /private-vulnerability-reporting` → `{"enabled":true}` |
| Secret scanning | `security_and_analysis.secret_scanning.status` = `enabled` |
| Push protection | `security_and_analysis.secret_scanning_push_protection.status` = `enabled` |
| Download anônimo da release | ZIP da 1.3.1 baixado sem autenticação; SHA-256 `5e79b195…995043`, igual ao `.sha256` publicado |

`secret_scanning_non_provider_patterns` e `secret_scanning_validity_checks`
continuam `disabled`: são recursos pagos, não fazem parte do plano atual.

## CodeQL e dependency review

Com o repositório público, os dois passam a rodar de fato — o guard
`github.event.repository.private == false || vars.ENABLE_GHAS == 'true'` já
liberava o job para repositório público, mas em repositório privado faltava o
GitHub Code Security.

- `codeql.yml` analisa JavaScript/TypeScript em push para `main`, pull request e
  semanalmente.
- `dependency-review.yml` revisa o diff de dependências em pull request e falha
  em severidade alta.

Em um eventual retorno a repositório privado, habilite code scanning e defina a
variável de repositório `ENABLE_GHAS=true`
(Settings → Secrets and variables → Actions → Variables).

## Metadados do repositório

- Descrição: `Efeitos de luz ao vivo (Hit, Strobe, Pulse) para o Spresenter.`
- Tópicos: `spresenter`, `spresenter-plugin`, `lighting`, `live`, `typescript`,
  `church`, `projection`, `obs`.
- Labels usadas: `bug`, `enhancement`, `documentation`, `dependencies`,
  `good first issue`.

## Release

1. Envie a tag (`git push origin v1.3.1`): o workflow **Release** roda o gate,
   confere a tag e publica ZIP + `.sha256` automaticamente.
2. Para revalidar uma tag já existente sem tocar nos assets, use **Actions →
   Release → Run workflow** com `dry_run: true`; ele imprime as notas e sobe
   apenas um artefato de workflow.
3. Confira os dois assets na release.
4. Baixe ambos, confira o checksum e instale o ZIP no Spresenter de referência.

## Checklist de revisão trimestral

- [ ] Ruleset de `main` e proteção de `v*` seguem ativos.
- [ ] Relato privado de vulnerabilidades ainda habilitado.
- [ ] Secret scanning e push protection ativos.
- [ ] Dependabot sem PRs travados há mais de duas semanas.
- [ ] Alertas de segurança triados.
- [ ] Tag `v*` mais recente tem release com os dois assets.
- [ ] Actions ainda fixadas por SHA (o GitHub bloqueia, mas confira o histórico).
