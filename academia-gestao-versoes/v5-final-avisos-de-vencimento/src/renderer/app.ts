// Interface principal: monta o menu lateral e abre cada página conforme o perfil do usuário.
import { chamar } from './api';
import { ENTITIES, pode, type EntityName, type Perfil } from '../shared/entities';
import type { AlertaChuva, SessionUser } from '../shared/types';
import { botao, esqueleto, h, limparNo, toast } from './ui';
import { AlertasView } from './views/AlertasView';
import { AvaliacoesView } from './views/AvaliacoesView';
import { ConfigView } from './views/ConfigView';
import { CrudView } from './views/CrudView';
import { DashboardView } from './views/DashboardView';
import { LoginView } from './views/LoginView';
import { PagamentosView } from './views/PagamentosView';
import { RelatoriosView } from './views/RelatoriosView';

// Uma página do menu: nome, grupo, quem pode ver e como desenhá-la
interface Pagina {
  id: string; titulo: string; grupo: string;
  visivel: (u: SessionUser) => boolean;
  montar: (raiz: HTMLElement, u: SessionUser) => Promise<void>;
}

// Perfis de gestão (administrador e recepção)
const GESTAO: Perfil[] = ['admin', 'recepcao'];
// Cria a página de CRUD de uma entidade (tabela + formulário)
const crud = (e: EntityName, grupo: string, titulo = ENTITIES[e].plural): Pagina => ({
  id: e, titulo, grupo, visivel: (u) => pode(u.perfil, e, 'r'), montar: (r, u) => new CrudView(ENTITIES[e], u).montar(r),
});

// Páginas do menu (a visibilidade segue o perfil; a ordem segue o uso no dia a dia)
const PAGINAS: Pagina[] = [
  // Visão geral
  { id: 'painel', titulo: 'Painel', grupo: 'Visão geral', visivel: () => true, montar: (r, u) => new DashboardView().montar(r, u) },
  { id: 'relatorios', titulo: 'Relatórios', grupo: 'Visão geral', visivel: () => true, montar: (r) => new RelatoriosView().montar(r) },
  // Pessoas
  crud('alunos', 'Pessoas'), crud('instrutores', 'Pessoas'),
  // Academia
  crud('planos', 'Academia'), crud('matriculas', 'Academia'), crud('aulas', 'Academia'), crud('modalidades', 'Academia'),
  { id: 'avaliacoes', titulo: 'Avaliações físicas', grupo: 'Academia', visivel: (u) => pode(u.perfil, 'avaliacoes', 'r'), montar: (r, u) => new AvaliacoesView(u).montar(r) },
  // Financeiro
  { id: 'pagamentos', titulo: 'Pagamentos', grupo: 'Financeiro', visivel: (u) => GESTAO.includes(u.perfil), montar: (r, u) => new PagamentosView(u).montar(r) },
  // Operação
  { id: 'alertas', titulo: 'Clima e avisos', grupo: 'Operação', visivel: (u) => GESTAO.includes(u.perfil), montar: (r) => new AlertasView().montar(r) },
  // Sistema
  crud('usuarios', 'Sistema'),
  { id: 'config', titulo: 'Configurações', grupo: 'Sistema', visivel: (u) => u.perfil === 'admin', montar: (r) => new ConfigView().montar(r) },
];
// Nome de cada perfil para exibir
const PERFIL: Record<Perfil, string> = { admin: 'Administrador', recepcao: 'Recepção', instrutor: 'Instrutor' };

// Classe que controla o login e o layout da aplicação
class App {
  // Elemento onde tudo é desenhado
  private readonly raiz = document.getElementById('raiz')!;
  // Navegação atual (usada pelos atalhos do Painel e pelo menu nativo)
  private irPara: ((id: string) => void) | null = null;
  // Recarrega a tela atual (comando "Atualizar conteúdo" do menu)
  private atualizarTela: (() => void) | null = null;

