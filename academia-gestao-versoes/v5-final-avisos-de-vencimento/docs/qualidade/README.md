# Relatórios de qualidade

Esta pasta guarda as evidências de verificação feitas pelo agente `qualidade`.

## Como usar

1. Copie `0000-modelo-relatorio.md` para `NNNN-descricao.md`.
2. Preencha data, ambiente, o que foi verificado, comandos e resultado.
3. Se falhar, diga o passo, o esperado, o obtido e qual agente deve corrigir.
4. Nunca inclua token, senha ou dado real de aluno.

## Regra

O agente `qualidade` **não corrige** código de produção. Ele reporta ao orquestrador, que aciona o dono do arquivo. Uma tarefa só é concluída depois do parecer dele.
