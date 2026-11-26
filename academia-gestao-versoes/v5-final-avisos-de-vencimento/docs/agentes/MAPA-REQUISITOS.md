# Mapa requisito do professor → código

Este mapa serve para o usuário **provar na apresentação** onde cada requisito está. O agente `documentacao` mantém este arquivo atualizado. Se uma mudança afetar um requisito, atualize a linha correspondente.

## Resumo

| Requisito | Status | Onde provar |
|---|---|---|
| Banco relacional com 6+ tabelas e FKs reais | Atendido (11 tabelas) | `src/main/database/schema.ts`, `sql/schema.sql` |
| CRUD completo (create/read/update/delete) de todas as entidades | Atendido (9 entidades) | `src/shared/entities.ts`, `CrudService`, `EntityRepository`, `CrudView` |
| 4 consumos de API com propósito real | Atendido (4) | `ClimaService`, `FeriadoService`, `CepService`, `MensagemService` |
| Segurança justificável | Atendido | `security/`, `AuthService`, RBAC, hardening em `main.ts`/`index.html` |
| Código modularizado em classes (POO) | Atendido | classes de serviço, repositório, router, aplicação |
| Electron + TypeScript, sem `.js` de lógica | Atendido | `src/` só `.ts`; build gera `dist/` |

## 1. Banco relacional com 6+ tabelas e FKs reais

**Onde:** `src/main/database/schema.ts` (DDL executado pelo app) e `sql/schema.sql` (espelho manual).

**Tabelas (11):** `usuarios`, `alunos`, `planos`, `instrutores`, `modalidades`, `matriculas`, `pagamentos`, `aulas`, `avaliacoes_fisicas`, `avisos`, `configuracoes`.

**FKs reais:**
- `matriculas.aluno_id → alunos.id` (CASCADE)
- `matriculas.plano_id → planos.id` (RESTRICT)
- `pagamentos.matricula_id → matriculas.id` (CASCADE)
- `aulas.modalidade_id → modalidades.id` (RESTRICT)
- `aulas.instrutor_id → instrutores.id` (RESTRICT)
- `avaliacoes_fisicas.aluno_id → alunos.id` (CASCADE)
- `avisos.aluno_id → alunos.id` (SET NULL)
- `avisos.aula_id → aulas.id` (SET NULL)

**Como explicar:** “O banco tem 11 tabelas. As FKs impedem pagamento sem matrícula, matrícula sem aluno/plano, aula sem modalidade/instrutor. O `ON DELETE` foi escolhido por relação: dados do aluno somem com ele (CASCADE), mas plano/modalidade/instrutor em uso são protegidos (RESTRICT).”

**Dono:** `banco-de-dados`.

## 2. CRUD completo de todas as entidades

**Entidades (9):** alunos, instrutores, modalidades, planos, matrículas, pagamentos, aulas, avaliações físicas e usuários.

**Onde:**
- Metadados: `src/shared/entities.ts` (`ENTITIES`).
- Regras/permissões: `src/main/services/CrudService.ts`.
- SQL genérico: `src/main/database/EntityRepository.ts`.
- Tela genérica: `src/renderer/views/CrudView.ts`.
- Rotas: `IpcRouter` (`crud:listar`, `crud:opcoes`, `crud:criar`, `crud:atualizar`, `crud:remover`).

**Como explicar:** “O CRUD é dirigido por metadados: a mesma tela e o mesmo repositório servem para as 9 entidades. O que muda é a definição dos campos em `entities.ts`. As regras específicas (matrícula, pagamento, usuário) ficam no `CrudService`.”

**Dono:** `regras-negocio` (regras) + `banco-de-dados` (persistência) + `interface` (tela).

## 3. Quatro consumos de API com propósito real

| # | API | Arquivo | Propósito | Falha/offline |
|---|---|---|---|---|
| 1 | Open-Meteo | `src/main/services/ClimaService.ts` | Previsão de chuva por hora para aulas ao ar livre; gera alerta para remarcar | Não gera alerta; app segue |
| 2 | BrasilAPI | `src/main/services/FeriadoService.ts` | Feriados nacionais; move vencimento para próximo dia útil; avisa aula em feriado | Cai para regra de fim de semana |
| 3 | ViaCEP | `src/main/services/CepService.ts` | Preenche endereço do aluno pelo CEP | Erro amigável |
| 4 | Telegram Bot API | `src/main/services/MensagemService.ts` | Envia aviso de vencimento e de chuva; teste de conexão | Modo simulado sem token |

