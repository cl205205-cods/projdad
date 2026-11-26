// Página: Clima e avisos (previsão de chuva, planos perto de vencer e histórico de avisos).
import { chamar } from '../api';
import type { AlertaChuva, Aviso, ResultadoEnvio, Vencimento } from '../../shared/types';
import { formatBR } from '../../shared/dates';
import { botao, confirmar, dataBR, h, selo, toast, vazio, type Tom } from '../ui';

// Cor do selo para cada status de envio
const TOM_ENVIO: Record<string, Tom> = { enviado: 'ok', simulado: 'info', falha: 'erro', gerado: 'aviso' };

/** Clima e avisos: previsão para aulas ao ar livre, planos perto de vencer e histórico de mensagens. */
export class AlertasView {
  // Áreas da tela: previsão, vencimentos e histórico
  private clima = h('div', {}); private venc = h('div', {}); private hist = h('div', {});
  // Botões que consultam APIs (recebem estado ocupado enquanto a resposta não chega)
  private botaoClima: HTMLButtonElement | null = null;
  private botaoTodos: HTMLButtonElement | null = null;

  // Monta as 3 seções e carrega vencimentos e histórico
  async montar(raiz: HTMLElement): Promise<void> {
    this.botaoClima = botao('Verificar agora', () => void this.carregarClima(), 'btn primario', 'Consultar a previsão de chuva agora');
    this.botaoTodos = botao('Avisar todos pelo Telegram', () => void this.enviarTodos(), 'btn');
    raiz.append(
      h('section', { class: 'painel' }, h('div', { class: 'cabeca-painel' }, h('h2', {}, 'Previsão para aulas ao ar livre'),
        this.botaoClima), this.clima),
      h('section', { class: 'painel' }, h('div', { class: 'cabeca-painel' }, h('h2', {}, 'Planos perto de vencer'),
        this.botaoTodos), this.venc),
      h('section', { class: 'painel' }, h('h2', {}, 'Histórico de avisos'), this.hist));
    this.clima.append(vazio('Use “Verificar agora” para consultar a previsão das próximas aulas.'));
    await Promise.all([this.carregarVencimentos(), this.carregarHistorico()]);
  }

  // Botão "Verificar agora": consulta a previsão (API Open-Meteo) das aulas ao ar livre
  private async carregarClima(): Promise<void> {
    if (this.botaoClima) { this.botaoClima.disabled = true; this.botaoClima.textContent = 'Consultando…'; }
    this.clima.setAttribute('aria-busy', 'true');
    this.clima.replaceChildren(h('p', { class: 'carregando', role: 'status' },
      h('span', { class: 'giro', 'aria-hidden': 'true' }), 'Consultando a previsão…'));
    try {
      const lista = await chamar<AlertaChuva[]>('alertas:chuva');
      // Hora da consulta: deixa claro que o dado não é "tempo real"
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (lista.length === 0) {
        this.clima.replaceChildren(h('p', { class: 'ajuda' }, `Última consulta: ${hora}`),
          vazio('Nenhuma aula ao ar livre nas próximas horas. Marque “Ao ar livre” nas aulas externas.'));
        return;
      }
      this.clima.replaceChildren(
        h('p', { class: 'ajuda' }, `Última consulta: ${hora}`),
        this.tabela(['Aula', 'Quando', 'Chuva', 'Situação'], lista.map((a) => [
          `${a.modalidade} — ${a.instrutor}${a.local ? ` (${a.local})` : ''}`,
          `${formatBR(a.data)} às ${a.hora}`,
          `${a.probabilidade}% · ${String(a.mm).replace('.', ',')} mm`,
          h('span', {}, a.vaiChover ? selo('Vai chover: remarcar para dentro', 'erro') : selo('Tempo firme', 'ok'),
            a.feriado ? selo(`Feriado: ${a.feriado}`, 'aviso') : null),
        ])));
      void this.carregarHistorico();
    } catch (e) {
      // Erro de rede/API: oferece nova tentativa em vez de deixar a tela vazia
      this.clima.replaceChildren(h('div', { class: 'vazio-acao' },
        vazio(e instanceof Error ? e.message : 'Falha ao consultar a previsão.'),
        botao('Tentar de novo', () => void this.carregarClima(), 'btn leve', 'Consultar a previsão novamente')));
    } finally {
      this.clima.removeAttribute('aria-busy');
      if (this.botaoClima) { this.botaoClima.disabled = false; this.botaoClima.textContent = 'Verificar agora'; }
    }
  }

