# Política de segurança

## Versões suportadas

| Versão | Suporte |
|---|---|
| 1.x (mais recente) | Correções de segurança |
| < 1.0 | Não suportado |

## Como relatar uma vulnerabilidade

**Não abra uma issue pública.** Use o relato privado do GitHub:

1. Abra <https://github.com/ariellaureanorosas/spresenter-pulse-fx/security/advisories/new>
   (ou **Security → Report a vulnerability** no repositório).
2. Se preferir e-mail: **ariellaureanorosas@gmail.com**, com o assunto
   `[Pulse FX] Relato de segurança`.

O relato privado mantém a conversa invisível até a correção ser publicada, o que
protege quem ainda não atualizou.

Inclua, se possível:

- versão do Pulse FX e do Spresenter;
- sistema operacional e saída utilizada;
- passos para reproduzir;
- impacto observado;
- qualquer evidência, log ou prova de conceito.

## Expectativa de resposta

O recebimento é confirmado em até **7 dias úteis**. A correção e a divulgação
são coordenadas antes de qualquer publicação. Este é um projeto mantido em
regime de melhor esforço, sem SLA contratual.

## Escopo

O Pulse FX:

- não coleta telemetria;
- não faz requisições de rede próprias;
- não armazena credenciais;
- usa somente as APIs documentadas do Spresenter, com as permissões
  `outputs:read`, `live:read` e `live:write`;
- trata cor, token de render e texto de camada como entrada não confiável
  (sanitização testada em `tests/shared/overlay.test.ts`).

Relatos sobre o aplicativo Spresenter, o SDK oficial ou serviços de terceiros
devem ser encaminhados aos mantenedores desses projetos.

## Boas práticas para quem instala

- Baixe o ZIP apenas da release oficial e confira o SHA-256 publicado ao lado.
- Mantenha a trava de frequência ligada sempre que possível.
- Remova o overlay pelo painel antes de desinstalar o plugin.
