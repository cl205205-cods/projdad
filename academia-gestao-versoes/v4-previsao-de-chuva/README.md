# Gestão de Academia — Versão 4 de 5: Previsão de chuva e configurações

Projeto final de DAD (Electron + TypeScript + MySQL). Esta é a **versão 4 de 5**: cada versão funciona sozinha e acrescenta funcionalidades à anterior; a versão 5 é o projeto completo.

## O que esta versão adiciona (e o que já vem da anterior)

- Tabela `avisos` (histórico de alertas, sem duplicar o mesmo aviso).
- API 3 de 4: Open-Meteo. Para cada aula ao ar livre nas próximas horas, calcula a chance de chuva no horário da aula.
- `AlertaService` + `Agendador`: a verificação roda ao abrir o app e a cada 30 minutos; aviso na tela e notificação do sistema quando passa do limite.
- Tela Clima e avisos (previsão sob demanda + histórico) e tela Configurações (coordenadas do espaço externo, limite de chuva, antecedência, dias de "perto de vencer").
- Painel: chuva nas aulas ao ar livre e contador de planos perto de vencer.

## Como rodar

```bash
npm install
cp .env.example .env     # preencha com as SUAS credenciais do MySQL do laboratório
npm start
```

O `.env` não vai para o Git. É preciso estar na rede da escola (ou VPN). O app testa a conexão ao abrir, cria as tabelas que faltarem e, no primeiro acesso, pede para criar o administrador.

Se você já rodou uma versão anterior no mesmo banco, não precisa apagar nada: as tabelas novas são criadas e as existentes são mantidas (`CREATE TABLE IF NOT EXISTS`).

## Requisitos do professor até aqui

11 tabelas, 3 de 4 APIs.

## Arquivos novos em relação à versão 3

- `src/main/services/AlertaService.ts`
- `src/main/services/ClimaService.ts`
- `src/main/services/ConfigService.ts`
- `src/renderer/views/AlertasView.ts`
- `src/renderer/views/ConfigView.ts`

## Arquivos alterados em relação à versão 3

- `sql/schema.sql`
- `src/main/database/schema.ts`
- `src/main/ipc/IpcRouter.ts`
- `src/main/main.ts`
- `src/main/services/DashboardService.ts`
- `src/preload/preload.ts`
- `src/renderer/app.ts`
- `src/renderer/global.d.ts`
- `src/renderer/views/DashboardView.ts`
- `src/shared/types.ts`

## Sugestão de commit

`feat: previsão de chuva para aulas ao ar livre e configurações`

Próxima versão: Aviso de vencimento por mensagem (versão final).
