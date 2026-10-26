# Configuração do GitHub

Estado real do repositório e do que depende do plano e da visibilidade. Este
documento existe para não prometer uma proteção que o GitHub não oferece hoje.

## Limitação atual: repositório privado no plano gratuito

Em repositório **privado no plano gratuito**, o GitHub não oferece:

| Recurso | Resposta da API |
|---|---|
| Rulesets / proteção de branch | `403 Upgrade to GitHub Pro or make this repository public` |
| Proteção de tag | indisponível pelo mesmo motivo |
| Relato privado de vulnerabilidades | `404 Not Found` |

Portanto, neste repositório **não há bloqueio técnico de merge nem de tag**. As
garantias atuais são de processo:

- o CI (`verify.yml`) roda em todo push para `main` e em todo pull request;
- `release.yml` recusa tag fora de `main` e tag que não seja `v<manifest.version>`;
- `release.yml` reconstrói e confere o checksum antes de publicar;
- o merge é feito por PR, com o gate verde, por convenção do mantenedor.

Para ter bloqueio técnico, uma das duas opções:

1. **Tornar o repositório público** — habilita proteção de branch, de tag e
   relato privado no plano gratuito.
2. **Assinar GitHub Pro** — habilita os mesmos recursos mantendo o repositório
   privado.

Depois de habilitar, crie o ruleset de `main` exigindo os checks
`Verify / Checks (Node 22)`, `Verify / Checks (Node 24)` e
`Verify / Build and package (Node 22)`, com histórico linear, conversas
resolvidas e force push bloqueado. Para tags, restrinja criação e atualização de
`v*` ao mantenedor.

## Já habilitado

| Item | Estado |
|---|---|
| Dependabot alerts | ligado |
| Dependabot security updates | ligado |
| Actions fixadas por SHA (obrigatório) | ligado |
| Token padrão do `GITHUB_TOKEN` | somente leitura |
| Actions podem aprovar pull requests | não |

O SHA pinning é verificado pelo GitHub: um `uses:` sem SHA completo passa a
falhar no workflow, não apenas na revisão.

## CodeQL e dependency review

Os dois exigem **GitHub Code Security** (GHAS), que não está disponível neste
plano/visibilidade. Os workflows existem e são ignorados pelo guard
`github.event.repository.private == false || vars.ENABLE_GHAS == 'true'`.

Quando houver GHAS (Pro/Enterprise ou repositório público), habilite code
scanning e defina a variável de repositório `ENABLE_GHAS=true`
(Settings → Secrets and variables → Actions → Variables).

## Metadados do repositório

- Descrição: `Efeitos de luz ao vivo (Hit, Strobe, Pulse) para o Spresenter.`
- Tópicos: `spresenter`, `spresenter-plugin`, `lighting`, `live`, `typescript`.
- Labels usadas: `bug`, `enhancement`, `documentation`, `dependencies`,
  `good first issue`.

## Release

1. Envie a tag (`git push origin v1.1.0`): o workflow **Release** roda o gate,
   confere a tag e publica ZIP + `.sha256` automaticamente.
2. Para revalidar uma tag já existente sem tocar nos assets, use **Actions →
   Release → Run workflow** com `dry_run: true`; ele imprime as notas e sobe
   apenas um artefato de workflow.
3. Confira os dois assets na release.
4. Baixe ambos, confira o checksum e instale o ZIP no Spresenter de referência.

## Checklist de revisão trimestral

- [ ] Plano/visibilidade mudou? Se sim, aplicar ruleset e proteção de tag.
- [ ] `ENABLE_GHAS` reflete o licenciamento disponível.
- [ ] Dependabot sem PRs travados há mais de duas semanas.
- [ ] Alertas de segurança triados.
- [ ] Tag `v*` mais recente tem release com os dois assets.
- [ ] Actions ainda fixadas por SHA (o GitHub bloqueia, mas confira o histórico).
