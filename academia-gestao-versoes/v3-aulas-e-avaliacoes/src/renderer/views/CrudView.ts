import { chamar, ApiError } from '../api';
import { pode, type EntityDef, type Field, type Option } from '../../shared/entities';
import { hojeISO } from '../../shared/dates';
import type { Row, SessionUser } from '../../shared/types';
import { abrirDialogo, botao, confirmar, dataBR, formatarTel, h, mascararCpf, moeda, selo, toast, vazio, type Filho } from '../ui';

export interface Coluna { titulo: string; render: (linha: Row) => Filho }
export interface OpcoesCrud {
  buscar?: () => Promise<Row[]>;
  colunas?: Coluna[];
  extrasBarra?: HTMLElement[];
  acoesLinha?: (linha: Row, recarregar: () => Promise<void>) => HTMLElement[];
  aoMudar?: () => void;
}

const AVISO_EXCLUSAO: Record<string, string> = {
  alunos: ' Isso também apaga as matrículas, os pagamentos e as avaliações físicas deste aluno.',
  matriculas: ' Os pagamentos desta matrícula também serão apagados.',
};
type Controle = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Tela de CRUD genérica: tabela + busca + formulário, tudo gerado a partir dos metadados da entidade. */
export class CrudView {
  private linhas: Row[] = [];
  private busca = '';
  private area = h('div', { class: 'painel' });

  constructor(private readonly def: EntityDef, private readonly usuario: SessionUser, private readonly op: OpcoesCrud = {}) {}

  async montar(raiz: HTMLElement): Promise<void> {
    const pesquisa = h('input', { type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar', class: 'busca' });
    pesquisa.addEventListener('input', () => { this.busca = pesquisa.value.toLowerCase(); this.desenhar(); });
    const novo = pode(this.usuario.perfil, this.def.name, 'c')
      ? botao(`Cadastrar ${this.def.label.toLowerCase()}`, () => void this.formulario(), 'btn primario') : null;
    raiz.append(h('div', { class: 'barra' }, pesquisa, ...(this.op.extrasBarra ?? []), novo), this.area);
    await this.recarregar();
  }

  readonly recarregar = async (): Promise<void> => {
    this.linhas = await (this.op.buscar ? this.op.buscar() : chamar<Row[]>('crud:listar', { entidade: this.def.name }));
    this.desenhar();
  };

  private colunas(): Coluna[] {
    if (this.op.colunas) return this.op.colunas;
    return this.def.fields.filter((f) => f.list).map((f) => ({ titulo: f.label, render: (l) => this.celula(f, l) }));
  }

  private celula(f: Field, l: Row): Filho {
    const v = l[f.name];
    if (f.type === 'ref') return String(l[`${f.name}_label`] ?? '—');
    if (f.type === 'bool') return selo(v ? 'Sim' : 'Não', v ? 'ok' : 'neutro');
    if (v === null || v === undefined || v === '') return '—';
    switch (f.type) {
      case 'select': return f.options?.find((o) => o.value === v)?.label ?? String(v);
      case 'date': return dataBR(v);
      case 'cpf': return mascararCpf(v);
      case 'tel': return formatarTel(v);
      case 'number': return f.name.startsWith('valor') ? moeda(Number(v)) : String(v).replace('.', ',');
      default: return String(v);
    }
  }

  private desenhar(): void {
    const colunas = this.colunas();
    const visiveis = this.linhas.filter((l) => !this.busca || Object.values(l).join(' ').toLowerCase().includes(this.busca));
    this.area.replaceChildren();
    if (visiveis.length === 0) {
      this.area.append(vazio(this.linhas.length ? 'Nada encontrado para esta busca.' : `Nenhum registro ainda. Use “Cadastrar ${this.def.label.toLowerCase()}” para começar.`));
      return;
    }
    const podeEditar = pode(this.usuario.perfil, this.def.name, 'u');
    const podeExcluir = pode(this.usuario.perfil, this.def.name, 'd');
    const corpo = visiveis.map((l) => h('tr', {},
      ...colunas.map((c) => h('td', {}, c.render(l))),
      h('td', { class: 'acoes-linha' },
        ...(this.op.acoesLinha?.(l, this.recarregar) ?? []),
        podeEditar ? botao('Editar', () => void this.formulario(l), 'btn leve') : null,
        podeExcluir ? botao('Excluir', () => void this.excluir(l), 'btn leve perigo') : null)));
    this.area.append(h('div', { class: 'rolagem' }, h('table', {},
      h('thead', {}, h('tr', {}, ...colunas.map((c) => h('th', {}, c.titulo)), h('th', {}, ''))),
      h('tbody', {}, ...corpo))));
  }

  private async excluir(l: Row): Promise<void> {
    if (!(await confirmar(`Excluir este registro de ${this.def.label.toLowerCase()}?${AVISO_EXCLUSAO[this.def.name] ?? ''}`))) return;
    try {
      await chamar('crud:remover', { entidade: this.def.name, id: l.id });
      toast('Registro excluído.');
      await this.recarregar();
      this.op.aoMudar?.();
    } catch (e) { toast(e instanceof Error ? e.message : 'Falha ao excluir.', 'erro'); }
  }

  private async formulario(linha?: Row): Promise<void> {
    const campos = this.def.fields.filter((f) => !f.readonly);
    const refs = new Map<string, Option[]>();
    try {
      await Promise.all(campos.filter((f) => f.type === 'ref').map(async (f) =>
        refs.set(f.name, await chamar<Option[]>('crud:opcoes', { entidade: f.ref }))));
    } catch (e) { toast(e instanceof Error ? e.message : 'Falha ao carregar listas.', 'erro'); return; }

    const controles = new Map<string, Controle>();
    const erros = new Map<string, HTMLElement>();
    const grade = h('div', { class: 'grade-form' });
    for (const f of campos) {
      const ctl = this.controle(f, linha, refs.get(f.name));
      controles.set(f.name, ctl);
      const msg = h('small', { class: 'erro-campo' });
      erros.set(f.name, msg);
      const extra = f.type === 'cep' ? botao('Buscar endereço', () => void this.buscarCep(ctl as HTMLInputElement, controles), 'btn leve') : null;
      grade.append(h('label', { class: `campo ${f.type === 'textarea' || f.name === 'observacoes' ? 'largo' : ''} ${f.type === 'bool' ? 'check' : ''}` },
        h('span', {}, f.label + (f.required && !f.virtual ? ' *' : '')), h('div', { class: 'linha-campo' }, ctl, extra), msg));
    }
    const form = h('form', { novalidate: true }, grade);
    const salvar = h('button', { class: 'btn primario', type: 'submit' }, 'Salvar');
    const dlg = abrirDialogo(linha ? `Editar ${this.def.label.toLowerCase()}` : `Cadastrar ${this.def.label.toLowerCase()}`, form, [
      botao('Cancelar', () => dlg.close()), salvar]);
    salvar.setAttribute('form', 'form-crud');
    form.id = 'form-crud';
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      void (async () => {
        erros.forEach((m) => { m.textContent = ''; });
        const dados: Record<string, unknown> = {};
        controles.forEach((c, nome) => { dados[nome] = c instanceof HTMLInputElement && c.type === 'checkbox' ? c.checked : c.value; });
        try {
          if (linha) await chamar('crud:atualizar', { entidade: this.def.name, id: linha.id, dados });
          else await chamar('crud:criar', { entidade: this.def.name, dados });
          dlg.close();
          toast(`${this.def.label} salvo.`);
          await this.recarregar();
          this.op.aoMudar?.();
        } catch (e) {
          if (e instanceof ApiError && e.campos) Object.entries(e.campos).forEach(([k, m]) => { const alvo = erros.get(k); if (alvo) alvo.textContent = m; });
          toast(e instanceof Error ? e.message : 'Não foi possível salvar.', 'erro');
        }
      })();
    });
    controles.values().next().value?.focus();
  }

