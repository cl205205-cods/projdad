# Documentos dos agentes

Esta pasta reúne o contexto que os agentes leem antes de trabalhar.

| Documento | Para que serve |
|---|---|
| `CONTEXTO-PROJETO.md` | Arquitetura, stack, 11 tabelas, 9 entidades, 4 APIs, segurança e lacunas. |
| `PROTOCOLO-DECISOES.md` | Regra inegociável: como parar e pedir decisão ao usuário. |
| `MAPA-REQUISITOS.md` | Cada requisito do professor e onde comprová-lo na apresentação. |
| `CHECKLIST-QUALIDADE.md` | O que o agente de qualidade verifica antes de concluir. |

Documentos irmãos:

- `docs/decisoes/` — registro das decisões aprovadas (para a apresentação).
- `docs/qualidade/` — relatórios e evidências de verificação.

Os agentes ficam em `.opencode/agents/`. O agente padrão é o `orquestrador`; os outros oito são subagentes e não devem ser escolhidos diretamente pelo usuário.
