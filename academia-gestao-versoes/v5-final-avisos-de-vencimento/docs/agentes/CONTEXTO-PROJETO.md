# Contexto do projeto — Gestão de Academia (v5 final)

## Identidade

- **Projeto:** Gestão de Academia — trabalho final da disciplina DAD (Desenvolvimento de Aplicações Desktop).
- **Pasta oficial:** `C:\Users\leand\OneDrive\Documentos\v5-final-avisos-de-vencimento`.
- **Cópia antiga:** `C:\Users\leand\OneDrive\Documentos\academia-gestao` é uma versão anterior; **não** use como fonte da verdade.
- **Objetivo:** aplicar Electron + TypeScript + MySQL com POO, CRUD completo, banco relacional com FKs reais, 4 consumos de API, segurança justificável e interface desktop.

## Stack

| Peça | Versão / escolha |
|---|---|
| Electron | `^45.2.1` |
| TypeScript | `~5.9.3`, `strict: true` |
| MySQL | driver `mysql2` `^3.24.6`, sem ORM |
| Ambiente | `dotenv` `^18.0.9`, arquivo `.env` na raiz |
| Build do renderer | `esbuild` `^0.28.2` |
| Fontes | `@fontsource/barlow` e `@fontsource/barlow-condensed` |

## Comandos

```bash
npm install
npm run typecheck   # tsc nos dois tsconfig, sem emitir
npm run build       # tsc do main/preload/shared + esbuild do renderer
npm start           # build + electron .
```

No Windows, para criar o `.env` a partir do modelo:

```powershell
Copy-Item .env.example .env
```

Depois preencha `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` e, se quiser testar o Telegram, `TELEGRAM_BOT_TOKEN` e/ou `TELEGRAM_CHAT_ID_FIXO`.

## Arquitetura

```text
renderer (interface, sem Node)
   │  window.api.invoke(canal, payload)
   ▼
preload.ts (contextBridge mínimo)
   │  ipcRenderer.invoke
   ▼
main.ts (janela, origem confiável, serviços, agendador)
   │
IpcRouter (tabela de rotas + permissão)
   │
serviços (Auth, Crud, Pagamento, Avaliação, Dashboard, Alerta, CEP, Feriado, Clima, Mensagem, Config)
   │
Database / EntityRepository (mysql2, SQL parametrizado)
   ▼
MySQL (11 tabelas, InnoDB, FKs reais)
```

O renderer **não** tem acesso a Node, banco ou rede. A CSP tem `connect-src 'none'`; toda chamada externa sai do main.

## Estrutura de pastas

```text
src/shared/            entities.ts (metadados + RBAC), types.ts, dates.ts
src/main/              conexao.ts, main.ts, AppError.ts
src/main/database/     schema.ts, Database.ts, EntityRepository.ts
src/main/security/     Validator.ts, PasswordHasher.ts, SecretVault.ts, ElectronSecretVault.ts
src/main/services/     Auth, Crud, Pagamento, Avaliacao, Dashboard, Relatorio, Alerta,
                       Cep, Feriado, Clima, Mensagem, Config, HttpClient
src/main/ipc/          IpcRouter.ts
src/preload/           preload.ts
src/renderer/          app.ts, api.ts, ui.ts (componentes e gráficos SVG), global.d.ts, index.html, styles.css, views/
assets/                icon.png, icon-16/32/48/64/128/256.png, icon.ico
scripts/               gerar-icone.ps1 (recria os ícones em PowerShell)
sql/                   schema.sql (espelho do DDL)
```

## Banco: 11 tabelas e FKs reais

| Tabela | Papel | FKs / relações |
|---|---|---|
| `usuarios` | Login, perfil e bloqueio por tentativas | — |
| `alunos` | Dados pessoais, endereço, Telegram | — |
| `planos` | Mensal, trimestral, anual | — |
| `instrutores` | Instrutores | — |
| `modalidades` | Musculação, Funcional, Dança etc. | — |
| `matriculas` | Liga aluno e plano | `aluno_id → alunos` (CASCADE), `plano_id → planos` (RESTRICT) |
| `pagamentos` | Mensalidades da matrícula | `matricula_id → matriculas` (CASCADE) |
| `aulas` | Aulas semanais | `modalidade_id → modalidades` (RESTRICT), `instrutor_id → instrutores` (RESTRICT) |
| `avaliacoes_fisicas` | Peso, medidas, gordura, IMC | `aluno_id → alunos` (CASCADE) |
| `avisos` | Histórico de alertas de chuva/vencimento | `aluno_id → alunos` (SET NULL), `aula_id → aulas` (SET NULL) |
| `configuracoes` | Chave/valor; inclui token cifrado | — |

