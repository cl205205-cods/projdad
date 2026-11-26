# Gestão de Academia — Projeto Final DAD

Aplicação desktop (Electron + TypeScript + MySQL) para uma academia de bairro: alunos, planos, matrículas, mensalidades, instrutores, aulas, avaliações físicas, aviso de chuva para aulas ao ar livre e aviso de plano perto de vencer.

## Como rodar

```bash
npm install
cp .env.example .env     # preencha com as SUAS credenciais do MySQL do laboratório
npm start                # compila (tsc + esbuild) e abre o app
npm run typecheck
```

O `.env` segue o formato da Aula 1 (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) e **não vai para o Git**. É preciso estar na rede da escola (ou VPN) para alcançar o servidor `143.106.241.4`.

Ao abrir, o `main` testa a conexão (`conexao.connect`) antes de criar a janela; se falhar, aparece um `dialog.showErrorBox`. Em seguida o app cria as tabelas que faltarem (`CREATE TABLE IF NOT EXISTS`, o mesmo que `sql/schema.sql`) e carrega o catálogo inicial uma única vez: modalidades (Musculação, Funcional, Dança) e planos (Mensal, Trimestral, Anual; valores de exemplo, edite em **Planos**).

No primeiro acesso o app pede para criar o administrador. Não existe senha padrão.

## Bandeja, menu nativo e ícone

- **Bandeja do sistema**: o app fica em execução na bandeja (área de notificação do Windows). O clique esquerdo abre/restaura a janela; o clique direito abre o menu **Abrir aplicativo**, **Minimizar aplicativo**, **Configurações** e **Sair**. Fechar a janela pelo X **não encerra** o programa: ele continua na bandeja (um aviso único explica isso na primeira vez). Para encerrar de verdade, use **Arquivo → Sair**, `Ctrl+Q` ou **Sair** no menu da bandeja.
- **Menu nativo** (`Menu.setApplicationMenu`): **Arquivo** (abrir janela, configurações, sair), **Exibir** (atualizar conteúdo, recarregar interface, tela cheia), **Ferramentas** (atalhos para Painel, Relatórios, Alunos, Matrículas, Pagamentos, Avaliações e Clima/avisos) e **Ajuda** (sobre, atalhos, versão e README). Nenhum item é decorativo: todos abrem uma tela ou executam uma ação real.
- **Atalhos**: `Ctrl+Shift+A` abre/restaura a janela, `Ctrl+,` abre Configurações, `F5` atualiza a tela atual, `Ctrl+R` recarrega a interface, `F11` alterna tela cheia e `Ctrl+Q` encerra.
- **Ícone único** em `assets/`: `icon.png` (janela e barra de tarefas), `icon-16/32/48/64/128/256.png` (tamanhos) e `icon.ico` (Windows). A bandeja usa `icon-32.png`. As imagens foram desenhadas em código (halter branco com faixa laranja sobre o azul `#17325C` do sistema), sem biblioteca externa; `scripts/gerar-icone.ps1` reproduz os arquivos se precisar.
- **Uma instância só**: abrir o app de novo apenas traz a janela existente, evitando alertas e avisos duplicados.

## Relatórios por perfil

A tela **Relatórios** monta os números no processo main, a partir do MySQL, e escolhe o conteúdo pelo perfil logado — o renderer não informa o perfil nem envia dados:

| Perfil | O que vê |
|---|---|
| **Administrador** | Receita recebida no período, mensalidades em atraso (quantidade e valor), ticket médio, alunos e matrículas ativas; receita mês a mês, recebido por forma de pagamento (rosca) e matrículas ativas por plano; tabela das mensalidades em atraso. |
| **Recepção** | Novos alunos e novas matrículas, recebido no período, mensalidades pendentes e alunos ativos; novos alunos por mês, mensalidades por situação (rosca) e aulas por modalidade; tabela dos planos que vencem em até `diasAvisoVencimento` dias. |
| **Instrutor** | Aulas por semana, modalidades, avaliações físicas no período e alunos ativos; aulas por modalidade, aulas por dia da semana e avaliações por mês; grade de aulas da semana. **Sem valores financeiros e sem dados de saúde individuais** (apenas contagens). |