  constructor() {
    // Atalhos do Painel pedem a troca de tela por evento (sem acoplar as telas ao App)
    window.addEventListener('app:navegar', (ev) => {
      const id = (ev as CustomEvent<string>).detail;
      if (typeof id === 'string') this.irPara?.(id);
    });
    // Comandos do menu nativo e da bandeja
    window.api.aoReceberComando((comando) => {
      if (comando === 'atualizar') { this.atualizarTela?.(); return; }
      if (!comando.startsWith('navegar:')) return;
      this.irPara?.(comando.slice('navegar:'.length));
    });
  }

  // Verifica a sessão: abre o sistema se já logado; senão mostra o login/primeiro acesso
  async iniciar(): Promise<void> {
    this.irPara = null;
    this.atualizarTela = null;
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
    // Página aberta no momento (para o comando "Atualizar conteúdo")
    let atual: Pagina = paginas[0];
    // Troca de página: marca o menu, mostra "Carregando…" e monta a nova tela
    const ir = async (p: Pagina): Promise<void> => {
      atual = p;
      itens.forEach((b, id) => {
        b.classList.toggle('ativo', id === p.id);
        if (id === p.id) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      itens.get(p.id)?.classList.remove('com-aviso');
      limparNo(conteudo);
      const corpo = h('div', { class: 'corpo' });
      const titulo = h('h1', { tabindex: -1 }, p.titulo);
      conteudo.append(h('header', { class: 'topo' }, titulo), corpo);
      // Indicador de carregamento: esqueleto + texto só para leitor de tela
      // (setTimeout, e não requestAnimationFrame: com a janela na bandeja o rAF pode ficar parado)
      corpo.setAttribute('aria-busy', 'true');
      corpo.append(h('p', { class: 'sr-only', role: 'status' }, 'Carregando…'), esqueleto());
      await new Promise<void>((ok) => setTimeout(ok, 0));
      corpo.replaceChildren();
      try { await p.montar(corpo, usuario); }
      catch (e) { corpo.append(h('p', { class: 'vazio' }, e instanceof Error ? e.message : 'Não foi possível carregar esta tela.')); }
      corpo.removeAttribute('aria-busy');
      corpo.classList.add('entrando');
      // Leva o foco ao título para leitor de tela e teclado saberem que a tela mudou
      titulo.focus();
    };
    // Navegação pedida pelo Painel, pelo menu nativo ou pela bandeja
    this.irPara = (id) => {
      const p = paginas.find((x) => x.id === id);
      if (!p) { toast('Esta tela não está disponível para o seu perfil.', 'aviso'); return; }
      void ir(p);
    };
    this.atualizarTela = () => { void ir(atual); };
    // Menu lateral: um botão por página, separado por grupos de uso
    const grupos = new Map<string, HTMLButtonElement[]>();
    for (const p of paginas) {
      const b = h('button', { class: 'nav-item', type: 'button', onclick: () => void ir(p) }, p.titulo);
      itens.set(p.id, b);
      grupos.set(p.grupo, [...(grupos.get(p.grupo) ?? []), b]);
    }
    const navLista = h('div', { class: 'nav-lista' });
    for (const [nome, botoes] of grupos) {
      navLista.append(h('div', { class: 'nav-bloco', role: 'group', 'aria-label': nome },
        h('h2', { class: 'nav-grupo' }, nome), ...botoes));
    }
    // Botão Sair: encerra a sessão e volta ao login
    const sair = botao('Sair', () => void chamar('auth:sair').then(() => this.iniciar()), 'btn leve claro');
    // Monta o menu lateral (marca, páginas, usuário) e a área de conteúdo
    this.raiz.replaceChildren(h('div', { class: 'app' },
      h('nav', { class: 'lateral', 'aria-label': 'Menu principal' },
        h('div', { class: 'marca' }, 'Gestão de', h('br'), 'Academia'),
        navLista,
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
