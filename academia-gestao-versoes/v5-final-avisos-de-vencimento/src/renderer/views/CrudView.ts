// Tela genérica de CRUD: lista, busca, cadastro, edição e exclusão de qualquer entidade.
import { chamar, ApiError } from '../api';
import { pode, type EntityDef, type Field, type Option } from '../../shared/entities';
import { hojeISO } from '../../shared/dates';
import type { Row, SessionUser } from '../../shared/types';
import { abrirDialogo, botao, confirmar, dataBR, formatarTel, h, mascararCpf, moeda, selo, toast, vazio, type Filho } from '../ui';

// Coluna da tabela: título e como desenhar a célula
export interface Coluna { titulo: string; render: (linha: Row) => Filho }
// Personalizações opcionais (usadas em Pagamentos e Avaliações)
export interface OpcoesCrud {
  buscar?: () => Promise<Row[]>;
  colunas?: Coluna[];
  extrasBarra?: HTMLElement[];
  acoesLinha?: (linha: Row, recarregar: () => Promise<void>) => HTMLElement[];
  aoMudar?: () => void;
}

// Aviso extra ao excluir quando há dados ligados (exclusão em cascata)
const AVISO_EXCLUSAO: Record<string, string> = {
  alunos: ' Isso também apaga as matrículas, os pagamentos e as avaliações físicas deste aluno.',
  matriculas: ' Os pagamentos desta matrícula também serão apagados.',
};
// Tipos de campo de formulário
type Controle = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
// Exemplos de preenchimento mostrados dentro dos campos
const DICAS: Partial<Record<Field['type'], string>> = {
  cpf: '000.000.000-00', cep: '00000-000', tel: '(11) 91234-5678', email: 'nome@exemplo.com',
};

/** Tela de CRUD genérica: tabela + busca + formulário, tudo gerado a partir dos metadados da entidade. */
export class CrudView {
  // Registros carregados, texto da busca e área da tabela
  private linhas: Row[] = [];
  private busca = '';
  private area = h('div', { class: 'painel' });
  // Linhas entram com fade só na primeira carga; a busca não reanima
  private primeiraCarga = true;
  // Campo de busca e temporizador do filtro (evita redesenhar a tabela a cada tecla)
  private campoBusca: HTMLInputElement | null = null;
  private timerBusca: number | undefined;

  constructor(private readonly def: EntityDef, private readonly usuario: SessionUser, private readonly op: OpcoesCrud = {}) {}

