# Gestão de Academia — Versão 3 de 5: Aulas e avaliações físicas

Projeto final de DAD (Electron + TypeScript + MySQL). Esta é a **versão 3 de 5**: cada versão funciona sozinha e acrescenta funcionalidades à anterior; a versão 5 é o projeto completo.

## O que esta versão adiciona (e o que já vem da anterior)

- Tabelas `aulas` e `avaliacoes_fisicas` (FKs para modalidades, instrutores e alunos).
- CRUD de aulas (modalidade, instrutor, dia, horário, local e "ao ar livre") e de avaliações físicas. As 9 entidades já têm CRUD completo.
- Evolução do aluno: peso, cintura, gordura e IMC em gráficos (SVG) e variação desde a primeira avaliação.
- Painel: lista "Aulas de hoje". Instrutor passa a cadastrar avaliações.

## Como rodar

```bash
npm install
cp .env.example .env     # preencha com as SUAS credenciais do MySQL do laboratório
npm start
```

O `.env` não vai para o Git. É preciso estar na rede da escola (ou VPN). O app testa a conexão ao abrir, cria as tabelas que faltarem e, no primeiro acesso, pede para criar o administrador.

Se você já rodou uma versão anterior no mesmo banco, não precisa apagar nada: as tabelas novas são criadas e as existentes são mantidas (`CREATE TABLE IF NOT EXISTS`).

## Requisitos do professor até aqui

10 tabelas, CRUD completo de todas as 9 entidades, 2 de 4 APIs.

## Arquivos novos em relação à versão 2

- `src/main/services/AvaliacaoService.ts`
- `src/renderer/views/AvaliacoesView.ts`

## Arquivos alterados em relação à versão 2

- `sql/schema.sql`
- `src/main/database/EntityRepository.ts`
- `src/main/database/schema.ts`
- `src/main/ipc/IpcRouter.ts`
- `src/main/main.ts`
- `src/main/services/DashboardService.ts`
- `src/renderer/app.ts`
- `src/renderer/views/DashboardView.ts`
- `src/shared/entities.ts`
- `src/shared/types.ts`

## Sugestão de commit

`feat: aulas, avaliações físicas e evolução do aluno`

Próxima versão: Previsão de chuva e configurações.
