# Decisão 0004 — Telegram vindo do `.env` e animações discretas

- **Data:** 2026-11-25
- **Status:** aprovada (com correções após parecer da qualidade)
- **Aprovada por:** usuário (pedido direto; opção A do chat fixo escolhida depois do parecer)
- **Agentes envolvidos:** orquestrador (proposta e implementação), interface (tentativa de animações, interrompida por limite de uso), qualidade (parecer: reprovado na 1ª rodada, verificação final pendente)

## Contexto

O usuário pediu duas coisas:

1. Aproveitar `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID_FIXO` do `.env` automaticamente nas configurações, **sem mudar a tela**.
2. Adicionar animações discretas para chamar atenção, sem exagero.

O código já lia as duas variáveis em tempo de execução (`ConfigService.token()` e `MensagemService.destinoFixo()`), mas os valores não ficavam gravados na tabela `configuracoes`. O botão “Remover token” não desligava o envio enquanto o `.env` existisse.

## Opções consideradas (token)

- **A. Manter só o `.env` em tempo de execução:** zero mudança, mas as configurações não guardam o valor e a remoção na tela não vale.
- **B. Importar uma vez, cifrado, e o banco passa a valer (escolhida):** na primeira execução sem token salvo, o `.env` é copiado para `configuracoes` com `safeStorage`. Depois disso, o que está salvo manda; o `.env` continua como reserva se o banco estiver vazio. Remover na tela funciona durante a sessão; ao reiniciar sem token no banco, o `.env` volta a semear.
- **C. `.env` sempre vence:** simples, mas a tela nunca consegue trocar ou remover o token.

O parecer da qualidade mostrou que **copiar o chat fixo para o banco** criava valor preso: trocar ou apagar `TELEGRAM_CHAT_ID_FIXO` não tinha efeito, e não havia campo na tela para corrigir. Por isso o chat fixo recebeu decisão separada.

## Opções consideradas (chat fixo)

- **A. Lido só do `.env` (escolhida pelo usuário):** não vai para o banco; trocar ou remover a linha vale na próxima abertura; sem a linha, cada aluno recebe no próprio chat.
- **B. Manter no banco e o `.env` sobrescrever quando mudar:** resolve a troca, mas não a remoção — o valor antigo ficaria preso.
- **C. Campo “Destino fixo” na tela:** controle total, mas muda a tela de Configurações, que o usuário pediu para não alterar.

## Decisão

- **Token:** **opção B**. Importação única, cifrada, sem sobrescrever o que o usuário salvou. Precedência: banco → `.env`.
- **Chat fixo:** **opção A**. `chatFixo()` lê **apenas** `TELEGRAM_CHAT_ID_FIXO`; `importarDoAmbiente()` não grava mais essa chave. Se houver linha antiga `telegram_chat_fixo` no banco, ela é **ignorada** — o `.env` é a fonte única. O destino continua valendo para avisos de vencimento **e** de chuva, porque o `MensagemService` embrulha o canal com `DestinoFixoCanal` somente nos envios normais.
- **Teste de conexão:** `MensagemService.testar()` passou a enviar direto pelo `TelegramCanal`, **sem** o embrulho do destino fixo. Antes, com destino fixo configurado, qualquer chat id digitado dava “enviado” — falso positivo que escondia um id errado. Agora o teste valida exatamente o que está no campo.
- **Nenhuma mudança visual na tela de Configurações**: o token continua sem voltar para o renderer e o campo continua vazio (“deixe vazio para manter”).
- **Animações:** três efeitos sóbrios, todos com `opacity`/`transform`, desligados em `prefers-reduced-motion: reduce`:
  1. entrada do placar do Painel e dos KPIs de Relatórios (fade + 6 px, 240–260 ms), apenas na montagem;
  2. dois pulsos de 450 ms nos números de “planos perto de vencer” e “mensalidades atrasadas”, e param;
  3. fade de 180 ms nas 12 primeiras linhas da tabela, só na primeira carga do CRUD (a busca não reanima).

