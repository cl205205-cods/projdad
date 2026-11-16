import { chamar } from '../api';
import type { AlertaChuva, Aviso } from '../../shared/types';
import { formatBR } from '../../shared/dates';
import { botao, h, selo, vazio, type Tom } from '../ui';

const TOM_ENVIO: Record<string, Tom> = { enviado: 'ok', simulado: 'info', falha: 'erro', gerado: 'aviso' };

/** Clima e avisos: previsão para aulas ao ar livre e histórico de avisos. */
export class AlertasView {
  private clima = h('div', {}); private hist = h('div', {});

  async montar(raiz: HTMLElement): Promise<void> {
    raiz.append(
      h('section', { class: 'painel' }, h('div', { class: 'cabeca-painel' }, h('h2', {}, 'Previsão para aulas ao ar livre'),
        botao('Verificar agora', () => void this.carregarClima(), 'btn primario')), this.clima),
      h('section', { class: 'painel' }, h('h2', {}, 'Histórico de avisos'), this.hist));
    this.clima.append(vazio('Use “Verificar agora” para consultar a previsão das próximas aulas.'));
    await this.carregarHistorico();
  }

  private async carregarClima(): Promise<void> {
    this.clima.replaceChildren(vazio('Consultando a previsão…'));
    try {
      const lista = await chamar<AlertaChuva[]>('alertas:chuva');
      if (lista.length === 0) { this.clima.replaceChildren(vazio('Nenhuma aula ao ar livre nas próximas horas. Marque “Ao ar livre” nas aulas externas.')); return; }
      this.clima.replaceChildren(this.tabela(['Aula', 'Quando', 'Chuva', 'Situação'], lista.map((a) => [
        `${a.modalidade} — ${a.instrutor}${a.local ? ` (${a.local})` : ''}`,
        `${formatBR(a.data)} às ${a.hora}`,
        `${a.probabilidade}% · ${String(a.mm).replace('.', ',')} mm`,
        h('span', {}, a.vaiChover ? selo('Vai chover: remarcar para dentro', 'erro') : selo('Tempo firme', 'ok'),
          a.feriado ? selo(`Feriado: ${a.feriado}`, 'aviso') : null),
      ])));
      this.carregarHistorico();
    } catch (e) { this.clima.replaceChildren(vazio(e instanceof Error ? e.message : 'Falha ao consultar a previsão.')); }
  }


  private async carregarHistorico(): Promise<void> {
    const lista = await chamar<Aviso[]>('avisos:listar');
    this.hist.replaceChildren(lista.length ? this.tabela(['Quando', 'Tipo', 'Aluno', 'Mensagem', 'Canal', 'Status'], lista.map((a) => [
      a.criado_em.slice(0, 16).replace('T', ' ').split(' ').map((p, i) => (i === 0 ? formatBR(p) : p)).join(' '),
      a.tipo === 'chuva' ? 'Chuva' : 'Vencimento', a.aluno ?? '—', a.mensagem, a.canal, selo(a.status, TOM_ENVIO[a.status] ?? 'neutro'),
    ])) : vazio('Nenhum aviso registrado ainda.'));
  }




  private tabela(cabecalho: string[], linhas: (string | HTMLElement)[][]): HTMLElement {
    return h('div', { class: 'rolagem' }, h('table', {},
      h('thead', {}, h('tr', {}, ...cabecalho.map((c) => h('th', {}, c)))),
      h('tbody', {}, ...linhas.map((l) => h('tr', {}, ...l.map((c) => h('td', {}, c)))))));
  }
}
