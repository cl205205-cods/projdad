# Gestão de Academia — Versão 1 de 5: Fundação, segurança e cadastros

Projeto final de DAD (Electron + TypeScript + MySQL). Esta é a **versão 1 de 5**: cada versão funciona sozinha e acrescenta funcionalidades à anterior; a versão 5 é o projeto completo.

## O que esta versão adiciona

- Projeto Electron + TypeScript (main, preload, renderer) e build com `tsc` + `esbuild`.
- Banco MySQL no formato da Aula 1: `mysql2`, `src/main/conexao.ts` lendo o `.env`, teste de conexão no `main.ts` com `dialog.showErrorBox`, consultas em `new Promise` (`Database.rodar`).
- 6 tabelas criadas automaticamente: usuarios, alunos, planos, instrutores, modalidades, configuracoes. Catálogo inicial (3 modalidades e 3 planos).
- CRUD completo de 5 entidades (alunos, planos, instrutores, modalidades, usuários) com tela genérica dirigida por metadados (`src/shared/entities.ts`).
- Segurança: primeiro acesso cria o administrador, senha com scrypt, bloqueio após 5 falhas, perfis admin/recepção/instrutor (RBAC no main), validação de entradas (CPF, e-mail, datas…), consultas com `?`, Electron endurecido (contextIsolation, sandbox, CSP, IPC só da nossa página).
- API 1 de 4: ViaCEP (preenche o endereço do aluno pelo CEP).

## Como rodar

```bash
npm install
cp .env.example .env     # preencha com as SUAS credenciais do MySQL do laboratório
npm start
```

O `.env` não vai para o Git. É preciso estar na rede da escola (ou VPN). O app testa a conexão ao abrir, cria as tabelas que faltarem e, no primeiro acesso, pede para criar o administrador.

Se você já rodou uma versão anterior no mesmo banco, não precisa apagar nada: as tabelas novas são criadas e as existentes são mantidas (`CREATE TABLE IF NOT EXISTS`).

## Requisitos do professor até aqui

Electron + TypeScript, classes (POO), segurança (base), banco relacional (ainda sem FKs), CRUD de 5 entidades, 1 de 4 APIs.

## Arquivos desta versão

- `.env.example`
- `.gitignore`
- `package-lock.json`
- `package.json`
- `sql/schema.sql`
- `src/main/AppError.ts`
- `src/main/conexao.ts`
- `src/main/database/Database.ts`
- `src/main/database/EntityRepository.ts`
- `src/main/database/schema.ts`
- `src/main/ipc/IpcRouter.ts`
- `src/main/main.ts`
- `src/main/security/PasswordHasher.ts`
- `src/main/security/Validator.ts`
- `src/main/services/AuthService.ts`
- `src/main/services/CepService.ts`
- `src/main/services/CrudService.ts`
- `src/main/services/HttpClient.ts`
- `src/preload/preload.ts`
- `src/renderer/api.ts`
- `src/renderer/app.ts`
- `src/renderer/global.d.ts`
- `src/renderer/index.html`
- `src/renderer/styles.css`
- `src/renderer/ui.ts`
- `src/renderer/views/CrudView.ts`
- `src/renderer/views/LoginView.ts`
- `src/shared/dates.ts`
- `src/shared/entities.ts`
- `src/shared/types.ts`
- `tsconfig.main.json`
- `tsconfig.renderer.json`


## Sugestão de commit

`feat: base do projeto, conexão MySQL, login/RBAC e cadastros básicos`

Próxima versão: Matrículas, mensalidades e painel.
