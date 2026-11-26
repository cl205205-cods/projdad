// Componentes visuais reutilizados em todas as telas: elementos, formatação, avisos, diálogos e gráficos.
import { formatBR } from '../shared/dates';
import type { FormatoValor } from '../shared/types';

// Tipo aceito como filho de um elemento
export type Filho = Node | string | number | null | undefined | false;
type Props = Record<string, unknown>;

/** Cria elementos sem innerHTML: todo texto entra como textContent, então dados do banco não executam como HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...filhos: Filho[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'checked') (el as unknown as HTMLInputElement).checked = true;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  anexar(el, filhos);
  return el;
}

// Adiciona filhos (texto ou elementos) a um elemento
export function anexar(pai: ParentNode, filhos: Filho[]): void {
  for (const f of filhos) if (f !== null && f !== undefined && f !== false) pai.append(typeof f === 'object' ? f : String(f));
}

// Formatadores: moeda (R$), data, número, CPF e telefone
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const moeda = (n: number): string => brl.format(n);
export const dataBR = (iso: unknown): string => (typeof iso === 'string' && iso ? formatBR(iso) : '—');
export const numeroBR = (n: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
// Esconde parte do CPF nas listas (proteção de dado sensível)
export const mascararCpf = (c: unknown): string => {
  const d = String(c ?? '');
  return d.length === 11 ? `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••` : '—';
};
export const formatarTel = (t: unknown): string => {
  const d = String(t ?? '').replace(/^55(?=\d{11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || '—';
};

// Selo colorido de status
export type Tom = 'ok' | 'erro' | 'aviso' | 'info' | 'neutro';
export const selo = (texto: string, tom: Tom): HTMLElement => h('span', { class: `selo ${tom}` }, texto);

// Mensagem rápida no canto da tela (some sozinha, pode ser fechada e é anunciada por leitor de tela)
export function toast(mensagem: string, tom: 'ok' | 'erro' | 'aviso' = 'ok'): void {
  const icone = tom === 'ok' ? '✓' : tom === 'erro' ? '!' : 'i';
  const el = h('div', { class: `toast ${tom}`, role: tom === 'erro' ? 'alert' : 'status' },
    h('span', { class: 'toast-icone', 'aria-hidden': 'true' }, icone),
    h('span', { class: 'toast-texto' }, mensagem),
    h('button', {
      class: 'toast-fechar', type: 'button', 'aria-label': 'Fechar aviso',
      onclick: () => el.remove(),
    }, '×'));
  document.getElementById('avisos')?.append(el);
  setTimeout(() => el.remove(), tom === 'erro' ? 7000 : 4500);
}

// Abre uma janela de diálogo modal (corpo rolável e ações fixas no rodapé)
export function abrirDialogo(titulo: string, corpo: Node, acoes: HTMLElement[]): HTMLDialogElement {
  const d = h('dialog', { class: 'dialogo' },
    h('h2', {}, titulo),
    h('div', { class: 'dialogo-corpo' }, corpo),
    h('div', { class: 'acoes' }, ...acoes));
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}

// Pergunta de confirmação (ex.: excluir); devolve true ou false
export function confirmar(mensagem: string, rotulo = 'Excluir'): Promise<boolean> {
  return new Promise((resolve) => {
    let resposta = false;
    const d = abrirDialogo('Confirmar', h('p', {}, mensagem), [
      h('button', { class: 'btn', type: 'button', onclick: () => d.close() }, 'Cancelar'),
      h('button', { class: 'btn perigo', type: 'button', onclick: () => { resposta = true; d.close(); } }, rotulo),
    ]);
    d.addEventListener('close', () => resolve(resposta));
  });
}

// Esvazia um elemento
export const limparNo = (el: Element): void => el.replaceChildren();
// Cria um botão (a dica opcional vira tooltip e texto de acessibilidade)
export const botao = (rotulo: string, aoClicar: () => void, classe = 'btn', dica?: string): HTMLButtonElement =>
  h('button', { class: classe, type: 'button', title: dica, 'aria-label': dica, onclick: aoClicar }, rotulo);

// Formata um número conforme o tipo do relatório
export const formatarValor = (n: number, formato: FormatoValor): string =>
  formato === 'moeda' ? moeda(n) : formato === 'percentual' ? `${numeroBR(n)}%` : numeroBR(n);

// Mensagem de lista vazia
export function vazio(mensagem: string): HTMLElement { return h('p', { class: 'vazio' }, mensagem); }

/** Esqueleto de carregamento: blocos neutros no lugar do conteúdo, sem animação se o usuário pedir menos movimento. */
export function esqueleto(): HTMLElement {
  return h('div', { class: 'esqueleto', 'aria-hidden': 'true' },
    h('div', { class: 'esqueleto-bloco' }),
    h('div', { class: 'esqueleto-linha' }),
    h('div', { class: 'esqueleto-grade' },
      h('div', { class: 'esqueleto-card' }), h('div', { class: 'esqueleto-card' }), h('div', { class: 'esqueleto-card' })),
    h('div', { class: 'esqueleto-linha curta' }));
}