## Justificativa

A importação do token deixa o `.env` como configuração inicial e o banco como fonte da verdade, sem duplicar lógica na tela nem expor o token. Manter o chat fixo só no ambiente remove o estado preso e deixa o comportamento previsível: a linha do `.env` é o que vale, sempre. As animações chamam atenção para o que é urgente (vencimento e atraso) sem piscar, sem deslocar layout e sem violar a preferência de menos movimento.

## Requisito do professor afetado

- **Segurança:** token continua cifrado e nunca volta ao renderer; a remoção passa a ter efeito real.
- **Electron + TypeScript:** mais integração com o ambiente e o cofre do sistema.
- **Acessibilidade:** animações desligáveis e sem dependência de cor.
- **6+ tabelas, CRUD, 4 APIs e POO:** preservados; nenhuma tabela nova.

## O que foi implementado

- `src/main/services/ConfigService.ts`
  - `carregar()` chama `importarDoAmbiente()`, que grava **só** `telegram_token_cifrado`, validando o formato e sem registrar o token em log.
  - `token()`: banco primeiro, `.env` como reserva; `tokenIgnorado` impede o `.env` de recolocar o token removido na mesma sessão.
  - `chatFixo()`: lê só `TELEGRAM_CHAT_ID_FIXO`, com validação de formato.
  - `salvar()`: marca `tokenNovo`/`tokenIgnorado` para a remoção e a troca valerem na hora.
- `src/main/services/MensagemService.ts`: `destinoFixo()` delega para `config.chatFixo()`; `testar()` usa o `TelegramCanal` direto.
- `src/renderer/styles.css`: bloco de animações discretas em `prefers-reduced-motion: no-preference`; regras antigas sem uso (`entrada-suave`, `entrada-linhas`) removidas para não sobrescreverem o pulso.
- `src/renderer/views/RelatoriosView.ts`: classe `entrando` nos KPIs só na primeira carga.
- `src/renderer/views/CrudView.ts`: classe `entrando` no `tbody` só na primeira carga.
- `.env.example`: modelo com as variáveis do banco e do Telegram (sem segredos).
- `README.md` e `docs/agentes/CONTEXTO-PROJETO.md`: comportamento documentado.

## Como foi verificado

- `npm run typecheck` e `npm run build` sem erros.
- Teste local com banco, cofre e HTTP simulados (valores fictícios, sem ler o `.env` real): **18 asserções, 0 falhas** — token cifrado e com prioridade do banco, remoção efetiva, chat fixo vindo do `.env` e **nunca gravado**, chat antigo no banco ignorado, chat inválido recusado, teste de conexão usando o chat digitado e envio normal respeitando o destino fixo.
- Smoke no Electron com dados falsos: placar/KPIs/tabela animam na primeira carga, a busca não reanima, `prefers-reduced-motion: reduce` desliga tudo; 0 erro de console.
- Smoke do app (menu, bandeja, relatórios): 0 falha.
- Pendente: teste com MySQL real (gravação na tabela `configuracoes` e envio pelo Telegram) e conferência visual em janela visível.

## Observações

- O token do `.env` é a configuração **inicial**. Se for removido na tela, a remoção vale enquanto o app estiver aberto; na próxima abertura, o `.env` volta a semear o token se a variável ainda estiver preenchida. A rotina de alertas (a cada 30 min) recarrega as configurações e pode regravar o valor cifrado no banco, mas a tela e os envios continuam respeitando a remoção durante a sessão.
- O chat fixo é lido **a cada envio** do ambiente: mudou o `.env` e reabriu o app, mudou o destino. Apagar a linha faz cada aluno voltar a receber no próprio chat.
- Nenhuma tabela, coluna, FK ou dependência nova. As chaves usadas são linhas da tabela `configuracoes` que já existia.