O DDL fica em `src/main/database/schema.ts` e o espelho manual em `sql/schema.sql`. O app roda `CREATE TABLE IF NOT EXISTS` ao conectar. **Não há sistema de migração para alterar tabela existente**; isso precisa de decisão e plano.

## 9 entidades com CRUD

`alunos`, `instrutores`, `modalidades`, `planos`, `matriculas`, `pagamentos`, `aulas`, `avaliacoes` (tabela `avaliacoes_fisicas`) e `usuarios`.

Os metadados (campos, tipos, obrigatoriedade, opções, referências) ficam em `src/shared/entities.ts`. O `CrudService` aplica permissão e regras; o `EntityRepository` monta o SQL; o `CrudView` desenha o formulário e a tabela.

## As 4 APIs (requisito atendido)

| # | API | Arquivo | Propósito real | Sem internet / sem chave |
|---|---|---|---|---|
| 1 | Open-Meteo | `ClimaService.ts` | Previsão de chuva por hora para aulas ao ar livre | Não gera alerta; app continua |
| 2 | BrasilAPI | `FeriadoService.ts` | Feriados nacionais; move vencimento para próximo dia útil | Cai para regra de fim de semana |
| 3 | ViaCEP | `CepService.ts` | Preenche endereço do aluno pelo CEP | Mensagem amigável de erro |
| 4 | Telegram Bot API | `MensagemService.ts` | Envia aviso de vencimento e de chuva | Modo simulado se não houver token |

O botão de WhatsApp (`wa.me`) é uma alternativa **sem API**; não conta como a 4ª situação.

### Detalhe da v5: chat fixo do Telegram

Além do `telegram_chat_id` de cada aluno, a v5 aceita `TELEGRAM_CHAT_ID_FIXO` no `.env`. Quando definido, **todos** os avisos vão para esse chat — útil para demonstrar o envio sem cadastrar o chat de cada aluno. O aviso de chuva também é enviado para esse destino quando configurado. O modo simulado continua existindo quando não há token.

## Regras de negócio principais

- **Matrícula:** `data_fim = data_inicio + duracao_meses`; o formulário não envia `data_fim`.
- **Mensalidades:** ao criar matrícula, gera uma parcela por mês; se falhar, remove a matrícula. Vencimento em fim de semana/feriado vai para o próximo dia útil.
- **Cancelamento:** matrícula cancelada cancela mensalidades pendentes.
- **Pagamento:** só mensalidade pendente pode ser paga; forma validada.
- **Avaliação física:** IMC calculado com a última altura; dado de saúde.
- **Painel:** instrutor não vê financeiro.
- **Alertas:** rotina ao abrir e a cada 30 min; marca vencidas, verifica chuva e, se configurado, envia vencimentos.
- **Chuva:** só aulas ao ar livre de instrutor ativo, dentro da janela; `INSERT IGNORE` evita aviso duplicado.

## Segurança já implementada

- Senhas com **scrypt + salt aleatório + comparação em tempo constante**.
- Política mínima: 8+ caracteres, letras e números; sem senha padrão.
- Login com mensagem genérica e bloqueio de 5 minutos após 5 falhas.
- RBAC no main: admin, recepção, instrutor.
- Validação centralizada no main (`Validator`): CPF com dígito, e-mail, datas, números, opções fechadas; campos desconhecidos descartados.
- SQL sempre parametrizado; nomes de tabela/coluna só dos metadados.
- Token do Telegram cifrado com `safeStorage` (DPAPI/Keychain/libsecret) e nunca devolvido ao renderer. O `TELEGRAM_BOT_TOKEN` do `.env` é importado uma vez para `configuracoes` (token cifrado) e depois a configuração salva tem prioridade; o `.env` fica como reserva. O `TELEGRAM_CHAT_ID_FIXO` é lido **só** do `.env` (não vai para o banco): trocar ou remover a linha vale na próxima abertura.
- Electron: `contextIsolation`, `sandbox`, sem `nodeIntegration`, CSP restritiva, navegação/janelas bloqueadas, permissões negadas, IPC só da própria página, links externos só `wa.me`.
- Erros técnicos só no log do main; UI recebe mensagem segura.
- DOM sem `innerHTML` com dados do banco.
- LGPD: avaliações são dados de saúde; CPF é dado pessoal; exclusão de aluno cascateia dados.