  // Monta a barra (busca + botão Cadastrar) e carrega a lista
  async montar(raiz: HTMLElement): Promise<void> {
    const pesquisa = h('input', { type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar', class: 'busca' });
    this.campoBusca = pesquisa;
    pesquisa.addEventListener('input', () => {
      this.busca = pesquisa.value.toLowerCase();
      // Espera o usuário parar de digitar antes de redesenhar a tabela
      window.clearTimeout(this.timerBusca);
      this.timerBusca = window.setTimeout(() => this.desenhar(), 140);
    });
    // O botão Cadastrar só aparece para quem pode criar
    const novo = pode(this.usuario.perfil, this.def.name, 'c')
      ? botao(`Cadastrar ${this.def.label.toLowerCase()}`, () => void this.formulario(), 'btn primario') : null;
    raiz.append(h('div', { class: 'barra' }, pesquisa, ...(this.op.extrasBarra ?? []), novo), this.area);
    await this.recarregar();
  }

  // Busca os registros no main e redesenha a tabela
  readonly recarregar = async (): Promise<void> => {
    this.linhas = await (this.op.buscar ? this.op.buscar() : chamar<Row[]>('crud:listar', { entidade: this.def.name }));
    this.desenhar();
  };

  // Colunas: as personalizadas ou as marcadas como "list" na entidade
  private colunas(): Coluna[] {
    if (this.op.colunas) return this.op.colunas;
    return this.def.fields.filter((f) => f.list).map((f) => ({ titulo: f.label, render: (l) => this.celula(f, l) }));
  }

  // Formata o valor da célula conforme o tipo (CPF mascarado, data, moeda...)
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

  // Desenha a tabela com busca e botões Editar e Excluir
  private desenhar(): void {
    const colunas = this.colunas();
    const visiveis = this.linhas.filter((l) => !this.busca || Object.values(l).join(' ').toLowerCase().includes(this.busca));
    // Contagem: mostra o filtro ativo sem esconder o total (inclusive quando a busca não acha nada)
    const total = this.linhas.length;
    const contagem = visiveis.length === total
      ? `${total} ${total === 1 ? 'registro' : 'registros'}`
      : `${visiveis.length} de ${total} registros`;
    this.area.replaceChildren();
    // Os botões dependem da permissão do perfil
    const podeCriar = pode(this.usuario.perfil, this.def.name, 'c');
    const podeEditar = pode(this.usuario.perfil, this.def.name, 'u');
    const podeExcluir = pode(this.usuario.perfil, this.def.name, 'd');
    if (visiveis.length === 0) {
      const semRegistros = this.linhas.length === 0;
      // Lista vazia: oferece a ação que resolve o problema (cadastrar ou limpar a busca)
      const acao = semRegistros
        ? (podeCriar ? botao(`Cadastrar ${this.def.label.toLowerCase()}`, () => void this.formulario(), 'btn primario') : null)
        : botao('Limpar busca', () => {
          if (this.campoBusca) this.campoBusca.value = '';
          this.busca = '';
          this.desenhar();
        }, 'btn leve');
      this.area.append(h('div', { class: 'tabela-vazio' },
        vazio(semRegistros
          ? `Nenhum registro ainda. Use “Cadastrar ${this.def.label.toLowerCase()}” para começar.`
          : 'Nada encontrado para esta busca.'),
        acao));
      if (!semRegistros) this.area.append(h('div', { class: 'tabela-rodape' }, contagem));
      return;
    }
    const corpo = visiveis.map((l) => h('tr', {},
      ...colunas.map((c) => h('td', {}, c.render(l))),
      h('td', { class: 'acoes-linha' },
        ...(this.op.acoesLinha?.(l, this.recarregar) ?? []),
        podeEditar ? botao('Editar', () => void this.formulario(l), 'btn leve', `Editar este registro de ${this.def.label.toLowerCase()}`) : null,
        podeExcluir ? botao('Excluir', () => void this.excluir(l), 'btn leve perigo', `Excluir este registro de ${this.def.label.toLowerCase()}`) : null)));
    this.area.append(
      h('div', { class: 'rolagem' }, h('table', { 'aria-label': this.def.plural },
        h('thead', {}, h('tr', {}, ...colunas.map((c) => h('th', {}, c.titulo)), h('th', {}, ''))),
        h('tbody', { class: this.primeiraCarga ? 'entrando' : '' }, ...corpo))),
      h('div', { class: 'tabela-rodape' }, contagem));
    this.primeiraCarga = false;
  }

  // DELETE: confirma e exclui o registro
  private async excluir(l: Row): Promise<void> {
    if (!(await confirmar(`Excluir este registro de ${this.def.label.toLowerCase()}?${AVISO_EXCLUSAO[this.def.name] ?? ''}`))) return;
    try {
      await chamar('crud:remover', { entidade: this.def.name, id: l.id });
      toast('Registro excluído.');
      await this.recarregar();
      this.op.aoMudar?.();
    } catch (e) { toast(e instanceof Error ? e.message : 'Falha ao excluir.', 'erro'); }
  }

  // Abre o formulário de cadastro (CREATE) ou edição (UPDATE)
  private async formulario(linha?: Row): Promise<void> {
    const campos = this.def.fields.filter((f) => !f.readonly);
    // Opções das listas de referência (ex.: alunos, planos), buscadas no main
    const refs = new Map<string, Option[]>();
    try {
      await Promise.all(campos.filter((f) => f.type === 'ref').map(async (f) =>
        refs.set(f.name, await chamar<Option[]>('crud:opcoes', { entidade: f.ref }))));
    } catch (e) { toast(e instanceof Error ? e.message : 'Falha ao carregar listas.', 'erro'); return; }

    // Cria um campo para cada propriedade da entidade (o CEP ganha o botão "Buscar endereço")
    const controles = new Map<string, Controle>();
    const erros = new Map<string, HTMLElement>();
    const caixas = new Map<string, HTMLElement>();
    const grade = h('div', { class: 'grade-form' });
    for (const f of campos) {
      const ctl = this.controle(f, linha, refs.get(f.name));
      controles.set(f.name, ctl);
      // Cada erro tem um id próprio: o leitor de tela liga o campo à mensagem
      const idErro = `erro-${this.def.name}-${f.name}`;
      const msg = h('small', { class: 'erro-campo', id: idErro });
      erros.set(f.name, msg);
      ctl.setAttribute('aria-describedby', idErro);
      let botaoCep: HTMLButtonElement | null = null;
      if (f.type === 'cep') {
        botaoCep = botao('Buscar endereço', () => {
          if (botaoCep) void this.buscarCep(ctl as HTMLInputElement, controles, botaoCep);
        }, 'btn leve', 'Preenche o endereço a partir do CEP (ViaCEP)');
      }
      const caixa = h('label', { class: `campo ${f.type === 'textarea' || f.name === 'observacoes' ? 'largo' : ''} ${f.type === 'bool' ? 'check' : ''}` },
        h('span', {}, f.label + (f.required && !f.virtual ? ' *' : '')), h('div', { class: 'linha-campo' }, ctl, botaoCep), msg);
      caixas.set(f.name, caixa);
      grade.append(caixa);
    }
    // Monta o diálogo com o formulário
    const form = h('form', { novalidate: true }, grade);
    const salvar = h('button', { class: 'btn primario', type: 'submit' }, 'Salvar');
    const dlg = abrirDialogo(linha ? `Editar ${this.def.label.toLowerCase()}` : `Cadastrar ${this.def.label.toLowerCase()}`, form, [
      botao('Cancelar', () => dlg.close()), salvar]);
    salvar.setAttribute('form', 'form-crud');
    form.id = 'form-crud';
    // Ao salvar: envia os dados; os erros do main aparecem embaixo de cada campo
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (salvar.disabled) return;
      // Limpa os erros anteriores antes de tentar de novo
      erros.forEach((m) => { m.textContent = ''; });
      controles.forEach((c, nome) => { c.removeAttribute('aria-invalid'); caixas.get(nome)?.classList.remove('invalido'); });
      salvar.disabled = true;
      salvar.textContent = 'Salvando…';
      void (async () => {
        const dados: Record<string, unknown> = {};
        controles.forEach((c, nome) => { dados[nome] = c instanceof HTMLInputElement && c.type === 'checkbox' ? c.checked : c.value; });
        try {
          if (linha) await chamar('crud:atualizar', { entidade: this.def.name, id: linha.id, dados });
          else await chamar('crud:criar', { entidade: this.def.name, dados });
          dlg.close();
          toast(linha ? 'Alterações salvas.' : 'Registro cadastrado.');
          await this.recarregar();
          this.op.aoMudar?.();
        } catch (e) {
          if (e instanceof ApiError && e.campos) {
            Object.entries(e.campos).forEach(([k, m]) => {
              const alvo = erros.get(k);
              if (!alvo) return;
              alvo.textContent = m;
              controles.get(k)?.setAttribute('aria-invalid', 'true');
              caixas.get(k)?.classList.add('invalido');
            });
          }
          toast(e instanceof Error ? e.message : 'Não foi possível salvar.', 'erro');
        } finally {
          salvar.disabled = false;
          salvar.textContent = 'Salvar';
        }
      })();
    });
    controles.values().next().value?.focus();
  }

