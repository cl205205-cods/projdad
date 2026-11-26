# Decisão 0003 — Polimento dinâmico da interface

- **Data:** 2026-11-24
- **Status:** aprovada
- **Aprovada por:** usuário
- **Agentes envolvidos:** orquestrador (proposta e implementação), interface, qualidade, segurança, ipc, regras-negocio, integracoes, banco-de-dados e documentacao (pareceres)

## Contexto

O app já tinha bandeja, menu nativo, ícone próprio, relatórios por perfil, login, RBAC, CRUD de 9 entidades, mensalidades, avaliações e as 4 APIs. A interface, porém, era estática: cada troca de tela mostrava apenas a frase “Carregando…”, os números do painel não levavam a lugar nenhum, tabelas vazias não ofereciam ação, formulários não mostravam “Salvando…” e havia dois problemas reais de acessibilidade:

- botão primário branco sobre laranja `#E8590C`: **3,58:1** (mínimo 4,5:1);
- anel de foco `#F6A56E`: **2,00:1** sobre branco e **1,64:1** sobre o fundo claro (mínimo 3:1).

O usuário pediu uma interface “mais dinâmica”, mantendo o que já funciona, sem dependências novas e sem alterar banco, IPC ou CSP.

## Opções consideradas

- **A. Polimento dinâmico (escolhida):** esqueleto de carregamento, transição de página, placar clicável, tabelas com estado e contagem, diálogo com rodapé fixo e “Salvando…”, toasts com botão fechar, microtransições, estados honestos das APIs e correção dos contrastes. Tudo em `src/renderer/**`. Custo médio, risco baixo.
- **B. A + tema claro/escuro + preferências:** sensação de “app novo”, porém exige auditar contraste nas duas paletas, ajustar cores dos gráficos, impressão e o “flash” inicial. Custo médio-alto, risco médio.
- **C. A + B + paleta de comandos (Ctrl+K) + impressão:** máximo de dinamismo, mas muitas superfícies novas para testar e risco de exagero para um sistema de gestão. Custo alto, risco médio-alto.
- **D. Mínimo seguro:** só contraste, microtransições, zebra e fechar toast. Rápido, mas pouco visível para o pedido.

## Decisão

**Opção A — polimento dinâmico**, sem tema escuro, sem paleta de comandos, sem biblioteca nova, sem rota IPC nova, sem mudança de banco, CSP ou regra de negócio. Tema escuro fica como possível segunda etapa.

## Justificativa

A opção A entrega o maior ganho percebido por unidade de risco: mexe apenas na camada visual, corrige falhas reais de acessibilidade, mantém o renderer isolado (sem Node/rede) e pode ser verificada em uma única rodada de `typecheck`, `build` e teste de fumaça. Também evita a armadilha de “escurecer para parecer moderno”, que pioraria o contraste já no limite.

## Requisito do professor afetado

- **Electron + TypeScript:** reforçado — mais recursos de desktop e código `.ts` estrito.
- **Segurança/acessibilidade:** melhorada — contraste, foco visível, foco no título ao trocar de tela, `role="alert"`, respeito a `prefers-reduced-motion`.
- **6+ tabelas, CRUD completo, 4 APIs e POO:** preservados sem alteração.
- **Nenhum requisito é afastado.**

## O que foi implementado

- `src/renderer/ui.ts`
  - `toast` com ícone, texto, botão **fechar** e `role="alert"` em erros (anunciado por leitor de tela).
  - `abrirDialogo` com corpo rolável e **ações fixas no rodapé**.
  - `esqueleto()`: blocos neutros de carregamento.
- `src/renderer/app.ts`
  - troca de tela com **esqueleto** e `aria-busy`, em vez de só “Carregando…”;
  - classe `entrando` para transição curta de `opacity`/`transform`;
  - foco no `<h1 tabindex="-1">` ao trocar de tela (leitor de tela e teclado);
  - menu lateral em grupos com `role="group"` e `aria-label`.
- `src/renderer/views/DashboardView.ts`
  - **placar acionável**: cada número vira botão que abre a tela relacionada, respeitando o perfil;
  - detalhe secundário (valor em atraso, “na janela de aviso”) sem esconder o número principal;
  - previsão de chuva com `aria-busy`, hora da consulta e botão **“Tentar de novo”** em caso de erro.