## Desktop: bandeja, menu, ícone e relatórios

- **Bandeja:** `Tray` único em `main.ts`, criado com `assets/icon-32.png`; clique esquerdo abre/restaura; menu direito com Abrir, Minimizar, Configurações e Sair. Fechar pelo X esconde a janela e mostra um aviso único; sair só por ação explícita.
- **Menu nativo:** Arquivo, Exibir, Ferramentas e Ajuda; envia comandos `app:comando` (`navegar:<id>` e `atualizar`) ao renderer pelo preload.
- **Instância única:** `requestSingleInstanceLock`; abrir de novo só traz a janela existente.
- **Ícone:** `assets/icon.png` (janela/taskbar), `icon-32.png` (bandeja), PNGs menores e `icon.ico`; reproduzíveis por `scripts/gerar-icone.ps1`.
- **Relatórios:** `RelatorioService` monta, no main, um relatório diferente por perfil (admin financeiro; recepção atendimento; instrutor aulas/avaliações sem dinheiro). Rotas `relatorios:obter` e `relatorios:exportar`; o perfil vem da sessão, nunca do renderer. CSV gerado no main e salvo por `dialog.showSaveDialog`.
- **Interface:** `RelatoriosView` com filtro 3/6/12 meses, KPIs, gráficos de linha/barras/rosca em SVG e tabela; menu lateral em grupos; atalhos no Painel; boas-vindas única; tooltips e confirmações em ações importantes.
- **Interface dinâmica (decisão 0003):** esqueleto + transição de página com foco no título; placar acionável por perfil; tabelas com zebra, contagem e vazio com ação; busca com debounce; diálogo com rodapé fixo e “Salvando…”; toasts com fechar e `role="alert"`; estados honestos das APIs com “Tentar de novo”; contraste e foco corrigidos; movimento desligado em `prefers-reduced-motion`. Nenhuma dependência, rota IPC ou mudança de banco.
- **Animações discretas (decisão 0004):** entrada do placar/KPIs, dois pulsos nos números de atenção e fade das primeiras linhas da tabela na primeira carga; só `opacity`/`transform` e desligadas em `prefers-reduced-motion`.

## Lacunas e limites conhecidos

- **Não há testes automatizados nem script `test`.** A qualidade começa com typecheck, build, checklist manual e smoke tests das APIs. Adicionar Vitest/Playwright é decisão separada.
- **Não há repositório Git inicializado** nesta pasta.
- As dependências ficam em `node_modules/` (instaladas com `npm install`) e o `dist/` é gerado pelo build; nenhum dos dois vai para o Git. O `.env` é local e secreto.
- Precisa de acesso ao MySQL do laboratório (ou um MySQL local) para rodar de verdade.
- Telegram real precisa de token de bot; sem token, o modo é simulado.
- O envio automático só roda com o app aberto.
- Não há `electron-builder` configurado.

## Donos dos arquivos

Consulte a tabela em `AGENTS.md`. Em resumo: banco (`schema`, `Database`, `EntityRepository`, `sql`), segurança (`security`, `AuthService`, RBAC, hardening), integrações (`Cep`, `Feriado`, `Clima`, `HttpClient`, `Mensagem`, `Config`), regras (`Crud`, `Pagamento`, `Avaliacao`, `Dashboard`, `Alerta`, `dates`), IPC (`IpcRouter`, `preload`, `main`, `types`), interface (`renderer/**`), qualidade (`docs/qualidade`, `tests`), documentação (`README`, `docs`, `AGENTS`).
