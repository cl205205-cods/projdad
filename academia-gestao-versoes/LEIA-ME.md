# Gestão de Academia — 5 versões do código

Cada pasta é um projeto completo que roda sozinho. Cada versão acrescenta funcionalidades à anterior, e a **versão 5 é o projeto final**.

| # | Pasta | O que acrescenta | Requisitos atendidos até aqui |
|---|---|---|---|
| 1 | `v1-fundacao-e-cadastros` | Fundação, segurança e cadastros | Electron + TypeScript, classes (POO), segurança (base), banco relacional (ainda sem FKs), CRUD de 5 entidades, 1 de 4 APIs. |
| 2 | `v2-financeiro` | Matrículas, mensalidades e painel | Primeiras FKs reais, CRUD de 7 entidades, 2 de 4 APIs. |
| 3 | `v3-aulas-e-avaliacoes` | Aulas e avaliações físicas | 10 tabelas, CRUD completo de todas as 9 entidades, 2 de 4 APIs. |
| 4 | `v4-previsao-de-chuva` | Previsão de chuva e configurações | 11 tabelas, 3 de 4 APIs. |
| 5 | `v5-final-avisos-de-vencimento` | Aviso de vencimento por mensagem (versão final) | Todos os requisitos: 11 tabelas com FKs, CRUD completo, 4 APIs, segurança justificada, POO, Electron + TypeScript. |

Dentro de cada pasta há um `README.md` com o que mudou, a lista de arquivos novos e alterados, e uma sugestão de mensagem de commit.

## Como usar com o Git (exigência do professor: commits por etapa)

1. Crie o repositório do grupo e adicione `willcotil` como colaborador.
2. Copie o conteúdo da pasta `v1-...` para a raiz do repositório (sem `node_modules`, `dist` e `.env`) e faça o primeiro commit.
3. Para cada versão seguinte, copie o conteúdo da pasta por cima dos arquivos do repositório e faça um novo commit. O Git mostra exatamente o que mudou.
4. Dividam as versões entre os integrantes, cada um commitando com o próprio `git config user.name/email`, para que todos tenham commits identificáveis.

## Como testar uma versão

```bash
cd v2-financeiro
npm install
cp .env.example .env     # suas credenciais do MySQL do laboratório
npm start
```

Todas as versões usam o mesmo banco: ao subir de versão, as tabelas novas são criadas e os dados existentes são mantidos.
