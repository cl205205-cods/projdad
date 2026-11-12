import { formatBR } from '../shared/dates';

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

export function anexar(pai: ParentNode, filhos: Filho[]): void {
  for (const f of filhos) if (f !== null && f !== undefined && f !== false) pai.append(typeof f === 'object' ? f : String(f));
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const moeda = (n: number): string => brl.format(n);
export const dataBR = (iso: unknown): string => (typeof iso === 'string' && iso ? formatBR(iso) : '—');
export const numeroBR = (n: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
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

export type Tom = 'ok' | 'erro' | 'aviso' | 'info' | 'neutro';
export const selo = (texto: string, tom: Tom): HTMLElement => h('span', { class: `selo ${tom}` }, texto);

export function toast(mensagem: string, tom: 'ok' | 'erro' | 'aviso' = 'ok'): void {
  const el = h('div', { class: `toast ${tom}` }, mensagem);
  document.getElementById('avisos')?.append(el);
  setTimeout(() => el.remove(), tom === 'erro' ? 7000 : 4500);
}

export function abrirDialogo(titulo: string, corpo: Node, acoes: HTMLElement[]): HTMLDialogElement {
  const d = h('dialog', { class: 'dialogo' }, h('h2', {}, titulo), corpo, h('div', { class: 'acoes' }, ...acoes));
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}

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

export const limparNo = (el: Element): void => el.replaceChildren();
export const botao = (rotulo: string, aoClicar: () => void, classe = 'btn'): HTMLButtonElement =>
  h('button', { class: classe, type: 'button', onclick: aoClicar }, rotulo);

export function vazio(mensagem: string): HTMLElement { return h('p', { class: 'vazio' }, mensagem); }

const SVG_NS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, ...filhos: (SVGElement | string)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...filhos);
  return el;
}

/** Gráfico de linha simples em SVG (sem biblioteca externa). */
export function graficoLinha(titulo: string, unidade: string, pontos: { x: string; y: number }[]): HTMLElement {
  const L = 440, A = 190, mx = 44, my = 28;
  const ys = pontos.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const folga = (max - min) * 0.2; min -= folga; max += folga;
  const px = (i: number): number => mx + (pontos.length === 1 ? (L - 2 * mx) / 2 : (i * (L - 2 * mx)) / (pontos.length - 1));
  const py = (y: number): number => A - my - ((y - min) / (max - min)) * (A - 2 * my);
  const g = svg('svg', { viewBox: `0 0 ${L} ${A}`, role: 'img', 'aria-label': `${titulo}: ${pontos.map((p) => `${dataBR(p.x)} ${numeroBR(p.y)}`).join(', ')}` });
  g.append(
    svg('line', { class: 'eixo', x1: mx, y1: A - my, x2: L - mx + 10, y2: A - my }),
    svg('polyline', { class: 'linha', points: pontos.map((p, i) => `${px(i)},${py(p.y)}`).join(' ') }),
  );
  pontos.forEach((p, i) => {
    g.append(svg('circle', { class: 'ponto', cx: px(i), cy: py(p.y), r: 4.5 }));
    g.append(svg('text', { class: 'valor', x: px(i), y: py(p.y) - 11, 'text-anchor': 'middle' }, numeroBR(p.y)));
    if (i === 0 || i === pontos.length - 1 || pontos.length <= 5)
      g.append(svg('text', { class: 'rotulo', x: px(i), y: A - 8, 'text-anchor': 'middle' }, dataBR(p.x).slice(0, 5)));
  });
  return h('figure', { class: 'grafico' }, h('figcaption', {}, `${titulo} (${unidade})`), g);
}
