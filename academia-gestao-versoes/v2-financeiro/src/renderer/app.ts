import { chamar } from './api';
import { ENTITIES, pode, type EntityName, type Perfil } from '../shared/entities';
import type { SessionUser } from '../shared/types';
import { botao, h, limparNo, toast } from './ui';
import { CrudView } from './views/CrudView';
import { DashboardView } from './views/DashboardView';
import { LoginView } from './views/LoginView';
import { PagamentosView } from './views/PagamentosView';

interface Pagina { id: string; titulo: string; visivel: (u: SessionUser) => boolean; montar: (raiz: HTMLElement, u: SessionUser) => Promise<void> }

const GESTAO: Perfil[] = ['admin', 'recepcao'];
const crud = (e: EntityName, titulo = ENTITIES[e].plural): Pagina => ({
  id: e, titulo, visivel: (u) => pode(u.perfil, e, 'r'), montar: (r, u) => new CrudView(ENTITIES[e], u).montar(r),
});

const PAGINAS: Pagina[] = [
  { id: 'painel', titulo: 'Painel', visivel: () => true, montar: (r) => new DashboardView().montar(r) },
  crud('alunos'), crud('matriculas'),
  { id: 'pagamentos', titulo: 'Pagamentos', visivel: (u) => GESTAO.includes(u.perfil), montar: (r, u) => new PagamentosView(u).montar(r) },
  crud('modalidades'), crud('instrutores'), crud('planos'),
  crud('usuarios'),
];
const PERFIL: Record<Perfil, string> = { admin: 'Administrador', recepcao: 'Recepção', instrutor: 'Instrutor' };

class App {
  private readonly raiz = document.getElementById('raiz')!;

  async iniciar(): Promise<void> {
    const st = await chamar<{ precisaConfigurar: boolean; usuario: SessionUser | null }>('auth:status');
    if (st.usuario) this.shell(st.usuario);
    else new LoginView(st.precisaConfigurar, (u) => this.shell(u)).montar(this.raiz);
  }

  private shell(usuario: SessionUser): void {
    const paginas = PAGINAS.filter((p) => p.visivel(usuario));
    const conteudo = h('main', { class: 'conteudo', id: 'conteudo' });
    const itens = new Map<string, HTMLButtonElement>();
    const ir = async (p: Pagina): Promise<void> => {
      itens.forEach((b, id) => { b.classList.toggle('ativo', id === p.id); b.toggleAttribute('aria-current', id === p.id); });
      itens.get(p.id)?.classList.remove('com-aviso');
      limparNo(conteudo);
      const corpo = h('div', { class: 'corpo' });
      conteudo.append(h('header', { class: 'topo' }, h('h1', {}, p.titulo)), corpo);
      try { await p.montar(corpo, usuario); }
      catch (e) { corpo.append(h('p', { class: 'vazio' }, e instanceof Error ? e.message : 'Não foi possível carregar esta tela.')); }
    };
    for (const p of paginas) itens.set(p.id, h('button', { class: 'nav-item', type: 'button', onclick: () => void ir(p) }, p.titulo));
    const sair = botao('Sair', () => void chamar('auth:sair').then(() => this.iniciar()), 'btn leve claro');
    this.raiz.replaceChildren(h('div', { class: 'app' },
      h('nav', { class: 'lateral', 'aria-label': 'Menu principal' },
        h('div', { class: 'marca' }, 'Gestão de', h('br'), 'Academia'),
        h('div', { class: 'nav-lista' }, ...itens.values()),
        h('div', { class: 'usuario' }, h('strong', {}, usuario.nome), h('span', {}, PERFIL[usuario.perfil]), sair)),
      conteudo));
    void ir(paginas[0]);
  }
}

void new App().iniciar().catch((e) => toast(e instanceof Error ? e.message : 'Falha ao iniciar.', 'erro'));
