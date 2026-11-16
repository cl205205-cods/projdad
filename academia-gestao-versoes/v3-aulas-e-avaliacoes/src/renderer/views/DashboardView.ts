import { chamar } from '../api';
import type { ResumoDashboard } from '../../shared/types';
import { h, moeda, selo, vazio } from '../ui';

export class DashboardView {
  async montar(raiz: HTMLElement): Promise<void> {
    const r = await chamar<ResumoDashboard>('dashboard:resumo');
    const item = (n: string, rotulo: string, tom = ''): HTMLElement =>
      h('div', { class: `placar-item ${tom}` }, h('span', { class: 'numero' }, n), h('span', { class: 'rotulo' }, rotulo));
    const f = r.financeiro;
    raiz.append(h('section', { class: 'placar', 'aria-label': 'Resumo' },
      item(String(r.alunosAtivos), 'alunos ativos'),
      item(String(r.matriculasAtivas), 'matrículas ativas'),
      f ? item(String(f.atrasados), `mensalidades atrasadas (${moeda(f.valorAtrasado)})`, f.atrasados ? 'alerta' : '') : null,
      f ? item(moeda(f.recebidoNoMes), 'recebido neste mês') : null));

    const aulas = r.aulasHoje.length
      ? h('ul', { class: 'lista-aulas' }, ...r.aulasHoje.map((a) => h('li', {},
        h('span', { class: 'hora' }, a.hora), h('span', {}, `${a.modalidade} · ${a.instrutor}`), a.aoArLivre ? selo('Ao ar livre', 'info') : null)))
      : vazio('Nenhuma aula cadastrada para hoje.');
    raiz.append(h('section', { class: 'painel' }, h('h2', {}, 'Aulas de hoje'), aulas));
  }

}