  // Cria o controle certo para o tipo do campo (checkbox, texto, lista, data...)
  private controle(f: Field, linha: Row | undefined, opcoes?: Option[]): Controle {
    const atual = linha ? linha[f.name] : (f.default ?? (f.type === 'date' && f.required ? hojeISO() : ''));
    const valor = atual === null || atual === undefined ? '' : String(atual);
    const obrigatorio = f.required ? 'true' : undefined;
    if (f.type === 'bool') return h('input', { type: 'checkbox', checked: linha ? atual === 1 : Number(f.default ?? 0) === 1 });
    if (f.type === 'textarea') { const t = h('textarea', { rows: 3, maxlength: f.maxLength ?? 500, 'aria-required': obrigatorio }); t.value = valor; return t; }
    if (f.type === 'select' || f.type === 'ref') {
      const s = h('select', { 'aria-required': obrigatorio }, h('option', { value: '' }, 'Selecione…'),
        ...(f.type === 'ref' ? opcoes ?? [] : f.options ?? []).map((o) => h('option', { value: String(o.value) }, o.label)));
      s.value = valor;
      return s;
    }
    const tipo = { number: 'number', date: 'date', time: 'time', password: 'password' }[f.type as string] ?? 'text';
    const i = h('input', {
      type: tipo, maxlength: f.maxLength, min: f.min, max: f.max, step: f.type === 'number' ? (f.step ?? 'any') : undefined,
      autocomplete: f.type === 'password' ? 'new-password' : 'off', inputmode: f.type === 'cpf' || f.type === 'cep' || f.type === 'tel' ? 'numeric' : undefined,
      placeholder: DICAS[f.type], 'aria-required': obrigatorio,
    });
    i.value = valor;
    return i;
  }

  // Botão "Buscar endereço": consulta a API ViaCEP e preenche o endereço
  private async buscarCep(cep: HTMLInputElement, controles: Map<string, Controle>, botao: HTMLButtonElement): Promise<void> {
    const rotulo = botao.textContent ?? 'Buscar endereço';
    botao.disabled = true;
    botao.textContent = 'Buscando…';
    try {
      const e = await chamar<Record<string, string>>('cep:buscar', { cep: cep.value });
      for (const k of ['logradouro', 'bairro', 'cidade', 'uf']) {
        const c = controles.get(k);
        if (!c) continue;
        c.value = e[k] ?? '';
        // Destaca o que veio da API e some assim que o usuário editar o campo
        c.classList.add('preenchido');
        c.addEventListener('input', () => c.classList.remove('preenchido'), { once: true });
      }
      toast('Endereço preenchido pelo CEP. Confira o número.');
    } catch (e) { toast(e instanceof Error ? e.message : 'CEP não encontrado.', 'erro'); }
    finally {
      botao.disabled = false;
      botao.textContent = rotulo;
    }
  }
}
