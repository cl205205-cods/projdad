# Decisão 0002 — Bandeja, menu nativo, ícone próprio e relatórios por perfil

- **Data:** 2026-11-24
- **Status:** aprovada
- **Aprovada por:** usuário
- **Agentes envolvidos:** orquestrador (proposta e implementação), usuário (decisão)

## Contexto

O aplicativo já tinha login, RBAC, CRUD de 9 entidades, mensalidades, avaliações, alertas de chuva/vencimento e as 4 APIs. Faltavam recursos de “aplicativo desktop de verdade”: presença na bandeja do sistema, menu nativo, ícone próprio e uma tela de relatórios que aproveitasse os dados reais por perfil. Também havia pontos de atrito na interface (sem indicador de carregamento, sem confirmação em ações em massa, sem atalhos e sem dicas nos formulários).

A regra do projeto é que decisão importante é decisão do usuário. Por isso, antes de implementar, foram apresentadas as escolhas abaixo.

## Opções consideradas

### 1. O que acontece ao fechar a janela

- **A. Ir para a bandeja (escolhida):** o app continua rodando e os alertas automáticos seguem ativos; sair exige uma ação explícita. Contra: o usuário pode achar que o app “não fechou”; mitigado por um aviso único na primeira vez.
- **B. Encerrar o app:** comportamento antigo; simples, mas perde o sentido de ter bandeja e interrompe os alertas.
- **C. Perguntar a cada fechamento:** mais controle, porém mais cliques em uma ação corriqueira.

### 2. Ícone do aplicativo

- **A. Desenhar no código (escolhida):** PNGs 16/32/48/64/128/256 + ICO gerados por `scripts/gerar-icone.ps1`, usando as cores e a identidade atuais. Sem dependência nova, tudo versionável.
- **B. Baixar um ícone pronto:** rápido, mas quebra a identidade e traz dúvida de licença.
- **C. Adicionar uma biblioteca de ícones:** mais uma dependência sem necessidade.
- **D. Não ter ícone próprio:** a janela e a bandeja usariam o ícone padrão do Electron.

### 3. Exportação dos relatórios

- **A. CSV gerado no main e salvo por `dialog.showSaveDialog` (escolhida):** respeita o isolamento do renderer, funciona offline e abre no Excel/LibreOffice. Contra: não é um PDF “bonito”.
- **B. Gerar no renderer e baixar pelo navegador:** simples, mas o renderer não deve receber os dados brutos para montar arquivo e o download dentro do Electron é menos previsível.
- **C. Adicionar uma biblioteca de PDF/Excel:** nova dependência e mais complexidade.
- **D. Não exportar:** deixa de atender ao pedido de “exportação quando compatível”.

### 4. Onde ficam os relatórios

- **A. Novo `RelatorioService` no main + tela própria com SVG (escolhida):** dados reais, permissão aplicada no backend, sem alterar o banco e sem dependência nova.
- **B. Colocar tudo no `DashboardService`:** mistura responsabilidades e incha o painel.
- **C. Adicionar uma biblioteca de gráficos:** dependência nova e mais peso para um requisito que o SVG já atende.
- **D. Criar tabelas/colunas novas para relatórios:** alteraria o banco sem necessidade; os dados existentes bastam.

### 5. Menu nativo

- **A. Menu próprio com Arquivo, Exibir, Ferramentas e Ajuda (escolhida):** cada item executa uma ação existente, com atalhos.
- **B. Manter o menu padrão do Electron:** traz itens de desenvolvimento (DevTools) e não conversa com as telas.
- **C. Sem menu:** menos descoberta de recursos e sem atalhos.

## Decisão

1. Fechar a janela **vai para a bandeja**, com aviso único; sair só por **Arquivo → Sair**, `Ctrl+Q` ou menu da bandeja.
2. O **ícone é desenhado em código** (halter branco com faixa laranja sobre azul `#17325C`), nos formatos PNG e ICO.
3. A **exportação é CSV**, gerada no main e salva pelo diálogo nativo.
4. Os **relatórios** ficam em `RelatorioService`, com tela própria e gráficos SVG, sem dependência nova e sem alterar o banco.
5. O **menu nativo** segue o padrão Arquivo/Exibir/Ferramentas/Ajuda, sem itens vazios.