**Evidências adicionais:**
- Rotas: `cep:buscar`, `alertas:chuva`, `alertas:enviar`, `alertas:enviarTodos`, `config:testarTelegram`.
- O link `wa.me` é alternativa sem API; **não** conta como a 4ª.
- `TELEGRAM_CHAT_ID_FIXO` permite mandar todos os avisos para um chat só, útil na demonstração.
- As chamadas saem do main; a CSP do renderer tem `connect-src 'none'`.

**Como explicar:** “São quatro situações diferentes: clima (previsão), calendário (feriados), endereço (CEP) e mensageria (Telegram). Cada uma resolve um problema real do sistema, não é uma chamada decorativa.”

**Dono:** `integracoes`.

## 4. Segurança justificável

| Medida | Onde |
|---|---|
| Senha com scrypt + salt + comparação em tempo constante | `src/main/security/PasswordHasher.ts` |
| Política de senha (8+, letras e números) | `PasswordHasher.politica` |
| Login genérico + bloqueio após 5 falhas | `src/main/services/AuthService.ts` |
| Sessão só na memória do main | `AuthService` |
| RBAC por perfil/entidade/ação | `src/shared/entities.ts` (`PERMISSOES`, `pode`), aplicado no `CrudService`/`IpcRouter` |
| Validação e normalização centralizadas | `src/main/security/Validator.ts` |
| SQL parametrizado | `EntityRepository`, serviços |
| Token cifrado com `safeStorage` | `ElectronSecretVault.ts`, `ConfigService.ts` |
| Electron hardening | `main.ts` (`contextIsolation`, `sandbox`, `nodeIntegration: false`, origem do IPC, links), `index.html` (CSP) |
| Erros seguros | `AppError.ts`, `IpcRouter.despachar` |
| DOM sem `innerHTML` com dados | `src/renderer/ui.ts`, views |
| LGPD | RBAC em avaliações, CPF mascarado, CASCADE no aluno |

**Como explicar:** “A segurança não é só a tela de login. O renderer não tem Node nem rede; o main valida tudo, aplica permissão, usa SQL parametrizado, guarda senha com scrypt e cifra o token no cofre do sistema.”

**Dono:** `seguranca`.

## 5. POO / classes

**Classes principais:**
- `Aplicacao` — inicialização do Electron (`main.ts`).
- `Database`, `EntityRepository` — acesso a dados.
- `AuthService`, `CrudService`, `PagamentoService`, `AvaliacaoService`, `DashboardService`, `AlertaService`, `Agendador`, `CepService`, `FeriadoService`, `ClimaService`, `MensagemService`, `ConfigService`, `HttpClient`.
- `Validator`, `PasswordHasher`, `ElectronSecretVault`.
- `IpcRouter`.
- `App`, `CrudView`, `LoginView`, `DashboardView`, `PagamentosView`, `AvaliacoesView`, `AlertasView`, `ConfigView`.

**Como explicar:** “Cada responsabilidade tem uma classe. Serviço não desenha tela; view não acessa banco; repositório não decide regra. Isso facilita testar e explicar.”

**Dono:** todos, com revisão do `orquestrador`.

## 6. Electron + TypeScript, sem `.js` de lógica

**Onde:** `src/**/*.ts` (main, preload, shared, renderer). O `build` gera `dist/` com `.js`; esses arquivos são artefatos e estão no `.gitignore`.

**Como explicar:** “O código-fonte é 100% TypeScript. O `.js` que aparece em `dist/` é o resultado do `tsc`/`esbuild`, não lógica escrita à mão.”

**Dono:** `ipc` (build/main) + `interface` (renderer).

## Pontos de atenção para a apresentação

- **Telegram real:** para demonstrar ao vivo, configure `TELEGRAM_BOT_TOKEN` e um `chat id` (ou `TELEGRAM_CHAT_ID_FIXO`). Sem token, o sistema mostra “simulado”, que é o fallback previsto.
- **MySQL:** o app precisa de um banco acessível e de um `.env` válido. Sem isso, o main mostra um `dialog` de erro antes de abrir a janela.
- **Sem testes automatizados:** isso não é requisito do professor, mas é uma lacuna técnica. A qualidade usa typecheck, build, checklist manual e smoke tests.
- **Sem Git:** a pasta não é um repositório. Se a entrega exigir GitHub, crie o repositório e faça commits pequenos (o README já orienta).
- **Cópia antiga:** não apresente `academia-gestao`; a versão oficial é `v5-final-avisos-de-vencimento`.