- Filtro de período: **3, 6 ou 12 meses** (qualquer outro valor é recusado e cai no padrão de 6).
- Gráficos em **SVG**, sem biblioteca: linha, barras e rosca, com descrição acessível (`aria-label`) e legenda textual — a leitura não depende só da cor.
- **Exportar CSV**: o main gera o conteúdo, abre o diálogo nativo “Salvar como” e grava com BOM (acentos corretos no Excel). Células com `;`, aspas ou quebra de linha são escapadas; textos que começam com `=`, `+`, `-` ou `@` recebem apóstrofo para não virarem fórmula.

## Interface e acessibilidade

- **Troca de tela**: esqueleto de carregamento (blocos neutros) com `aria-busy`, transição curta de opacidade/posição e foco levado ao título — teclado e leitor de tela percebem a mudança.
- **Painel acionável**: cada número do placar é um botão que abre a tela relacionada (Alunos, Matrículas, Pagamentos, Relatórios ou Clima e avisos), respeitando o perfil.
- **Tabelas**: zebra, destaque da linha sob o cursor, contagem (“N de M registros”) e estado vazio com ação (“Cadastrar …” ou “Limpar busca”). A busca espera o usuário parar de digitar antes de redesenhar.
- **Formulários**: diálogo com rodapé fixo, botão **Salvando…** durante o envio, erro por campo ligado ao campo (`aria-describedby`/`aria-invalid`) e destaque do endereço preenchido pelo ViaCEP.
- **Avisos**: toasts com ícone, botão fechar e `role="alert"` nos erros.
- **APIs externas**: “Consultando…”, hora da última consulta, mensagem honesta quando a rede falha e botão **Tentar de novo**; o Telegram deixa explícito quando o envio é **simulado**.
- **Contraste e foco**: botão primário e anel de foco corrigidos para os mínimos de acessibilidade (4,5:1 e 3:1). Toda animação usa apenas `opacity`/`transform` e é desligada quando o sistema pede **menos movimento** (`prefers-reduced-motion`).
- **Animações de atenção**: entrada curta do placar e dos KPIs, dois pulsos leves nos números de vencimento/atraso e fade das primeiras linhas da tabela na primeira carga — nada pisca para sempre e a busca não reanima.
- **Sem dependência nova**: tudo em `src/renderer/**`, com SVG e CSS puros; o renderer continua sem Node, rede ou `innerHTML`.

## Banco de dados (formato da aula)

| Peça | Onde |
|---|---|
| Driver `mysql2` + `dotenv` | `package.json` |
| Conexão única, só no Main | `src/main/conexao.ts` (cria a conexão a partir do `.env` e a exporta) |
| Teste de conexão + `showErrorBox` | `testarConexaoBanco()` em `src/main/main.ts` |
| `conexao.query` dentro de `new Promise` (resolve/reject) | `Database.rodar()` em `src/main/database/Database.ts`; o resto do código usa `async/await` |
| Consultas sempre parametrizadas (`?`) | `EntityRepository` e serviços |

Detalhes: `dateStrings` e `decimalNumbers` fazem DATE e DECIMAL chegarem como texto `AAAA-MM-DD` e número. Se a conexão cair (ex.: notebook em repouso), o `Database` reconecta sozinho e repete o comando uma vez.

## Requisitos do professor → onde estão