// Utilitário para desenhar os gráficos em SVG (sem biblioteca externa)
const SVG_NS = 'http://www.w3.org/2000/svg';
// Cria um elemento SVG
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, ...filhos: (SVGElement | string)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...filhos);
  return el;
}

// Opções dos gráficos: formato do número e, se preciso, um formatador do eixo Y
export interface OpcoesGrafico { formato?: FormatoValor; rotuloY?: (v: number) => string }

/** Gráfico de linha simples em SVG (sem biblioteca externa). */
export function graficoLinha(titulo: string, unidade: string, pontos: { x: string; y: number }[], opcoes: OpcoesGrafico = {}): HTMLElement {
  const rotuloY = opcoes.rotuloY ?? ((v: number): string => formatarValor(v, opcoes.formato ?? 'numero'));
  const fig = h('figure', { class: 'grafico' }, h('figcaption', {}, unidade ? `${titulo} (${unidade})` : titulo));
  if (pontos.length === 0) { fig.append(vazio('Sem dados no período.')); return fig; }
  // Tamanho e margens do gráfico
  const L = 440, A = 190, mx = 44, my = 28;
  // Escala vertical (com folga para os valores não ficarem colados na borda)
  const ys = pontos.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) {
    if (max === 0) { min = 0; max = 1; } else { min -= 1; max += 1; }
  } else { const folga = (max - min) * 0.2; min -= folga; max += folga; }
  // Converte índice e valor em coordenadas x e y
  const px = (i: number): number => mx + (pontos.length === 1 ? (L - 2 * mx) / 2 : (i * (L - 2 * mx)) / (pontos.length - 1));
  const py = (y: number): number => A - my - ((y - min) / (max - min)) * (A - 2 * my);
  // Rótulo do eixo X: data completa vira DD/MM; meses ("nov/26") ficam inteiros
  const rotuloX = (x: string): string => { const s = dataBR(x); return x.includes('-') ? s.slice(0, 5) : s; };
  // Desenha o eixo, a linha, os pontos, os valores e as datas
  const g = svg('svg', { viewBox: `0 0 ${L} ${A}`, role: 'img', 'aria-label': `${titulo}: ${pontos.map((p) => `${dataBR(p.x)} ${rotuloY(p.y)}`).join(', ')}` });
  g.append(
    svg('line', { class: 'eixo', x1: mx, y1: A - my, x2: L - mx + 10, y2: A - my }),
    svg('polyline', { class: 'linha', points: pontos.map((p, i) => `${px(i)},${py(p.y)}`).join(' ') }),
  );
  pontos.forEach((p, i) => {
    g.append(svg('circle', { class: 'ponto', cx: px(i), cy: py(p.y), r: 4.5 }));
    // Com muitos pontos, mostra o valor só no último (a descrição acessível tem todos)
    if (pontos.length <= 6 || i === pontos.length - 1) {
      g.append(svg('text', { class: 'valor', x: px(i), y: py(p.y) - 11, 'text-anchor': 'middle' }, rotuloY(p.y)));
    }
    if (pontos.length <= 12 || i === 0 || i === pontos.length - 1)
      g.append(svg('text', { class: 'rotulo', x: px(i), y: A - 8, 'text-anchor': 'middle' }, rotuloX(p.x)));
  });
  fig.append(g);
  return fig;
}

