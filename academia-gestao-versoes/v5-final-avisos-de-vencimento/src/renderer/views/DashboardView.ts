// Página: Painel (resumo do dia, atalhos e previsão de chuva).
import { chamar } from '../api';
import { pode } from '../../shared/entities';
import { formatBR } from '../../shared/dates';
import type { AlertaChuva, ResumoDashboard, SessionUser } from '../../shared/types';
import { botao, h, moeda, numeroBR, selo, vazio } from '../ui';

// Classe da tela inicial
export class DashboardView {
  // Monta as boas-vindas, o placar de números, os atalhos, as aulas de hoje e a previsão
  async montar(raiz: HTMLElement, usuario?: SessionUser): Promise<void> {
    const r = await chamar<ResumoDashboard>('dashboard:resumo');
    // Boas-vindas na primeira visita deste usuário (some sozinha e pode ser fechada)
    const chave = `academia:boas-vindas:${usuario?.id ?? 'anonimo'}`;
    const jaViu = (): boolean => { try { return localStorage.getItem(chave) !== null; } catch { return true; } };
    if (!jaViu()) {
      const card = h('section', { class: 'painel boas-vindas' },
        h('div', {},
          h('h2', {}, `Bem-vindo(a)${usuario ? `, ${usuario.nome.split(' ')[0]}` : ''}!`),
          h('p', { class: 'descricao' }, 'Use o menu à esquerda para navegar. O Painel mostra o dia; Relatórios traz os números do período; Clima e avisos cuida dos planos perto de vencer.')),
        botao('Entendi', () => {
          try { localStorage.setItem(chave, '1'); } catch { /* armazenamento indisponível: some só nesta sessão */ }
          card.remove();
        }, 'btn'));
      raiz.append(card);
    }
    // Cada número do placar; vira botão quando o perfil pode abrir a tela relacionada
    const item = (
      n: string,
      rotulo: string,
      opcoes: { tom?: string; detalhe?: string; destino?: string; dica?: string; moeda?: boolean } = {},
    ): HTMLElement => {
      const conteudo = [
        h('span', { class: `numero${opcoes.moeda ? ' moeda' : ''}` }, n),
        h('span', { class: 'rotulo' }, rotulo),
        opcoes.detalhe ? h('span', { class: 'detalhe' }, opcoes.detalhe) : null,
      ];
      const classe = `placar-item ${opcoes.tom ?? ''}${opcoes.destino ? ' acionavel' : ''}`;
      if (!opcoes.destino) return h('div', { class: classe }, ...conteudo);
      return h('button', {
        class: classe, type: 'button', title: opcoes.dica,
        'aria-label': `${rotulo}: ${n}${opcoes.detalhe ? ` (${opcoes.detalhe})` : ''}. ${opcoes.dica ?? ''}`,
        onclick: () => window.dispatchEvent(new CustomEvent('app:navegar', { detail: opcoes.destino })),
      }, ...conteudo);
    };
    // O financeiro só aparece para administrador e recepção
    const f = r.financeiro;
    raiz.append(h('section', { class: 'placar', 'aria-label': 'Resumo' },
      item(String(r.alunosAtivos), 'alunos ativos', {
        destino: usuario && pode(usuario.perfil, 'alunos', 'r') ? 'alunos' : undefined, dica: 'Abrir alunos',
      }),
      item(String(r.matriculasAtivas), 'matrículas ativas', {
        destino: usuario && pode(usuario.perfil, 'matriculas', 'r') ? 'matriculas' : undefined, dica: 'Abrir matrículas',
      }),
      item(String(r.vencendo), 'planos perto de vencer', {
        tom: r.vencendo ? 'atencao' : '',
        detalhe: 'na janela de aviso',
        destino: usuario?.perfil === 'instrutor' ? 'relatorios' : 'alertas',
        dica: usuario?.perfil === 'instrutor' ? 'Abrir relatórios' : 'Abrir clima e avisos',
      }),
      f ? item(String(f.atrasados), 'mensalidades atrasadas', {
        tom: f.atrasados ? 'alerta' : '',
        detalhe: moeda(f.valorAtrasado),
        destino: 'pagamentos', dica: 'Abrir pagamentos',
      }) : null,
      f ? item(moeda(f.recebidoNoMes), 'recebido neste mês', {
        moeda: true, destino: 'relatorios', dica: 'Abrir relatórios',
      }) : null));

    // Atalhos para as tarefas mais frequentes (respeitando o perfil)
    const acoes: { id: string; rotulo: string; permitido: boolean }[] = [
      { id: 'alunos', rotulo: 'Ver alunos', permitido: !usuario || pode(usuario.perfil, 'alunos', 'c') },
      { id: 'pagamentos', rotulo: 'Ver mensalidades', permitido: !usuario || usuario.perfil !== 'instrutor' },
      { id: 'relatorios', rotulo: 'Abrir relatórios', permitido: true },
      { id: 'alertas', rotulo: 'Ver avisos de vencimento', permitido: !usuario || usuario.perfil !== 'instrutor' },
    ];
    const visiveis = acoes.filter((a) => a.permitido);
    if (visiveis.length) {
      raiz.append(h('section', { class: 'painel' }, h('h2', {}, 'Acesso rápido'),
        h('div', { class: 'atalhos' }, ...visiveis.map((a) => botao(a.rotulo,
          () => window.dispatchEvent(new CustomEvent('app:navegar', { detail: a.id })), 'btn')))));
    }

    // Lista das aulas de hoje
    const aulas = r.aulasHoje.length
      ? h('ul', { class: 'lista-aulas' }, ...r.aulasHoje.map((a) => h('li', {},
        h('span', { class: 'hora' }, a.hora), h('span', {}, `${a.modalidade} · ${a.instrutor}`), a.aoArLivre ? selo('Ao ar livre', 'info') : null)))
      : vazio('Nenhuma aula cadastrada para hoje.');
    // A previsão de chuva é carregada em seguida (API Open-Meteo)
    const previsao = h('div', {}, vazio('Consultando a previsão…'));
    raiz.append(h('div', { class: 'duas-colunas' },
      h('section', { class: 'painel' }, h('h2', {}, 'Aulas de hoje'), aulas),
      h('section', { class: 'painel' }, h('h2', {}, 'Chuva nas aulas ao ar livre'), previsao)));
    void this.previsao(previsao);
  }