| Requisito | Atendimento |
|---|---|
| ≥ 6 tabelas com FK | 11 tabelas MySQL/InnoDB em `src/main/database/schema.ts` (espelho em `sql/schema.sql`): usuarios, alunos, planos, matriculas, pagamentos, instrutores, modalidades, aulas, avaliacoes_fisicas, avisos, configuracoes. FKs reais, com `ON DELETE` pensado por relação (CASCADE para dados do aluno; RESTRICT para plano, modalidade e instrutor em uso). |
| CRUD completo de todas as entidades | 9 entidades (alunos, instrutores, modalidades, planos, matrículas, pagamentos, aulas, avaliações, usuários) com listar/criar/editar/excluir. `EntityRepository` + `CrudService` no main, `CrudView` no renderer, tudo dirigido por `src/shared/entities.ts`. |
| 4 consumos de API | Ver tabela abaixo. |
| Segurança | Ver seção abaixo. |
| Classes (POO) | Toda a lógica está em classes: `Database`, `EntityRepository`, `CrudService`, `AuthService`, `PagamentoService`, `AlertaService`, `Agendador`, `IpcRouter`, `HttpClient`, etc. |
| Electron + TypeScript | Só há `.ts` em `src/`. Os `.js` em `dist/` são gerados pelo build e não vão para o Git. |

## As 4 APIs

| # | API | Onde | Para quê |
|---|---|---|---|
| 1 | Open-Meteo (previsão por hora) | `ClimaService` | Para cada aula ao ar livre nas próximas horas, calcula a chance de chuva no horário da aula. Se passar do limite configurado, gera alerta (notificação do sistema + aviso na tela) para remarcar para dentro. Roda ao abrir o app e a cada 30 min. |
| 2 | BrasilAPI (feriados nacionais) | `FeriadoService` | Move vencimentos de mensalidade que caem em fim de semana/feriado para o próximo dia útil e avisa quando uma aula cai em feriado. |
| 3 | ViaCEP | `CepService` | Preenche o endereço do aluno a partir do CEP. |
| 4 | Telegram Bot API | `MensagemService` | Envia ao aluno o aviso de que o plano vai vencer. Sem token configurado, o aviso é só registrado (modo simulado). Alternativa sem API: botão WhatsApp (link `wa.me`). |

Observação: as APIs 1 a 3 são consultas (GET); a 4 é um envio (POST) cuja resposta é gravada no histórico de avisos. Todas as chamadas saem do processo main; o renderer não tem acesso à rede (CSP `connect-src 'none'`).

Para ativar o Telegram:
1. No Telegram, fale com **@BotFather**, envie `/newbot` e siga as instruções. Ele te devolve um token no formato `123456789:AA...`.
2. Cole esse token em **Configurações → Mensagens pelo Telegram** e clique em "Salvar configurações". O selo muda para "Telegram configurado" e aparece o campo **Testar conexão**.
3. Para achar seu próprio `chat id` (ou o de um aluno): mande qualquer mensagem para o seu bot no Telegram, depois abra no navegador `https://api.telegram.org/bot<TOKEN>/getUpdates` (troque `<TOKEN>` pelo token do bot) — a resposta mostra `"chat":{"id": ...}` com o número certo.
4. Cole esse número em **Testar conexão** e clique em "Enviar mensagem de teste" para confirmar, na hora, que a conexão funciona.

**Atalho pelo `.env` (sem digitar na tela):** preencha `TELEGRAM_BOT_TOKEN` e, se quiser um destino único, `TELEGRAM_CHAT_ID_FIXO`. Na primeira abertura sem token salvo, o app **importa o token cifrado** para as configurações. O chat fixo **não vai para o banco**: é lido só do `.env`, então trocar ou apagar a linha vale na próxima abertura — sem a linha vale o padrão `7012239154` (`CHAT_FIXO_PADRAO` em `ConfigService.ts`); com a linha vazia (`TELEGRAM_CHAT_ID_FIXO=`), cada aluno recebe no próprio chat. A tela não muda: continua mostrando “Telegram configurado” e o campo de token vazio. O token do `.env` é a configuração **inicial**; depois disso, o que está salvo nas configurações manda — e remover o token na tela vale para a sessão.
5. Cadastre o `chat id` de cada aluno no cadastro dele (o aluno precisa ter mandado uma mensagem para o bot antes, para o Telegram liberar o chat).

## Decisões de segurança (para justificar na apresentação)