- `src/renderer/views/CrudView.ts`
  - busca com **debounce** de 140 ms (não redesenha a tabela a cada tecla);
  - estado vazio com ação (“Cadastrar …” ou “Limpar busca”);
  - contagem “N de M registros” no rodapé da tabela;
  - formulário com botão **Salvando…**, erros por campo ligados por `aria-describedby`/`aria-invalid` e destaque do que veio do ViaCEP.
- `src/renderer/views/PagamentosView.ts`, `ConfigView.ts` e `AlertasView.ts`
  - botões com estado ocupado (“Registrando…”, “Enviando…”, “Consultando…”) e liberação no `finally`, inclusive no envio individual de aviso (evita mensagem duplicada em duplo clique);
  - aviso explícito de que, sem token, o Telegram fica **simulado** (registrado no histórico, não enviado);
  - “Verificar agora” mostra a hora da última consulta e oferece nova tentativa.
- `src/renderer/views/LoginView.ts`: botão desabilitado durante o envio, erro com `role="alert"`.
- `src/renderer/index.html`: `#avisos` deixou de ser uma região viva fixa; cada toast anuncia pelo próprio `role` (evita anúncio duplicado).
- `src/renderer/views/RelatoriosView.ts`: `aria-busy` enquanto carrega.
- `src/renderer/styles.css`
  - **contraste corrigido**: botão primário usa `--fita-escura` (`#B94306`, 5,43:1) e o anel de foco usa o token `--foco` (`#E04D0A`), validado sobre branco (4,01:1), concreto (3,30:1) e o azul do menu (3,18:1);
  - diálogo só vira `display: flex` quando está `[open]`, eliminando o “flash” de um diálogo fechado no canto da tela;
  - esqueleto com animação de opacidade apenas em `prefers-reduced-motion: no-preference`;
  - zebra e destaque de linha nas tabelas; foco visível no placar;
  - toasts com ícone e botão fechar (alvo de 24 × 24 px); diálogo com rodapé fixo;
  - bloco `prefers-reduced-motion: reduce` desliga todas as transições/animações.

## Como foi verificado

- `npm run typecheck` sem erros.
- `npm run build` sem erros (app.js 69,2 kB; CSS incluído).
- Teste de fumaça do Electron com dados de exemplo: 13 itens de navegação para admin, 6 grupos, 5 indicadores no painel, boas-vindas, relatórios com 3 KPIs e 3 gráficos (linha, rosca e barras), **0 erro no console**.
- Verificação do agente `qualidade` com Electron offscreen e medições reais: esqueleto → conteúdo, foco no `h1`, 13 itens/6 grupos, placar 5/5 no admin e 3 no instrutor, **3 cliques em salvar = 1 chamada**, `aria-invalid` + `aria-describedby`, debounce (0 mutações em 80 ms, 2 em 330 ms), contraste do botão primário **5,43:1**, `prefers-reduced-motion` desligando giro/esqueleto/transição, 0 `innerHTML`, `localStorage` só com a flag `"1"`.
- Essa verificação encontrou e o dono corrigiu dois problemas: diálogo fechado ainda desenhado (`.dialogo[open]`) e anel de foco a 2,94:1 sobre o concreto (novo token `--foco` com 3,30:1 no concreto, 4,01:1 no branco e 3,18:1 no azul). Relatório em `docs/qualidade/0001-relatorio-decisao-0003.md`.
- Cenários manuais pendentes com MySQL real: percorrer as 10 telas por teclado, conferir o esqueleto em cada troca, testar “Tentar de novo” com a internet desligada e o envio simulado do Telegram.

## Observações e limites

- **Sem tema escuro nesta rodada.** Fica registrado como possibilidade futura; exigiria auditoria de contraste nas duas paletas, cores dos gráficos e impressão.
- Nenhuma dependência, tabela, coluna, FK, rota IPC, regra de negócio ou política de segurança foi adicionada ou alterada.
- `localStorage` continua usado apenas para a preferência “boas-vindas já vista”, sem nome, CPF, saúde ou dinheiro.
- Nada de `innerHTML`: todo texto continua entrando por `textContent` via `h()`.
