import { chamar } from '../api';
import { formatBR } from '../../shared/dates';
import type { AlertaChuva, ResumoDashboard } from '../../shared/types';
import { h, moeda, numeroBR, selo, vazio } from '../ui';

export class DashboardView {
  async montar(raiz: HTMLElement): Promise<void> {
    const r = await chamar<ResumoDashboard>('dashboard:resumo');
    const item = (n: string, rotulo: string, tom = ''): HTMLElement =>
      h('div', { class: `placar-item ${tom}` }, h('span', { class: 'numero' }, n), h('span', { class: 'rotulo' }, rotulo));
    const f = r.financeiro;
    raiz.append(h('section', { class: 'placar', 'aria-label': 'Resumo' },
      item(String(r.alunosAtivos), 'alunos ativos'),
      item(String(r.matriculasAtivas), 'matrículas ativas'),
      item(String(r.vencendo), 'planos perto de vencer', r.vencendo ? 'atencao' : ''),
      f ? item(String(f.atrasados), `mensalidades atrasadas (${moeda(f.valorAtrasado)})`, f.atrasados ? 'alerta' : '') : null,
      f ? item(moeda(f.recebidoNoMes), 'recebido neste mês') : null));

    const aulas = r.aulasHoje.length
      ? h('ul', { class: 'lista-aulas' }, ...r.aulasHoje.map((a) => h('li', {},
        h('span', { class: 'hora' }, a.hora), h('span', {}, `${a.modalidade} · ${a.instrutor}`), a.aoArLivre ? selo('Ao ar livre', 'info') : null)))
      : vazio('Nenhuma aula cadastrada para hoje.');
    const previsao = h('div', {}, vazio('Consultando a previsão…'));
    raiz.append(h('div', { class: 'duas-colunas' },
      h('section', { class: 'painel' }, h('h2', {}, 'Aulas de hoje'), aulas),
      h('section', { class: 'painel' }, h('h2', {}, 'Chuva nas aulas ao ar livre'), previsao)));
    void this.previsao(previsao);
  }

  private async previsao(alvo: HTMLElement): Promise<void> {
    try {
      const lista = await chamar<AlertaChuva[]>('alertas:chuva');
      alvo.replaceChildren();
      if (lista.length === 0) { alvo.append(vazio('Nenhuma aula ao ar livre nas próximas horas.')); return; }
      alvo.append(h('ul', { class: 'lista-aulas' }, ...lista.map((a) => h('li', {},
        h('span', { class: 'hora' }, a.hora), h('span', {}, `${a.modalidade} · ${formatBR(a.data).slice(0, 5)}`),
        a.vaiChover ? selo(`Chuva ${numeroBR(a.probabilidade)}% – remarcar?`, 'erro') : selo(`Tempo firme (${a.probabilidade}%)`, 'ok')))));
    } catch (e) { alvo.replaceChildren(vazio(e instanceof Error ? `Previsão indisponível: ${e.message}` : 'Previsão indisponível.')); }
  }
}