  private controle(f: Field, linha: Row | undefined, opcoes?: Option[]): Controle {
    const atual = linha ? linha[f.name] : (f.default ?? (f.type === 'date' && f.required ? hojeISO() : ''));
    const valor = atual === null || atual === undefined ? '' : String(atual);
    if (f.type === 'bool') return h('input', { type: 'checkbox', checked: linha ? atual === 1 : Number(f.default ?? 0) === 1 });
    if (f.type === 'textarea') { const t = h('textarea', { rows: 3, maxlength: f.maxLength ?? 500 }); t.value = valor; return t; }
    if (f.type === 'select' || f.type === 'ref') {
      const s = h('select', {}, h('option', { value: '' }, 'Selecione…'),
        ...(f.type === 'ref' ? opcoes ?? [] : f.options ?? []).map((o) => h('option', { value: String(o.value) }, o.label)));
      s.value = valor;
      return s;
    }
    const tipo = { number: 'number', date: 'date', time: 'time', password: 'password' }[f.type as string] ?? 'text';
    const i = h('input', {
      type: tipo, maxlength: f.maxLength, min: f.min, max: f.max, step: f.type === 'number' ? (f.step ?? 'any') : undefined,
      autocomplete: f.type === 'password' ? 'new-password' : 'off', inputmode: f.type === 'cpf' || f.type === 'cep' || f.type === 'tel' ? 'numeric' : undefined,
    });
    i.value = valor;
    return i;
  }

  private async buscarCep(cep: HTMLInputElement, controles: Map<string, Controle>): Promise<void> {
    try {
      const e = await chamar<Record<string, string>>('cep:buscar', { cep: cep.value });
      for (const k of ['logradouro', 'bairro', 'uf']) { const c = controles.get(k); if (c) c.value = e[k] ?? ''; }
      const cidade = controles.get('cidade'); if (cidade) cidade.value = e.cidade ?? '';
      toast('Endereço preenchido pelo CEP.');
    } catch (e) { toast(e instanceof Error ? e.message : 'CEP não encontrado.', 'erro'); }
  }
}
