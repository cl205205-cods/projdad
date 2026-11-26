# Decisão 0001 — Decisões iniciais da estrutura de agentes

- **Data:** 2026-11-24
- **Status:** aprovada
- **Aprovada por:** usuário
- **Agentes envolvidos:** orquestrador (proposta), usuário (decisão)

## Contexto

O usuário pediu uma estrutura de agentes de IA para desenvolver e melhorar o projeto final da disciplina DAD. Antes de criar os agentes, era necessário confirmar o estado real do repositório, decidir o que fazer com a 4ª API, aprovar a divisão dos agentes, escolher a pasta oficial e definir como a qualidade começaria.

## Opções consideradas

### 4ª API

- **A. Manter o Telegram Bot API (escolhida):** zero retrabalho; o requisito das 4 APIs já está atendido; precisa de token para envio real, mas tem modo simulado.
- **B. Adicionar uma 5ª API (IBGE):** mais uma API sem chave, porém mais código e tempo; não era necessário.
- **C. Trocar o Telegram por outra API:** retrabalho sem ganho claro.
- **D. Remover o Telegram e ficar com 3:** abriria mão do requisito.

### Estrutura

- **A. Nove agentes como proposto (escolhida):** um orquestrador + oito especialistas, com donos de arquivo claros.
- **B. Ajustar a divisão:** o usuário não pediu ajustes.

### Pasta oficial

- **A. `academia-gestao`:** cópia anterior.
- **B. `v5-final-avisos-de-vencimento` (escolhida):** versão final, com `.env.example`, comentários didáticos e o recurso de chat fixo do Telegram.
- **C. Pasta atual vazia:** não teria acesso ao código real.

### Qualidade

- **A. Sem novas dependências (escolhida):** typecheck, build, checklist manual, smoke tests das APIs e matriz RBAC.
- **B. Adicionar Vitest agora:** nova dependência e mais setup; fica para uma decisão futura.

## Decisão

1. Manter o **Telegram Bot API** como a 4ª situação de consumo de API.
2. Criar **9 agentes**: 1 orquestrador + 8 especialistas (banco, segurança, integrações, regras de negócio, IPC, interface, qualidade e documentação).
3. Usar a pasta **`v5-final-avisos-de-vencimento`** como versão oficial.
4. Começar a qualidade **sem adicionar dependências**.

## Justificativa

O projeto já atende aos requisitos do professor; o maior risco seria mexer no que funciona sem necessidade. A estrutura de agentes separa responsabilidades e coloca o orquestrador como único ponto de contato. A pasta v5 é a versão final e mais completa. A qualidade sem dependências permite verificar o projeto imediatamente, sem alterar o `package.json`.

## Requisito do professor afetado

- 4 APIs: mantido o Telegram como 4ª.
- Segurança, CRUD, 6+ tabelas, POO e Electron+TypeScript: preservados.
- Nenhuma mudança de código nesta decisão; apenas a estrutura de agentes e documentos.

## O que foi implementado

- `AGENTS.md` com a regra inegociável e os donos dos arquivos.
- `.opencode/opencode.json` com o orquestrador como agente padrão.
- `.opencode/agents/` com os 9 agentes.
- `docs/agentes/` com contexto, protocolo, mapa de requisitos e checklist.
- `docs/decisoes/` com este registro.
- `docs/qualidade/` com o modelo de relatório.

## Como foi verificado

- Estrutura explorada antes de criar os arquivos: 38 `.ts`, 11 tabelas, 9 entidades e 4 APIs confirmadas.
- Nenhum arquivo de `src/`, `sql/`, `package.json` ou `.env` foi alterado.

## Observações

- O Telegram real exige token; para a apresentação, configurar `TELEGRAM_BOT_TOKEN` e/ou `TELEGRAM_CHAT_ID_FIXO`.
- Testes automatizados ficam para uma decisão futura.