  // Consulta e mostra a chance de chuva das aulas ao ar livre
  private async previsao(alvo: HTMLElement): Promise<void> {
    alvo.setAttribute('aria-busy', 'true');
    alvo.replaceChildren(h('p', { class: 'carregando', role: 'status' },
      h('span', { class: 'giro', 'aria-hidden': 'true' }), 'Consultando a previsão…'));
    try {
      const lista = await chamar<AlertaChuva[]>('alertas:chuva');
      alvo.replaceChildren();
      if (lista.length === 0) { alvo.append(vazio('Nenhuma aula ao ar livre nas próximas horas.')); return; }
      alvo.append(h('ul', { class: 'lista-aulas' }, ...lista.map((a) => h('li', {},
        h('span', { class: 'hora' }, a.hora), h('span', {}, `${a.modalidade} · ${formatBR(a.data).slice(0, 5)}`),
        a.vaiChover ? selo(`Chuva ${numeroBR(a.probabilidade)}% – remarcar?`, 'erro') : selo(`Tempo firme (${a.probabilidade}%)`, 'ok')))));
    } catch (e) {
      // Erro de rede/API: não deixa a tela presa nem promete um resultado que não existe
      alvo.replaceChildren(h('div', { class: 'vazio-acao' },
        vazio(e instanceof Error ? `Previsão indisponível: ${e.message}` : 'Previsão indisponível.'),
        botao('Tentar de novo', () => void this.previsao(alvo), 'btn leve', 'Consultar a previsão novamente')));
    } finally {
      alvo.removeAttribute('aria-busy');
    }
  }
}
