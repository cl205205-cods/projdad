# Relatório de qualidade — decisão 0003 (polimento dinâmico da interface)

- **Data da 1ª rodada:** 2026-11-24
- **Data da 2ª rodada (reconferência):** 2026-11-24
- **Agente:** `qualidade`
- **Arquivos verificados (somente leitura):** `src/renderer/**` (ui.ts, app.ts, styles.css, views/CrudView.ts, views/AlertasView.ts, demais views), `src/preload/preload.ts`, `src/main/main.ts` (só hardening), `index.html`, `package.json`, documentação da decisão.
- **Nada foi alterado em código de produção.** As evidências vieram de harness temporário fora do projeto: `%LOCALAPPDATA%\Temp\qualidade-0003\` (stub do `window.api` + Electron offscreen carregando o `dist/renderer/index.html` e o `styles.css` reais).

## Ambiente

- Windows, Electron 45.2.1, `node_modules` e `.env` presentes.
- **Sem MySQL real e sem token do Telegram** → teste de fumaça com stub do `window.api` e dados fictícios.
- Sem NVDA e sem captura de vídeo; foco/tabulação avaliados por código + foco programático.

## Comandos rodados (as duas rodadas)

```text
npm run typecheck   -> sem erros (tsc main + renderer)
npm run build       -> EXIT CODE 0 (dist/renderer/app.js 69,6 kB; styles.css 17,8 kB)
grep innerHTML|insertAdjacentHTML|localStorage em src/renderer -> só 1 comentário; localStorage só com a flag "1"
Get-ChildItem -Recurse src -Filter *.js -> nenhum
electron %TEMP%\qualidade-0003\smoke*.js -> 6 roteiros (admin, falha de API, instrutor, reconferência 0003)
```

---

# Rodada 2 (reconferência) — **APROVADO**

Os seis itens pedidos foram medidos no app compilado. Tudo confere.

| # | Item | Evidência medida | Situação |
|---|---|---|---|
| 1 | Diálogo fechado invisível | `<dialog class="dialogo">` nunca aberto: `display: none`, **0 × 0 px**, `open=false`; após `close()` real: `display: none`, 0 × 0 | **OK** |
| 1b | Diálogo aberto | `display: flex`, `flex-direction: column`, `.dialogo-corpo` com `overflow-y: auto`, rodapé `.acoes` com `position: sticky`, foco dentro do diálogo | **OK** |
| 2 | Anel de foco `--foco: #E04D0A` | branco **4,011:1**; `--concreto` **3,296:1**; `--piso` **3,178:1** (todos ≥ 3:1). A regra `:focus-visible` e o foco do placar usam `var(--foco)` no CSS construído (`dist/renderer/styles.css`) | **OK** |
| 3 | Região viva | `#avisos` sem `role`/`aria-live`; toast de sucesso com `role="status"`, toast de erro com `role="alert"`; nenhum toast dentro de contêiner `aria-live` (`temLiveAninhado: false`) | **OK** |
| 4 | “Enviar aviso” individual | 3 cliques rápidos → botão fica `disabled` e “Enviando…” no mesmo instante → **1 chamada** `alertas:enviar` → volta a “Enviar aviso” habilitado | **OK** |
| 5 | Contagem com busca zerada | busca “zzz” → “Nada encontrado para esta busca.” + **“0 de 1 registros”**; “Limpar busca” → 1 linha e “1 registro”. Toasts: **“Registro cadastrado.”** (criar) e **“Alterações salvas.”** (editar) | **OK** |
| 6 | Botão fechar do toast | `min-width/min-height: 24px` → caixa medida **24 × 24 px** | **OK** |
| — | Erro por campo (regressão) | toast `role="alert"` + `aria-invalid="true"` + `.campo.invalido` (1) + descrição “Informe o nome completo.” no `aria-describedby`; botão volta a “Salvar” habilitado | **OK** |
| — | Console | 0 erro em todas as execuções da rodada | **OK** |

**Observações desta rodada (não bloqueiam):**

