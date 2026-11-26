// Página: Relatórios (cada perfil recebe indicadores, gráficos e tabela próprios, montados no main).
import { chamar } from '../api';
import type { PeriodoRelatorio, Relatorio } from '../../shared/types';
import { botao, formatarValor, graficoBarras, graficoLinha, graficoRosca, h, selo, toast, vazio } from '../ui';

// Períodos oferecidos no filtro
const PERIODOS: { valor: PeriodoRelatorio; rotulo: string }[] = [
  { valor: 3, rotulo: 'Últimos 3 meses' },
  { valor: 6, rotulo: 'Últimos 6 meses' },
  { valor: 12, rotulo: 'Últimos 12 meses' },
];
// Nome do perfil exibido ao lado do título
const NOME_PERFIL: Record<Relatorio['perfil'], string> = { admin: 'Administrador', recepcao: 'Recepção', instrutor: 'Instrutor' };

/** Relatórios: filtro de período, exportação em CSV e visualização em KPIs, gráficos e tabela. */
export class RelatoriosView {
  // Área onde o relatório é desenhado
  private readonly saida = h('div', { class: 'relatorios' });
  // Entrada dos KPIs só na primeira carga (trocar o período não reanima)
  private primeiraCarga = true;

  // Monta a barra de filtros e carrega o período inicial
  async montar(raiz: HTMLElement): Promise<void> {
    const periodo = h('select', { 'aria-label': 'Período do relatório' },
      ...PERIODOS.map((p) => h('option', { value: String(p.valor) }, p.rotulo)));
    periodo.value = '6';
    // Exporta o relatório do período escolhido (o main abre o "Salvar como")
    const exportar = botao('Exportar CSV', () => void this.exportar(Number(periodo.value), exportar), 'btn',
      'Salvar este relatório em uma planilha CSV');
    raiz.append(
      h('div', { class: 'barra' },
        h('span', { class: 'filtro-rotulo' }, 'Período'), periodo,
        h('div', { class: 'espaco' }), exportar),
      this.saida);
    periodo.addEventListener('change', () => void this.carregar(Number(periodo.value)));
    await this.carregar(6);
  }

  // Busca o relatório do perfil logado e redesenha a tela
  private async carregar(periodo: number): Promise<void> {
    this.saida.setAttribute('aria-busy', 'true');
    this.saida.replaceChildren(h('p', { class: 'carregando', role: 'status' },
      h('span', { class: 'giro', 'aria-hidden': 'true' }), 'Carregando relatório…'));
    try {
      const r = await chamar<Relatorio>('relatorios:obter', { periodo });
      this.saida.replaceChildren(...this.desenhar(r));
    } catch (e) {
      this.saida.replaceChildren(vazio(e instanceof Error ? e.message : 'Não foi possível carregar o relatório.'));
    } finally {
      this.saida.removeAttribute('aria-busy');
    }
  }

  // Botão "Exportar CSV": pede ao main para gerar e salvar o arquivo
  private async exportar(periodo: number, el: HTMLButtonElement): Promise<void> {
    const rotulo = el.textContent ?? 'Exportar CSV';
    el.disabled = true;
    el.textContent = 'Gerando…';
    try {
      const r = await chamar<{ salvo: boolean }>('relatorios:exportar', { periodo });
      toast(r.salvo ? 'Relatório salvo em CSV.' : 'Exportação cancelada.', r.salvo ? 'ok' : 'aviso');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível salvar o relatório.', 'erro');
    } finally {
      el.disabled = false;
      el.textContent = rotulo;
    }
  }

  // Monta o conteúdo visual do relatório
  private desenhar(r: Relatorio): HTMLElement[] {
    // Cabeçalho com o título, o perfil e a explicação do que está sendo mostrado
    const cabecalho = h('section', { class: 'painel' },
      h('div', { class: 'cabeca-painel' }, h('h2', {}, r.titulo), selo(NOME_PERFIL[r.perfil], 'info')),
      h('p', { class: 'descricao' }, r.descricao));
    // Indicadores numéricos
    const kpis = h('section', { class: `kpis${this.primeiraCarga ? ' entrando' : ''}`, 'aria-label': 'Indicadores' }, ...r.kpis.map((k) =>
      h('div', { class: `kpi ${k.tom ?? ''}`, title: k.detalhe },
        h('span', { class: 'kpi-rotulo' }, k.rotulo),
        h('strong', { class: 'kpi-valor' }, formatarValor(k.valor, k.formato)),
        k.detalhe ? h('span', { class: 'kpi-detalhe' }, k.detalhe) : null)));
    // Gráficos: linha, barras e rosca, sempre em SVG
    const graficos = r.graficos.map((g) => g.tipo === 'rosca'
      ? graficoRosca(g.titulo, g.dados, g.formato)
      : g.tipo === 'barras'
        ? graficoBarras(g.titulo, g.unidade ?? '', g.dados, g.formato)
        : graficoLinha(g.titulo, g.unidade ?? '', g.dados.map((d) => ({ x: d.rotulo, y: d.valor })), { formato: g.formato }));
    // Tabela detalhada do período
    const tabela = h('section', { class: 'painel' },
      h('h2', {}, r.tabela.titulo),
      r.tabela.linhas.length === 0
        ? vazio('Nenhum registro no período selecionado.')
        : h('div', { class: 'rolagem' }, h('table', { 'aria-label': r.tabela.titulo },
          h('thead', {}, h('tr', {}, ...r.tabela.colunas.map((c) => h('th', {}, c)))),
          h('tbody', {}, ...r.tabela.linhas.map((linha) => h('tr', {}, ...linha.map((c) => h('td', {}, c))))))));
    this.primeiraCarga = false;
    return [cabecalho, kpis, h('div', { class: 'graficos' }, ...graficos), tabela];
  }
}
