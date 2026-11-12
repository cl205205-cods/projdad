# Gestão de Academia — Versão 2 de 5: Matrículas, mensalidades e painel

Projeto final de DAD (Electron + TypeScript + MySQL). Esta é a **versão 2 de 5**: cada versão funciona sozinha e acrescenta funcionalidades à anterior; a versão 5 é o projeto completo.

## O que esta versão adiciona (e o que já vem da anterior)

- Tabelas `matriculas` e `pagamentos`, com as primeiras chaves estrangeiras (matrícula -> aluno/plano, pagamento -> matrícula).
- CRUD de matrículas e pagamentos. Ao criar uma matrícula, o sistema gera uma mensalidade por mês do plano; cancelar a matrícula cancela as mensalidades pendentes.
- Tela Pagamentos: filtro (atrasados, a vencer, pagos), dias de atraso e botão "Registrar pagamento".
- API 2 de 4: BrasilAPI (feriados). Vencimento que cai em fim de semana ou feriado vai para o próximo dia útil.
- Painel com alunos ativos, matrículas ativas, mensalidades atrasadas e recebido no mês (instrutor não vê dados financeiros).

## Como rodar

```bash
npm install
cp .env.example .env     # preencha com as SUAS credenciais do MySQL do laboratório
npm start
```

O `.env` não vai para o Git. É preciso estar na rede da escola (ou VPN). O app testa a conexão ao abrir, cria as tabelas que faltarem e, no primeiro acesso, pede para criar o administrador.

Se você já rodou uma versão anterior no mesmo banco, não precisa apagar nada: as tabelas novas são criadas e as existentes são mantidas (`CREATE TABLE IF NOT EXISTS`).

## Requisitos do professor até aqui

Primeiras FKs reais, CRUD de 7 entidades, 2 de 4 APIs.

## Arquivos novos em relação à versão 1

- `src/main/services/DashboardService.ts`
- `src/main/services/FeriadoService.ts`
- `src/main/services/PagamentoService.ts`
- `src/renderer/views/DashboardView.ts`
- `src/renderer/views/PagamentosView.ts`

## Arquivos alterados em relação à versão 1

- `sql/schema.sql`
- `src/main/database/EntityRepository.ts`
- `src/main/database/schema.ts`
- `src/main/ipc/IpcRouter.ts`
- `src/main/main.ts`
- `src/main/services/CrudService.ts`
- `src/renderer/app.ts`
- `src/shared/entities.ts`
- `src/shared/types.ts`

## Sugestão de commit

`feat: matrículas, mensalidades, feriados e painel financeiro`

Próxima versão: Aulas e avaliações físicas.