  // Tabela de planos perto de vencer, com as ações de aviso
  private async carregarVencimentos(): Promise<void> {
    const lista = await chamar<Vencimento[]>('alertas:vencimentos');
    if (lista.length === 0) { this.venc.replaceChildren(vazio('Nenhum plano vence no período configurado.')); return; }
    this.venc.replaceChildren(this.tabela(['Aluno', 'Plano', 'Vence em', 'Aviso', ''], lista.map((v) => {
      const enviarBtn = botao('Enviar aviso', () => void this.enviar(v.matriculaId, enviarBtn), 'btn leve',
        `Enviar aviso de vencimento para ${v.aluno} pelo Telegram`);
      return [
        v.aluno, v.plano,
        `${dataBR(v.dataFim)} (${v.diasRestantes === 0 ? 'hoje' : `${v.diasRestantes} d`})`,
        v.avisado ? selo('Avisado', 'ok') : selo(v.temTelegram ? 'Pendente' : 'Sem Telegram', v.temTelegram ? 'aviso' : 'neutro'),
        h('span', { class: 'acoes-linha' },
          enviarBtn,
          v.telefone ? botao('WhatsApp', () => void this.whatsapp(v.matriculaId), 'btn leve', `Abrir o WhatsApp com a mensagem pronta para ${v.aluno}`) : null),
      ];
    })));
  }

  // Tabela com o histórico dos avisos enviados ou gerados
  private async carregarHistorico(): Promise<void> {
    const lista = await chamar<Aviso[]>('avisos:listar');
    this.hist.replaceChildren(lista.length ? this.tabela(['Quando', 'Tipo', 'Aluno', 'Mensagem', 'Canal', 'Status'], lista.map((a) => [
      a.criado_em.slice(0, 16).replace('T', ' ').split(' ').map((p, i) => (i === 0 ? formatBR(p) : p)).join(' '),
      a.tipo === 'chuva' ? 'Chuva' : 'Vencimento', a.aluno ?? '—', a.mensagem, a.canal, selo(a.status, TOM_ENVIO[a.status] ?? 'neutro'),
    ])) : vazio('Nenhum aviso registrado ainda.'));
  }

  // Botão "Enviar aviso": envia o aviso de um aluno pelo Telegram
  private async enviar(matriculaId: number, botaoEnviar: HTMLButtonElement): Promise<void> {
    botaoEnviar.disabled = true;
    botaoEnviar.textContent = 'Enviando…';
    try {
      const r = await chamar<ResultadoEnvio>('alertas:enviar', { matriculaId });
      toast(r.status === 'enviado' ? 'Aviso enviado pelo Telegram.' : (r.detalhe ?? r.status), r.status === 'enviado' ? 'ok' : r.status === 'falha' ? 'erro' : 'aviso');
      await Promise.all([this.carregarVencimentos(), this.carregarHistorico()]);
    } catch (e) { toast(e instanceof Error ? e.message : 'Falha ao enviar.', 'erro'); }
    finally {
      botaoEnviar.disabled = false;
      botaoEnviar.textContent = 'Enviar aviso';
    }
  }

  // Botão "Avisar todos pelo Telegram"
  private async enviarTodos(): Promise<void> {
    // Envio em massa: confirma antes de disparar várias mensagens
    if (!(await confirmar('Enviar o aviso de vencimento para todos os alunos da lista?', 'Enviar todos'))) return;
    if (this.botaoTodos) { this.botaoTodos.disabled = true; this.botaoTodos.textContent = 'Enviando…'; }
    try {
      const r = await chamar<{ enviados: number; falhas: number; semContato: number }>('alertas:enviarTodos');
      toast(`${r.enviados} enviado(s), ${r.semContato} sem Telegram, ${r.falhas} com falha.`, r.falhas ? 'aviso' : 'ok');
      await Promise.all([this.carregarVencimentos(), this.carregarHistorico()]);
    } catch (e) { toast(e instanceof Error ? e.message : 'Falha ao enviar.', 'erro'); }
    finally {
      if (this.botaoTodos) { this.botaoTodos.disabled = false; this.botaoTodos.textContent = 'Avisar todos pelo Telegram'; }
    }
  }

  // Botão WhatsApp: abre a conversa com a mensagem pronta
  private async whatsapp(matriculaId: number): Promise<void> {
    try { await chamar('alertas:whatsapp', { matriculaId }); } catch (e) { toast(e instanceof Error ? e.message : 'Falha ao abrir o WhatsApp.', 'erro'); }
  }

  // Monta uma tabela HTML a partir do cabeçalho e das linhas
  private tabela(cabecalho: string[], linhas: (string | HTMLElement)[][]): HTMLElement {
    return h('div', { class: 'rolagem' }, h('table', {},
      h('thead', {}, h('tr', {}, ...cabecalho.map((c) => h('th', {}, c)))),
      h('tbody', {}, ...linhas.map((l) => h('tr', {}, ...l.map((c) => h('td', {}, c)))))));
  }
}
