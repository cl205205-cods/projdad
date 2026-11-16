import { chamar } from '../api';
import { ENTITIES, type Option } from '../../shared/entities';
import type { PontoAvaliacao, SessionUser } from '../../shared/types';
import { graficoLinha, h, numeroBR, toast, vazio } from '../ui';
import { CrudView } from './CrudView';

/** Avaliações físicas: CRUD completo + painel de evolução (peso, IMC, cintura) por aluno. */
export class AvaliacoesView {
  private seletor = h('select', { 'aria-label': 'Aluno' });
  private saida = h('div', {});

  constructor(private readonly usuario: SessionUser) {}

  async montar(raiz: HTMLElement): Promise<void> {
    const painel = h('section', { class: 'painel evolucao' },
      h('div', { class: 'cabeca-painel' }, h('h2', {}, 'Evolução do aluno'), this.seletor), this.saida);
    const crud = new CrudView(ENTITIES.avaliacoes, this.usuario, { aoMudar: () => void this.atualizar() });
    await crud.montar(raiz);
    raiz.append(painel);
    const alunos = await chamar<Option[]>('crud:opcoes', { entidade: 'alunos' });
    this.seletor.append(h('option', { value: '' }, 'Escolha um aluno…'), ...alunos.map((a) => h('option', { value: String(a.value) }, a.label)));
    this.seletor.addEventListener('change', () => void this.atualizar());
    this.saida.append(vazio('Escolha um aluno para ver peso, IMC e medidas ao longo do tempo.'));
  }

  private async atualizar(): Promise<void> {
    if (!this.seletor.value) return;
    try {
      const pts = await chamar<PontoAvaliacao[]>('avaliacoes:evolucao', { alunoId: Number(this.seletor.value) });
      this.saida.replaceChildren(this.resumo(pts));
    } catch (e) { toast(e instanceof Error ? e.message : 'Falha ao carregar a evolução.', 'erro'); }
  }

  private resumo(pts: PontoAvaliacao[]): HTMLElement {
    if (pts.length === 0) return vazio('Este aluno ainda não tem avaliações.');
    const serie = (k: 'peso_kg' | 'cintura_cm' | 'gordura_pct' | 'imc'): { x: string; y: number }[] =>
      pts.filter((p) => p[k] !== null).map((p) => ({ x: p.data, y: Number(p[k]) }));
    const delta = (rotulo: string, un: string, s: { y: number }[]): HTMLElement | null => {
      if (s.length < 2) return null;
      const d = s[s.length - 1].y - s[0].y;
      return h('li', { class: d < 0 ? 'baixou' : d > 0 ? 'subiu' : '' },
        h('strong', {}, `${d > 0 ? '+' : ''}${numeroBR(Math.round(d * 10) / 10)} ${un}`), ` em ${rotulo.toLowerCase()} desde a primeira avaliação`);
    };
    const peso = serie('peso_kg'), cintura = serie('cintura_cm'), gordura = serie('gordura_pct'), imc = serie('imc');
    const graficos = [['Peso', 'kg', peso], ['Cintura', 'cm', cintura], ['Gordura corporal', '%', gordura], ['IMC', '', imc]] as const;
    const itens = [delta('Peso', 'kg', peso), delta('Cintura', 'cm', cintura), delta('Gordura corporal', 'p.p.', gordura)].filter(Boolean);
    return h('div', {},
      itens.length ? h('ul', { class: 'deltas' }, ...itens) : vazio('Registre ao menos duas avaliações para comparar a evolução.'),
      h('div', { class: 'graficos' }, ...graficos.filter(([, , s]) => s.length >= 2).map(([t, u, s]) => graficoLinha(t, u, [...s]))));
  }
}