/** Gráfico de barras em SVG, com valor e rótulo em cada barra. */
export function graficoBarras(titulo: string, unidade: string, dados: { rotulo: string; valor: number }[], formato: FormatoValor = 'numero'): HTMLElement {
  const fig = h('figure', { class: 'grafico' }, h('figcaption', {}, unidade ? `${titulo} (${unidade})` : titulo));
  if (dados.length === 0) { fig.append(vazio('Sem dados no período.')); return fig; }
  // Área de desenho e escala
  const L = 460, A = 230, topo = 26, base = 54, lateral = 10;
  const areaL = L - 2 * lateral, areaA = A - topo - base;
  const max = Math.max(...dados.map((d) => d.valor), 1);
  const passo = areaL / dados.length;
  const largura = Math.min(58, passo * 0.62);
  const g = svg('svg', { viewBox: `0 0 ${L} ${A}`, role: 'img', 'aria-label': `${titulo}: ${dados.map((d) => `${d.rotulo} ${formatarValor(d.valor, formato)}`).join(', ')}` });
  // Linhas de referência discretas
  for (const fracao of [0.25, 0.5, 0.75, 1])
    g.append(svg('line', { class: 'grade', x1: lateral, y1: topo + areaA * (1 - fracao), x2: L - lateral, y2: topo + areaA * (1 - fracao) }));
  dados.forEach((d, i) => {
    const x = lateral + passo * i + (passo - largura) / 2;
    const altura = d.valor > 0 ? Math.max(2, (d.valor / max) * areaA) : 0;
    const barra = svg('rect', { class: 'barra-grafico', x, y: topo + areaA - altura, width: largura, height: altura, rx: 3 });
    barra.append(svg('title', {}, `${d.rotulo}: ${formatarValor(d.valor, formato)}`));
    g.append(barra);
    // Valores por barra: com muitas categorias, o valor fica só no tooltip e na descrição acessível
    if (dados.length <= 8) g.append(svg('text', { class: 'barra-valor', x: x + largura / 2, y: topo + areaA - altura - 6, 'text-anchor': 'middle' }, formatarValor(d.valor, formato)));
    g.append(svg('text', { class: 'rotulo', x: x + largura / 2, y: A - 16, 'text-anchor': 'middle' }, d.rotulo.length > 12 ? `${d.rotulo.slice(0, 11)}…` : d.rotulo));
  });
  fig.append(g);
  return fig;
}

// Desenha uma fatia de rosca (setor entre dois raios)
function setor(cx: number, cy: number, re: number, ri: number, a0: number, a1: number): string {
  const ponto = (r: number, a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = ponto(re, a0), [x1, y1] = ponto(re, a1);
  const [x2, y2] = ponto(ri, a1), [x3, y3] = ponto(ri, a0);
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${re} ${re} 0 ${grande} 1 ${x1} ${y1} L ${x2} ${y2} A ${ri} ${ri} 0 ${grande} 0 ${x3} ${y3} Z`;
}

/** Gráfico de rosca com legenda textual (a informação não depende só da cor). */
export function graficoRosca(titulo: string, dados: { rotulo: string; valor: number }[], formato: FormatoValor = 'numero'): HTMLElement {
  const fig = h('figure', { class: 'grafico' }, h('figcaption', {}, titulo));
  const validos = dados.filter((d) => d.valor > 0);
  if (validos.length === 0) { fig.append(vazio('Sem dados no período.')); return fig; }
  const total = validos.reduce((s, d) => s + d.valor, 0);
  const L = 220, A = 170, cx = 110, cy = 85, re = 66, ri = 40;
  const g = svg('svg', { viewBox: `0 0 ${L} ${A}`, role: 'img', 'aria-label': `${titulo}: ${validos.map((d) => `${d.rotulo} ${formatarValor(d.valor, formato)}`).join(', ')}` });
  if (validos.length === 1) {
    // Uma única categoria: rosca completa (um setor de 360° ficaria sem área)
    g.append(svg('circle', { class: 'fatia cor-0', cx, cy, r: re }), svg('circle', { class: 'rosca-furo', cx, cy, r: ri }));
  } else {
    let angulo = -Math.PI / 2;
    validos.forEach((d, i) => {
      const fim = angulo + (d.valor / total) * Math.PI * 2;
      const fatia = svg('path', { class: `fatia cor-${i % 7}`, d: setor(cx, cy, re, ri, angulo, fim) });
      fatia.append(svg('title', {}, `${d.rotulo}: ${formatarValor(d.valor, formato)}`));
      g.append(fatia);
      angulo = fim;
    });
  }
  // Total no centro da rosca
  g.append(svg('text', { class: `rosca-total${formato === 'moeda' ? ' moeda' : ''}`, x: cx, y: cy - 2, 'text-anchor': 'middle' }, formatarValor(total, formato)));
  g.append(svg('text', { class: 'rosca-sub', x: cx, y: cy + 16, 'text-anchor': 'middle' }, 'total'));
  const legenda = h('ul', { class: 'legenda' }, ...validos.map((d, i) => h('li', {},
    h('span', { class: `cor cor-${i % 7}`, 'aria-hidden': 'true' }), h('span', {}, d.rotulo),
    h('span', { class: 'legenda-valor' }, formatarValor(d.valor, formato)))));
  fig.append(h('div', { class: 'rosca' }, g, legenda));
  return fig;
}
