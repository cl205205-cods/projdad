# Protocolo de decisões

Este documento existe por uma regra do usuário: **a IA não decide sozinha nada importante.** O código é o trabalho de faculdade dele, e ele precisa entender e saber explicar cada escolha. O protocolo vale para o orquestrador e para todos os subagentes.

## 1. O que é uma decisão importante

Pare e pergunte antes de implementar se a mudança:

- cria, altera ou remove **tabela, coluna, FK, índice, tipo de dado ou migração**;
- adiciona ou troca **biblioteca/dependência**;
- muda **validação, senha, token, sessão, RBAC, CSP, `contextIsolation`, `sandbox`, preload ou IPC**;
- muda a **arquitetura** ou a organização dos serviços;
- muda **algo que já está pronto e funcionando**, em vez de só adicionar algo novo;
- escolhe entre **duas ou mais formas razoáveis** de resolver a mesma coisa;
- aproxima ou afasta o projeto de um **requisito do professor** (6+ tabelas com FK, CRUD completo, 4 APIs, segurança, POO, Electron+TypeScript);
- expõe um **dado sensível novo** (CPF, saúde, financeiro, token);
- muda o **fluxo principal** (login, primeiro acesso, matrícula, pagamento, avaliação, alerta).

## 2. O que não é decisão importante

Dentro de uma tarefa **já aprovada**, pode seguir sem perguntar:

- nome de variável, função ou parâmetro;
- formatação, indentação, ordem de imports;
- texto de uma mensagem que não muda regra nem dado;
- escolha de um helper interno que não altera contrato;
- comentário explicativo.

Mesmo essas decisões devem aparecer no relatório final, para o usuário saber o que mudou.

## 3. Quem pergunta

- **Somente o agente `orquestrador`** fala com o usuário.
- Subagentes **não** usam a ferramenta de pergunta e **não** lançam outros subagentes.
- O subagente devolve o **pacote de decisão** ao orquestrador.
- O orquestrador consolida, pergunta ao usuário e só então manda implementar.

## 4. Pacote de decisão (modelo)

O subagente deve devolver exatamente este formato:

```text
DECISÃO NECESSÁRIA

Contexto:
  O que estamos tentando resolver e por quê.

O que está em jogo:
  O que muda no projeto, no banco, na segurança ou na nota.

Opções:
  A) ...
     Prós:
     Contras:
     Custo/risco:
  B) ...
     Prós:
     Contras:
     Custo/risco:
  C) ... (se houver)

Recomendação:
  Qual opção eu recomendo e por quê, em uma frase.

Requisito do professor afetado:
  Ex.: “4 APIs”, “6+ tabelas”, “segurança”, “CRUD completo”, “nenhum”.

O que acontece se não decidirmos:
  Ex.: “não dá para continuar”, “podemos seguir com a opção atual”, “o risco é X”.

Impacto em algo que já funciona:
  Sim/Não + explicação.
```

## 5. Como o orquestrador pergunta ao usuário

Uma decisão por vez, ou um bloco pequeno de decisões relacionadas. Sempre:

1. Explique o contexto em **português simples**, sem jargão.
2. Apresente **2 a 4 opções**.
3. Para cada opção: **prós, contras, custo/risco**.
4. Diga sua **recomendação** e por quê.
5. Diga qual **requisito do professor** é afetado.
6. **Espere a resposta.** Não implemente nada antes.

Exemplo de pergunta ruim:

> “Posso adicionar uma coluna?”

Exemplo de pergunta boa:

> “Para guardar o histórico de congelamento de matrícula, precisamos de uma coluna nova em `matriculas`.
> A) Criar `congelada_ate DATE NULL` (recomendado): permite congelar e voltar; exige migração em tabela existente.
> B) Criar uma tabela `congelamentos`: mais flexível, mas aumenta o banco e o CRUD.
> C) Não fazer agora: não atende o pedido.
> Isso afeta o requisito ‘6+ tabelas com FK’ e o CRUD de matrículas. Qual você prefere?”

## 6. Depois da resposta

1. O orquestrador registra a decisão em uma frase: **o que foi decidido, por quê, quem aprovou**.
2. Pede ao agente `documentacao` para criar um arquivo em `docs/decisoes/` usando o modelo.
3. Manda o agente dono implementar.
4. Pede ao `qualidade` verificar.
5. Só então considera a tarefa concluída.

## 7. Frases proibidas

- “Já aproveitei e mudei...”
- “Decidi sozinho e estou avisando depois.”
- “Achei melhor assim.”
- “Isso é óbvio, não precisa perguntar.”
- “Depois a gente vê.”

Se o usuário não respondeu, **não implemente**. Se a tarefa não pode continuar sem a decisão, diga isso claramente.

## 8. Registro para a apresentação

Cada decisão aprovada vira um arquivo em `docs/decisoes/` com:

- contexto;
- opções consideradas;
- decisão;
- justificativa;
- requisito afetado;
- o que foi implementado;
- como foi verificado.

Isso mostra ao professor que a IA foi usada com critério, e não como “caixa-preta”. O usuário deve conseguir explicar cada item com suas próprias palavras.
