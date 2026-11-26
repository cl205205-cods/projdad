# Gestão de Academia — instruções do projeto

Este é o projeto final da disciplina DAD: aplicativo desktop **Electron + TypeScript + MySQL** (driver `mysql2`, sem ORM). A versão oficial é esta pasta: `v5-final-avisos-de-vencimento`.

Leia também, antes de trabalhar:

- `docs/agentes/CONTEXTO-PROJETO.md` — arquitetura, tabelas, APIs e donos dos arquivos.
- `docs/agentes/PROTOCOLO-DECISOES.md` — como pedir uma decisão ao usuário.
- `docs/agentes/MAPA-REQUISITOS.md` — cada requisito do professor e onde comprová-lo.
- `docs/agentes/CHECKLIST-QUALIDADE.md` — o que precisa ser verificado antes de concluir.

## Regra inegociável: decisão importante é decisão do usuário

**Nenhum agente implementa uma decisão importante sozinho.** Antes de escrever código, pare e devolva um **pacote de decisão** ao orquestrador. O orquestrador é o único que fala com o usuário e só manda implementar depois da resposta.

É decisão importante:

- mudar o schema do banco (nova tabela, coluna, FK, índice, tipo de dado ou migração);
- adicionar ou trocar biblioteca/dependência;
- mudar validação, senha, token, sessão, RBAC, CSP, `contextIsolation`, `sandbox` ou IPC;
- mudar a arquitetura ou a organização dos serviços;
- mudar algo que já está pronto e funcionando, em vez de só adicionar algo novo;
- escolher entre duas ou mais formas razoáveis de resolver a mesma coisa;
- qualquer decisão que aproxime ou afaste o projeto de um requisito do professor (6+ tabelas com FK, CRUD completo, 4 APIs, segurança, POO, Electron+TypeScript).

O pacote de decisão deve ter: **contexto**, **2 a 4 opções**, **prós e contras de cada uma**, **custo/risco**, **recomendação** e **qual requisito do professor é afetado**. O modelo está em `docs/agentes/PROTOCOLO-DECISOES.md`.

**Nunca decida sozinho e avise depois.** Decida com o usuário, antes.

### Quem pergunta

- **Somente o agente `orquestrador`** usa a ferramenta de pergunta e conversa com o usuário.
- Os subagentes **não** usam `question` e **não** lançam outros subagentes. Eles devolvem o pacote de decisão ao orquestrador.
- O orquestrador consolida, pergunta uma decisão por vez, com opções e recomendação, e espera a resposta.

### O que não precisa de pergunta

Decisões pequenas e reversíveis **dentro de uma tarefa já aprovada** (nome de variável, formatação, ordem de parâmetros, texto de uma mensagem que não muda regra) podem seguir. Mesmo assim, devem ser listadas no relatório final.

## Idioma e explicação

Todo agente explica em **português simples**: o que fez, por que fez, qual era a alternativa, o que muda para o usuário e qual requisito do professor é afetado. Sem jargão sem explicação. O código é o trabalho de faculdade do usuário; ele precisa entender e saber defender cada decisão tomada com ajuda de IA.

## Fonte da verdade

- A versão oficial é esta pasta. A pasta antiga `academia-gestao` em `Documentos` é uma cópia anterior e **não** deve ser usada como referência.
- O código de lógica fica em `src/` e é **somente TypeScript**. Não crie `.js` de lógica em `src/`; os `.js` de `dist/` são gerados pelo build.
- Não edite `dist/`, `node_modules/` nem `.env`. O `.env` é secreto e local; use `.env.example` como modelo.
- O renderer não acessa Node, banco nem rede. Toda operação passa pelo IPC e é validada no main.

## Donos dos arquivos

| Área | Dono | Arquivos principais |
|---|---|---|
| Banco de dados | `banco-de-dados` | `src/main/conexao.ts`, `src/main/database/**`, `sql/**`, metadados de campos em `src/shared/entities.ts` |
| Segurança | `seguranca` | `src/main/security/**`, `AuthService.ts`, RBAC em `src/shared/entities.ts`, hardening em `main.ts`, `preload.ts` e CSP em `index.html` |
| Integrações externas | `integracoes` | `CepService.ts`, `FeriadoService.ts`, `ClimaService.ts`, `HttpClient.ts`, `MensagemService.ts`, `ConfigService.ts`, APIs novas |
| Regras de negócio | `regras-negocio` | `CrudService.ts`, `PagamentoService.ts`, `AvaliacaoService.ts`, `DashboardService.ts`, `AlertaService.ts`, `src/shared/dates.ts` |
| Comunicação IPC | `ipc` | `src/main/ipc/**`, `src/preload/**`, montagem/origem/links em `main.ts`, `src/shared/types.ts` |
| Interface | `interface` | `src/renderer/**` |
| Qualidade | `qualidade` | `docs/qualidade/**`, `tests/**` (somente quando aprovado); código de produção é somente leitura |
| Documentação | `documentacao` | `README.md`, `docs/**`, `AGENTS.md`; comentários no código são propostos ao dono do arquivo |
| Orquestração | `orquestrador` | Nenhum arquivo de código; decompõe, distribui, acompanha e fala com o usuário |

Quando uma tarefa precisar de dois donos, o orquestrador define a ordem e o ponto de integração. Ninguém edita o arquivo do outro sem combinar antes.

## Comandos do projeto

```bash
npm install
npm run typecheck
npm run build
npm start
```

Não há testes automatizados nem script `test` hoje. O agente `qualidade` usa o checklist manual e os smoke tests das APIs. **Não adicione dependências novas** (Vitest, Playwright etc.) sem aprovação explícita do usuário.

## Qualidade antes de concluir

Nenhuma tarefa é considerada concluída sem o parecer do agente `qualidade`. Ele verifica o que mudou, roda `npm run typecheck`, `npm run build` e os cenários manuais relevantes, e reporta falhas com passos para reproduzir. Se uma verificação falhar, o orquestrador devolve a tarefa ao dono do arquivo.

## Segredos e LGPD

- Nunca leia, imprima ou grave `.env`, tokens ou senhas.
- O token do Telegram é segredo: fica no `.env` ou cifrado no banco com `safeStorage`, e nunca volta para o renderer.
- Avaliações físicas são dados de saúde; CPF é dado pessoal. Só quem tem permissão acessa, e as telas não devem expor esses dados sem necessidade.
