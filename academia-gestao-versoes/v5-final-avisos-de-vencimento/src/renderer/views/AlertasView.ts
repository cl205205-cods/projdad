// Página: Clima e avisos (previsão de chuva, planos perto de vencer e histórico de avisos).
import { chamar } from '../api';
import type { AlertaChuva, Aviso, ResultadoEnvio, Vencimento } from '../../shared/types';
import { formatBR } from '../../shared/dates';
import { botao, dataBR, h, selo, toast, vazio, type Tom } from '../ui';

// Cor do selo para cada status de envio
const TOM_ENVIO: Record<string, Tom> = { enviado: 'ok', simulado: 'info', falha: 'erro', gerado: 'aviso' };

/** Clima e avisos: previsão para aulas ao ar livre, planos perto de vencer e histórico de mensagens. */
export class AlertasView {
  // Áreas da tela: previsão, vencimentos e histórico
  private clima = h('div', {}); private venc = h('div', {}); private hist = h('div', {});

  // Monta as 3 seções e carrega vencimentos e histórico
  async montar(raiz: HTMLElement): Promise<void> {
    raiz.append(
      h('section', { class: 'painel' }, h('div', { class: 'cabeca-painel' }, h('h2', {}, 'Previsão para aulas ao ar livre'),
        botao('Verificar agora', () => void this.carregarClima(), 'btn primario')), this.clima),
      h('section', { class: 'painel' }, h('div', { class: 'cabeca-painel' }, h('h2', {}, 'Planos perto de vencer'),
        botao('Avisar todos pelo Telegram', () => void this.enviarTodos(), 'btn')), this.venc),
      h('section', { class: 'painel' }, h('h2', {}, 'Histórico de avisos'), this.hist));
    this.clima.append(vazio('Use “Verificar agora” para consultar a previsão das próximas aulas.'));
    await Promise.all([this.carregarVencimentos(), this.carregarHistorico()]);
  }

  // Botão "Verificar agora": consulta a previsão (API Open-Meteo) das aulas ao ar livre
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

  // Tabela de planos perto de vencer, com as ações de aviso
  private async carregarVencimentos(): Promise<void> {
    const lista = await chamar<Vencimento[]>('alertas:vencimentos');
    if (lista.length === 0) { this.venc.replaceChildren(vazio('Nenhum plano vence no período configurado.')); return; }
    this.venc.replaceChildren(this.tabela(['Aluno', 'Plano', 'Vence em', 'Aviso', ''], lista.map((v) => [
      v.aluno, v.plano,
      `${dataBR(v.dataFim)} (${v.diasRestantes === 0 ? 'hoje' : `${v.diasRestantes} d`})`,
      v.avisado ? selo('Avisado', 'ok') : selo(v.temTelegram ? 'Pendente' : 'Sem Telegram', v.temTelegram ? 'aviso' : 'neutro'),
      h('span', { class: 'acoes-linha' },
        botao('Enviar aviso', () => void this.enviar(v.matriculaId), 'btn leve'),
        v.telefone ? botao('WhatsApp', () => void this.whatsapp(v.matriculaId), 'btn leve') : null),
    ])));
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
  private async enviar(matriculaId: number): Promise<void> {
    try {
      const r = await chamar<ResultadoEnvio>('alertas:enviar', { matriculaId });
      toast(r.status === 'enviado' ? 'Aviso enviado pelo Telegram.' : (r.detalhe ?? r.status), r.status === 'enviado' ? 'ok' : r.status === 'falha' ? 'erro' : 'aviso');
      await Promise.all([this.carregarVencimentos(), this.carregarHistorico()]);
    } catch (e) { toast(e instanceof Error ? e.message : 'Falha ao enviar.', 'erro'); }
  }

  // Botão "Avisar todos pelo Telegram"
  private async enviarTodos(): Promise<void> {
    try {
      const r = await chamar<{ enviados: number; falhas: number; semContato: number }>('alertas:enviarTodos');
      toast(`${r.enviados} enviado(s), ${r.semContato} sem Telegram, ${r.falhas} com falha.`, r.falhas ? 'aviso' : 'ok');
      await Promise.all([this.carregarVencimentos(), this.carregarHistorico()]);
    } catch (e) { toast(e instanceof Error ? e.message : 'Falha ao enviar.', 'erro'); }
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