1. **Margem do anel de foco:** 3,178:1 sobre `--piso` passa, mas com margem curta (0,18 acima do mínimo). Para comparação, contra `--piso-2` (#234679) daria 2,354:1 — esse caso **não** se aplica hoje porque o anel é desenhado fora do item (offset +2px no menu) e, no placar, sobre o fundo `--piso` do bloco. Só valeria se o anel fosse desenhado dentro de uma área `--piso-2` (ex.: item de menu ativo com offset negativo). Se quiser folga definitiva, o caminho continua sendo anel de dois tons.
2. **Remoção do diálogo depende do evento `close`:** com `display:none` imediato, o nó some do DOM quando o evento é disparado. Em janela oculta/offscreen o Chromium estrangula tarefas (medimos até ~1 s); em janela visível é imediato. Não há efeito visual — é só um detalhe de medição.
3. **Pendência antiga, ainda aberta e fora do escopo desta correção:** `CrudView.timerBusca` não é limpo no desmonte (timer de 140 ms pode rodar em nó já desanexado). Inofensivo.

---

# Rodada 1 (histórico) — REPROVADO, corrigido depois

| Falha | Medição original | Correção aplicada | Reconferência |
|---|---|---|---|
| `.dialogo { display:flex }` fazia diálogo fechado aparecer | fechado 720 × 324 px, `display:flex` | `.dialogo[open] { display:flex }` | fechado 0 × 0, `display:none` |
| Anel de foco abaixo de 3:1 sobre o fundo claro | `--fita` #E8590C vs `--concreto` = **2,94:1** | token `--foco` (passou por #D9490A = 2,98:1 no azul e chegou a **#E04D0A**) | 4,011 / 3,296 / 3,178 |
| Regiões vivas aninhadas | `#avisos` `role=status aria-live=polite` + toast `role=alert` | contêiner sem papel vivo | sem aninhamento |
| “Enviar aviso” sem estado ocupado | duplo clique podia enviar 2× | botão recebido por parâmetro, desabilitado no `finally` | 1 chamada |
| Contagem sumia com busca zerada | rodapé ausente | rodapé “0 de N registros” | “0 de 1 registros” |
| Concordância “Matrícula salvo.” | texto genérico `${label} salvo.` | “Registro cadastrado.” / “Alterações salvas.” | conferido |
| Fechar do toast ~22 px | abaixo de 24 × 24 | `min-width/min-height: 24px` | 24 × 24 |

## O que continua valendo da rodada 1 (sem regressão)

- Login com foco no e-mail e botão “Entrando…” desabilitado; erro com `role="alert"`.
- Troca de tela com `aria-busy`, esqueleto, “Carregando…” (sr-only), foco no `h1` (`tabindex="-1"`), `.corpo.entrando`.
- Menu em 6 grupos `role="group"` com `aria-label`; `aria-current="page"`; 13 itens para admin.
- Placar acionável (5/5 no admin; instrutor sem financeiro, 3 itens), `aria-label` completo.
- Duplo clique em salvar: 3 cliques → 1 chamada.
- Busca com debounce de 140 ms (0 mutações em 80 ms, 2 após 330 ms).
- Previsão do painel com falha → “Tentar de novo” → `aria-busy` → resultado.
- Estados ocupados de “Verificar agora”, Relatórios e Configurações; aviso de Telegram simulado.
- Contraste do botão primário 5,43:1; `prefers-reduced-motion: reduce` desliga giro, esqueleto, `.corpo.entrando` e transições.
- Sem `innerHTML`/`insertAdjacentHTML`; `localStorage` só com a flag `"1"`; preload mínimo com ouvintes registrados uma vez; CSP e `contextIsolation/sandbox/nodeIntegration/webSecurity` intactos; nenhuma dependência nova; nenhum `.js` em `src`.

## Não verificado (e por quê)

- MySQL real (primeiro acesso, mensalidades, cancelamento, RBAC no servidor): sem acesso ao banco.
- Telegram real e envio simulado de ponta a ponta: sem token.
- Leitor de tela real (NVDA) e navegação completa por Tab/Shift+Tab/Esc: precisa de teste humano.
- Percepção do flash do diálogo em janela visível: o layout foi medido (0 × 0), a percepção visual não foi filmada.
