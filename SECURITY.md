# Política de segurança

## Versões suportadas

A versão mais recente da série 1.x recebe correções de segurança.

## Como relatar uma vulnerabilidade

Não abra uma issue pública. Use o
[relato privado de vulnerabilidades do GitHub](https://github.com/ariellaureanorosas/spresenter-pulse-fx/security/advisories/new)
para enviar os detalhes de forma confidencial. Se esse recurso não estiver
disponível, envie um e-mail para **ariellaureanorosas@gmail.com** com o assunto
`[Pulse FX] Relato de segurança`.

Inclua, se possível:

- versão do Pulse FX e do Spresenter;
- sistema operacional e saída utilizada;
- passos para reproduzir;
- impacto observado;
- qualquer evidência, log ou prova de conceito.

O recebimento será confirmado assim que possível. A correção e a divulgação
serão coordenadas antes de qualquer publicação.

## Escopo

O Pulse FX não coleta telemetria, não faz requisições de rede próprias e não
armazena credenciais. Ele usa somente as APIs documentadas do Spresenter, com
as permissões `outputs:read`, `live:read` e `live:write`.

Relatos sobre o aplicativo Spresenter, o SDK oficial ou serviços de terceiros
devem ser encaminhados aos mantenedores desses projetos.
