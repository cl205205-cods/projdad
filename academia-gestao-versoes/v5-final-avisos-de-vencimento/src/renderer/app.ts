// Interface principal: monta o menu lateral e abre cada página conforme o perfil do usuário.
import { chamar } from './api';
import { ENTITIES, pode, type EntityName, type Perfil } from '../shared/entities';
import type { AlertaChuva, SessionUser } from '../shared/types';
import { botao, h, limparNo, toast } from './ui';
import { AlertasView } from './views/AlertasView';
import { AvaliacoesView } from './views/AvaliacoesView';
import { ConfigView } from './views/ConfigView';
import { CrudView } from './views/CrudView';
import { DashboardView } from './views/DashboardView';
import { LoginView } from './views/LoginView';
import { PagamentosView } from './views/PagamentosView';

// Uma página do menu: nome, quem pode ver e como desenhá-la
interface Pagina { id: string; titulo: string; visivel: (u: SessionUser) => boolean; montar: (raiz: HTMLElement, u: SessionUser) => Promise<void> }

// Perfis de gestão (administrador e recepção)
const GESTAO: Perfil[] = ['admin', 'recepcao'];
// Cria a página de CRUD de uma entidade (tabela + formulário)
const crud = (e: EntityName, titulo = ENTITIES[e].plural): Pagina => ({
  id: e, titulo, visivel: (u) => pode(u.perfil, e, 'r'), montar: (r, u) => new CrudView(ENTITIES[e], u).montar(r),
});

// Páginas do menu (a visibilidade segue o perfil)
const PAGINAS: Pagina[] = [
  // Página: Painel (resumo do dia)
  { id: 'painel', titulo: 'Painel', visivel: () => true, montar: (r) => new DashboardView().montar(r) },
  // Páginas: Alunos e Matrículas
  crud('alunos'), crud('matriculas'),
  // Página: Pagamentos (só administrador e recepção)
  { id: 'pagamentos', titulo: 'Pagamentos', visivel: (u) => GESTAO.includes(u.perfil), montar: (r, u) => new PagamentosView(u).montar(r) },
  // Página: Avaliações físicas
  { id: 'avaliacoes', titulo: 'Avaliações físicas', visivel: (u) => pode(u.perfil, 'avaliacoes', 'r'), montar: (r, u) => new AvaliacoesView(u).montar(r) },
  // Páginas: Aulas, Modalidades, Instrutores e Planos
  crud('aulas'), crud('modalidades'), crud('instrutores'), crud('planos'),
  // Página: Clima e avisos
  { id: 'alertas', titulo: 'Clima e avisos', visivel: (u) => GESTAO.includes(u.perfil), montar: (r) => new AlertasView().montar(r) },
  // Página: Usuários (só administrador)
  crud('usuarios'),
  // Página: Configurações (só administrador)
  { id: 'config', titulo: 'Configurações', visivel: (u) => u.perfil === 'admin', montar: (r) => new ConfigView().montar(r) },
];
// Nome de cada perfil para exibir
const PERFIL: Record<Perfil, string> = { admin: 'Administrador', recepcao: 'Recepção', instrutor: 'Instrutor' };

// Classe que controla o login e o layout da aplicação
class App {
  // Elemento onde tudo é desenhado
  private readonly raiz = document.getElementById('raiz')!;

  // Verifica a sessão: abre o sistema se já logado; senão mostra o login/primeiro acesso
  async iniciar(): Promise<void> {
    const st = await chamar<{ precisaConfigurar: boolean; usuario: SessionUser | null }>('auth:status');
    if (st.usuario) this.shell(st.usuario);
    else new LoginView(st.precisaConfigurar, (u) => this.shell(u)).montar(this.raiz);
  }

  // Desenha o layout (menu lateral + conteúdo) para o usuário logado
  private shell(usuario: SessionUser): void {
    // Só as páginas permitidas ao perfil
    const paginas = PAGINAS.filter((p) => p.visivel(usuario));
    const conteudo = h('main', { class: 'conteudo', id: 'conteudo' });
    const itens = new Map<string, HTMLButtonElement>();
    // Troca de página: marca o menu, limpa o conteúdo e monta a nova tela
    const ir = async (p: Pagina): Promise<void> => {
      itens.forEach((b, id) => { b.classList.toggle('ativo', id === p.id); b.toggleAttribute('aria-current', id === p.id); });
      itens.get(p.id)?.classList.remove('com-aviso');
      limparNo(conteudo);
      const corpo = h('div', { class: 'corpo' });
      conteudo.append(h('header', { class: 'topo' }, h('h1', {}, p.titulo)), corpo);
      try { await p.montar(corpo, usuario); }
      catch (e) { corpo.append(h('p', { class: 'vazio' }, e instanceof Error ? e.message : 'Não foi possível carregar esta tela.')); }
    };
    // Cria um botão de menu para cada página
    for (const p of paginas) itens.set(p.id, h('button', { class: 'nav-item', type: 'button', onclick: () => void ir(p) }, p.titulo));
    // Botão Sair: encerra a sessão e volta ao login
    const sair = botao('Sair', () => void chamar('auth:sair').then(() => this.iniciar()), 'btn leve claro');
    // Monta o menu lateral (marca, páginas, usuário) e a área de conteúdo
    this.raiz.replaceChildren(h('div', { class: 'app' },
      h('nav', { class: 'lateral', 'aria-label': 'Menu principal' },
        h('div', { class: 'marca' }, 'Gestão de', h('br'), 'Academia'),
        h('div', { class: 'nav-lista' }, ...itens.values()),
        h('div', { class: 'usuario' }, h('strong', {}, usuario.nome), h('span', {}, PERFIL[usuario.perfil]), sair)),
      conteudo));
    // Alerta de chuva: mostra aviso e destaca o menu "Clima e avisos"
    window.api.aoReceberAlerta((a: AlertaChuva) => {
      toast(`Chuva prevista (${a.probabilidade}%) na aula de ${a.modalidade} às ${a.hora}. Considere remarcar.`, 'aviso');
      itens.get('alertas')?.classList.add('com-aviso');
    });
    // Abre a primeira página (Painel)
    void ir(paginas[0]);
  }
}

// Ponto de entrada da interface
void new App().iniciar().catch((e) => toast(e instanceof Error ? e.message : 'Falha ao iniciar.', 'erro'));