- **Senhas**: scrypt com salt aleatório por senha, comparação em tempo constante; política mínima (8+ caracteres, letras e números). Nenhuma senha padrão: o primeiro acesso cria o administrador.
- **Login**: mensagem de erro genérica (não revela se o e-mail existe) e bloqueio de 5 minutos após 5 falhas.
- **Controle de acesso (RBAC)**: perfis admin, recepção e instrutor (`PERMISSOES` em `entities.ts`). A regra é aplicada no processo main em cada chamada; esconder menu no renderer é só conveniência. Instrutor não vê dados financeiros; só admin gerencia usuários e configurações.
- **Validação**: toda entrada é validada e normalizada no main (`Validator`: CPF com dígito verificador, e-mail, datas, números com limites, opções fechadas). Campos desconhecidos são descartados.
- **Credenciais do banco**: só no `.env` (fora do Git, com `.env.example` de modelo). A conexão existe apenas no processo Main; o renderer nunca vê o banco.
- **SQL**: valores sempre por parâmetro (`?`); nomes de tabela/coluna vêm só de metadados fixos no código.
- **Dados sensíveis (LGPD)**: avaliações físicas são dados de saúde e só aparecem para quem tem permissão; CPF é mascarado nas listas; excluir um aluno apaga matrículas, pagamentos e avaliações (direito de eliminação), com confirmação.
- **Segredos**: o token do bot é cifrado com `safeStorage` do Electron (cofre do sistema) e nunca volta para a interface.
- **Hardening do Electron**: `contextIsolation`, `sandbox`, sem `nodeIntegration`, preload mínimo, CSP restritiva, navegação e novas janelas bloqueadas, permissões negadas, IPC aceita só a nossa página, abertura externa só para `wa.me`.
- **Erros**: o usuário recebe mensagens seguras; detalhes técnicos ficam só no log do processo main.
- A UI monta o DOM sem `innerHTML`, então texto vindo do banco nunca executa como HTML.

## Estrutura

```
src/shared/     metadados das entidades, permissões, datas, tipos (usado por main e renderer)
src/main/       conexao.ts, main.ts (janela, bandeja, menu, ícone), database/ (Database, schema, EntityRepository), services/*, security/*, ipc/IpcRouter
sql/            schema.sql (espelho do schema criado pelo app)
src/preload/    ponte mínima (contextBridge)
src/renderer/   index.html, styles.css, app.ts, ui.ts (componentes e gráficos SVG), views/* (TypeScript, empacotado pelo esbuild)
assets/         icon.png, icon-16/32/48/64/128/256.png e icon.ico
scripts/        gerar-icone.ps1 (recria os ícones sem dependência externa)
```

## Entrega no GitHub (exigências do professor)

1. Crie o repositório do grupo e adicione o usuário `willcotil` como colaborador **agora**, não só no final.
2. Cada integrante deve commitar com o próprio `git config user.name/email`. Faça commits pequenos por etapa (ex.: schema, CRUD, login/RBAC, cada API, UI).
3. Não suba `node_modules/`, `dist/` nem `*.db` (já estão no `.gitignore`).

## Limites conhecidos

- Precisa de acesso de rede ao MySQL do laboratório. Cada integrante usa o próprio `.env` (e, portanto, o próprio banco); as tabelas são criadas automaticamente em cada um.
- O envio automático de avisos só roda com o app aberto.
- O fuso das aulas é o do computador; as coordenadas do espaço externo estão em **Configurações** (padrão: centro de São Paulo, ajuste para a sua academia).
- Não há empacotamento (`electron-builder`) configurado; um app empacotado precisaria de um `.env` ao lado do executável.
- A bandeja mantém o app aberto: os alertas automáticos continuam rodando, mas o ícone precisa existir na máquina (pasta `assets/`). Em um app empacotado, os ícones precisam ser copiados para o pacote.
- O CSV usa ponto e vírgula como separador (padrão do Excel em português). Em outros programas, escolha “CSV separado por ponto e vírgula” na importação.
- Os relatórios usam os dados já cadastrados; sem movimento no período, os gráficos mostram “Sem dados no período” em vez de inventar números.
- Não há sistema de migração: os relatórios só leem colunas existentes, sem alterar o banco.