## Justificativa

As escolhas preservam o que já funciona, mantêm o renderer sem acesso a Node/rede e não adicionam dependências. A bandeja dá comportamento de aplicativo desktop e mantém os alertas vivos; o ícone próprio completa a identidade visual; o CSV atende à exportação com o menor risco; e os relatórios usam somente consultas de leitura nas tabelas existentes. Os gráficos em SVG evitam uma biblioteca nova e continuam acessíveis (descrição e legenda, não só cor).

## Requisito do professor afetado

- **Electron + TypeScript:** reforçado (bandeja, menu, ícone e novos arquivos `.ts`).
- **POO:** novo serviço em classe, com responsabilidade única.
- **Segurança/RBAC:** relatórios decididos pelo perfil da sessão no main; exportação passa pelo IPC e pelo diálogo nativo.
- **6+ tabelas, CRUD e 4 APIs:** preservados, sem alteração de schema ou de integrações.
- **Nenhum requisito é afastado.**

## O que foi implementado

- `src/main/services/RelatorioService.ts`: consultas reais para admin, recepção e instrutor; período de 3/6/12 meses; CSV com escape e proteção contra fórmulas.
- `src/main/ipc/IpcRouter.ts`: rotas `relatorios:obter` e `relatorios:exportar` (exigem login; o perfil vem da sessão) e callback de salvamento.
- `src/main/main.ts`: ícone, `setAppUserModelId`, instância única, bandeja, menu nativo, comandos `app:comando`, fechar → esconder, `before-quit` fechando o banco e saída de emergência.
- `src/preload/preload.ts` e `src/renderer/global.d.ts`: ouvinte `aoReceberComando`, registrado uma única vez.
- `src/renderer/views/RelatoriosView.ts`: filtro de período, KPIs, gráficos, tabela e exportação.
- `src/renderer/ui.ts`: gráficos de barras e rosca, formato de valor e melhorias de acessibilidade.
- `src/renderer/app.ts`: menu lateral em grupos, tela de carregamento, atalhos do Painel e comandos do menu nativo.
- `src/renderer/views/DashboardView.ts`: boas-vindas única, atalhos por perfil e previsão de chuva.
- `src/renderer/views/CrudView.ts`, `AlertasView.ts` e `ConfigView.ts`: dicas, placeholders, confirmações e textos de acessibilidade.
- `src/renderer/styles.css`: estilos de KPIs, gráficos, grupos de navegação, carregamento e boas-vindas.
- `assets/` e `scripts/gerar-icone.ps1`: ícones do app e script que os reproduz.
- `README.md`: seções de bandeja, menu, ícone, relatórios e limites.

## Como foi verificado

- `npm run typecheck` e `npm run build` sem erros.
- Teste de fumaça do Electron com dados de exemplo (janela oculta): ícones carregados nos tamanhos certos, bandeja criada, menu com os 4 títulos, 13 itens de navegação para admin, painel com 5 indicadores, boas-vindas na primeira visita e tela de Relatórios com 3 KPIs, 3 gráficos (linha, rosca e barras) e tabela.
- Teste revelou e corrigiu um problema real: a espera por `requestAnimationFrame` podia travar a tela em “Carregando…” com a janela na bandeja; foi trocada por uma espera segura.
- Cenários manuais pendentes de MySQL real: conferir os números de cada perfil com dados do banco, exportar CSV e abrir no Excel, fechar/reabrir pela bandeja e sair pelo menu.

## Observações

- Sem `electron-builder`, os ícones de `assets/` precisam ser copiados manualmente no dia do empacotamento.
- O envio automático de avisos continua dependendo do app aberto — agora, também na bandeja.
- Nenhuma tabela, coluna, FK ou dependência foi criada ou alterada.
