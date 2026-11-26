# Checklist de qualidade

O agente `qualidade` usa este checklist antes de declarar qualquer tarefa concluída. Ele **não corrige** código de produção; reporta ao orquestrador, que aciona o dono.

> **Sem dependências novas.** Não instale Vitest, Playwright, Jest ou similar sem aprovação explícita. Hoje a verificação é typecheck + build + checklist manual + smoke tests das APIs.

## 0. Preparação

- [ ] `npm install` executado (a pasta não tem `node_modules`).
- [ ] `.env` criado a partir de `.env.example` e preenchido.
- [ ] MySQL acessível (rede da escola/VPN ou MySQL local).
- [ ] Se for testar Telegram: token e chat id configurados.
- [ ] Registrar data, versão e ambiente no relatório.

## 1. Estático

- [ ] `npm run typecheck` passa sem erro.
- [ ] `npm run build` passa e gera `dist/`.
- [ ] `src/` não contém `.js` de lógica.
- [ ] `src/` não contém `innerHTML` com dado dinâmico.
- [ ] Não há segredo hardcoded (token, senha, chave).
- [ ] `schema.ts` e `sql/schema.sql` continuam espelhados (mesmas tabelas/colunas/FKs).
- [ ] Toda rota do `IpcRouter` tem permissão coerente:
  - abertas: `auth:status`, `auth:configurar`, `auth:entrar`, `auth:sair`;
  - gestão: `pagamentos:*`, `alertas:vencimentos`, `alertas:enviar`, `alertas:enviarTodos`, `alertas:whatsapp`, `avisos:listar`;
  - admin: `config:obter`, `config:salvar`, `config:testarTelegram`.
- [ ] CSP continua `connect-src 'none'`, `default-src 'none'`, `script-src 'self'`.
- [ ] `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`.
- [ ] Preload expõe só `invoke` e `aoReceberAlerta`.
- [ ] `origemConfiavel` e a lista fechada de links externos (`wa.me`) continuam ativas.

## 2. Funcional (manual)

### Primeiro acesso e login

- [ ] Com banco vazio, o app pede para criar o administrador.
- [ ] Não existe senha padrão.
- [ ] Login correto entra no sistema.
- [ ] Login errado mostra mensagem genérica (não revela se o e-mail existe).
- [ ] Após 5 falhas, bloqueia por 5 minutos.
- [ ] Logout volta para a tela de login.

### CRUD das 9 entidades

Para cada uma: listar, criar, editar, excluir e conferir a mensagem de erro quando um campo obrigatório falta.

- [ ] Alunos (CPF válido, CEP, Telegram).
- [ ] Instrutores.
- [ ] Modalidades.
- [ ] Planos (mensal, trimestral, anual).
- [ ] Matrículas (`data_fim` calculada; mensalidades geradas).
- [ ] Pagamentos (status, forma, data).
- [ ] Aulas (dia, hora, duração, ao ar livre).
- [ ] Avaliações físicas (peso, medidas, IMC).
- [ ] Usuários (perfil, senha, ativo; não pode excluir a si mesmo; sempre um admin ativo).

### Regras de negócio

- [ ] Matrícula trimestral gera 3 mensalidades com valores corretos.
- [ ] Vencimento em fim de semana/feriado vai para o próximo dia útil.
- [ ] Cancelar matrícula cancela mensalidades pendentes.
- [ ] Pagamento só é registrado se estiver pendente.
- [ ] Filtros de pagamento: todos, pendentes, atrasados, pagos.
- [ ] Painel mostra números coerentes; instrutor não vê financeiro.
- [ ] Avaliação física mostra evolução e IMC.

### Alertas

- [ ] Aula ao ar livre com previsão de chuva gera alerta e notificação.
- [ ] O mesmo alerta não é duplicado no mesmo dia.
- [ ] Vencimento próximo aparece na lista.
- [ ] Envio individual pelo Telegram (ou simulado).
- [ ] Envio em lote conta enviados/falhas/sem contato.
- [ ] Botão WhatsApp gera link `wa.me` com a mensagem.
- [ ] Histórico de avisos mostra canal/status/detalhe.
- [ ] Configurações: nome, coordenadas, limites, token, envio automático.

### RBAC

Testar com um usuário de cada perfil:

- [ ] **Admin:** tudo.
- [ ] **Recepção:** CRUD de alunos, matrículas e pagamentos; leitura de planos/instrutores/modalidades/aulas/avaliações; não gerencia usuários/configurações.
- [ ] **Instrutor:** leitura de alunos/aulas/modalidades/instrutores; CRUD de avaliações; sem financeiro, sem usuários/configurações.

## 3. APIs (smoke tests)

Executar no main ou em um terminal, sem expor token em log:

- [ ] ViaCEP: `https://viacep.com.br/ws/01001000/json/` retorna endereço; CEP inválido retorna erro amigável.
- [ ] BrasilAPI: `https://brasilapi.com.br/api/feriados/v1/2026` retorna lista; vencimento em feriado é movido.
- [ ] Open-Meteo: previsão para as coordenadas configuradas; offline não quebra o app.
- [ ] Telegram: `getMe` ou botão “Testar conexão” com token; sem token, modo simulado.
- [ ] WhatsApp: link gerado; não é chamada de API.

## 4. Segurança

- [ ] Token não aparece no renderer, em `localStorage`, no DOM ou em log.
- [ ] Senha nunca é gravada em texto puro; hash scrypt no banco.
- [ ] CPF é mascarado nas listas, quando aplicável.
- [ ] Avaliações físicas só aparecem para quem tem permissão.
- [ ] Rota fechada rejeita usuário sem sessão; rota de admin rejeita recepção/instrutor.
- [ ] SQL sempre com `?`; nenhuma entrada do usuário concatenada.
- [ ] Erros técnicos não vão para a UI.

## 5. Evidência e relatório

Salvar em `docs/qualidade/` um relatório com:

```text
Data:
Ambiente:
O que foi verificado:
Comandos rodados:
Resultado: PASSOU / FALHOU / NÃO VERIFICADO
Falhas (passos, esperado, obtido, severidade):
Agente que deve corrigir:
Riscos para a apresentação:
```

## 6. Critério de conclusão

Uma tarefa só é “concluída” quando:

1. o dono implementou;
2. `npm run typecheck` passa;
3. `npm run build` passa;
4. os cenários manuais afetados foram verificados;
5. o agente `qualidade` emitiu parecer;
6. o orquestrador relatou ao usuário o que mudou e o que ficou pendente.
