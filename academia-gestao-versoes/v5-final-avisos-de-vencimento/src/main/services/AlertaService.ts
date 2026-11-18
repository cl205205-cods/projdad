// Serviço de alertas: avisos de chuva (aulas ao ar livre) e de vencimento de plano, com a rotina automática.
import { AppError } from '../AppError';
import type { Database } from '../database/Database';
import type { ConfigService } from './ConfigService';
import type { ClimaService } from './ClimaService';
import type { FeriadoService } from './FeriadoService';
import { MensagemService } from './MensagemService';
import { addDays, diffDays, formatBR, hojeISO, toISODate } from '../../shared/dates';
import type { AlertaChuva, Aviso, ResultadoEnvio, Vencimento } from '../../shared/types';

/** Próxima vez (a partir de agora) em que a aula semanal acontece. */
export function proximaOcorrencia(diaSemana: number, hora: string, agora = new Date()): Date {
  const d = new Date(agora);
  d.setHours(Number(hora.slice(0, 2)), Number(hora.slice(3, 5)), 0, 0);
  d.setDate(d.getDate() + ((diaSemana - agora.getDay() + 7) % 7));
  if (d.getTime() < agora.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

// Linha da consulta de vencimentos
interface LinhaVenc { matriculaId: number; alunoId: number; aluno: string; plano: string; dataFim: string; telefone: string | null; chatId: string | null; avisado: number }

/** Regras de alerta: chuva em aulas ao ar livre e planos perto de vencer. */
export class AlertaService {
  // Funções avisadas quando surge um alerta novo de chuva
  private ouvintes: ((a: AlertaChuva) => void)[] = [];

  constructor(
    private readonly db: Database, private readonly config: ConfigService, private readonly clima: ClimaService,
    private readonly feriados: FeriadoService, private readonly mensagens: MensagemService,
  ) {}

  // Registra um ouvinte de novo alerta
  aoNovoAlerta(cb: (a: AlertaChuva) => void): void { this.ouvintes.push(cb); }

  // Verifica a previsão das aulas ao ar livre e gera os alertas de chuva
  // ---------- Chuva ----------
  async verificarChuva(): Promise<AlertaChuva[]> {
    const cfg = this.config.obter();
    // Busca as aulas ao ar livre (de instrutores ativos)
    const aulas = await this.db.consultar<
      { id: number; dia_semana: number; hora_inicio: string; duracao_min: number; local: string | null; modalidade: string; instrutor: string }>(
      `SELECT a.id, a.dia_semana, TIME_FORMAT(a.hora_inicio, '%H:%i') AS hora_inicio, a.duracao_min, a.\`local\`, m.nome AS modalidade, i.nome AS instrutor
       FROM aulas a JOIN modalidades m ON m.id = a.modalidade_id JOIN instrutores i ON i.id = a.instrutor_id
       WHERE a.ao_ar_livre = 1 AND i.ativo = 1 ORDER BY a.dia_semana, a.hora_inicio`);
    // Janela de tempo: só aulas que começam nas próximas horas configuradas
    const agora = new Date();
    const limite = agora.getTime() + cfg.horasAntecedencia * 3_600_000;
    const saida: AlertaChuva[] = [];
    // Para cada aula: calcula o próximo horário e consulta a previsão
    for (const a of aulas) {
      const inicio = proximaOcorrencia(a.dia_semana, a.hora_inicio, agora);
      if (inicio.getTime() > limite) continue;
      const data = toISODate(inicio);
      // Consulta a previsão da hora da aula (API Open-Meteo)
      const p = await this.clima.previsao(cfg.latitude, cfg.longitude, data, a.hora_inicio, a.duracao_min);
      if (!p) continue;
      // Vai chover se a chance passar do limite configurado ou houver chuva prevista
      const vaiChover = p.probabilidade >= cfg.limiarChuva || p.mm >= 0.5;
      const alerta: AlertaChuva = {
        aulaId: a.id, modalidade: a.modalidade, instrutor: a.instrutor, local: a.local, data, hora: a.hora_inicio,
        probabilidade: p.probabilidade, mm: p.mm, vaiChover, feriado: await this.feriados.nomeDoFeriado(data), novo: false,
      };
      // Chuva: grava o aviso (uma vez por aula/dia), notifica a tela e envia ao Telegram
      if (vaiChover) {
        const msg = `Previsão de chuva (${p.probabilidade}%) para ${a.modalidade} em ${formatBR(data)} às ${a.hora_inicio}. Considere remarcar para o espaço interno.`;
        // INSERT IGNORE evita repetir o mesmo aviso
        alerta.novo = (await this.db.executar(
          "INSERT IGNORE INTO avisos (tipo, aula_id, chave, mensagem, canal, status) VALUES ('chuva', ?, ?, ?, 'app', 'gerado')",
          [a.id, `chuva:${a.id}:${data}`, msg])).affectedRows === 1;
        if (alerta.novo) {
          this.ouvintes.forEach((cb) => cb(alerta));
          await this.enviarChuva(`chuva:${a.id}:${data}`, msg);
        }
      }
      // Devolve todos os resultados (com ou sem chuva) para a tela
      saida.push(alerta);
    }
    return saida;
  }

  /** Envia o aviso de chuva ao chat fixo (se configurado) e atualiza o registro do aviso. */
  private async enviarChuva(chave: string, msg: string): Promise<void> {
    const destino = this.mensagens.destinoFixo();
    const { nome, impl } = this.mensagens.canal();
    if (!destino || nome !== 'telegram') return;
    const r = await impl.enviar(destino, msg);
    await this.db.executar('UPDATE avisos SET canal = ?, status = ?, detalhe = ? WHERE chave = ?', [nome, r.status, r.detalhe ?? null, chave]);
  }

  // Planos ativos que vencem no período configurado (com chat id e se já foi avisado)
  // ---------- Vencimento de plano ----------
  private vencimentosInternos(): Promise<LinhaVenc[]> {
    const hoje = hojeISO();
    const fim = addDays(hoje, this.config.obter().diasAvisoVencimento);
    return this.db.consultar<LinhaVenc>(
      `SELECT mt.id AS matriculaId, a.id AS alunoId, a.nome AS aluno, p.nome AS plano, mt.data_fim AS dataFim,
              a.telefone, a.telegram_chat_id AS chatId,
              EXISTS (SELECT 1 FROM avisos v WHERE v.chave = CONCAT('venc:', mt.id, ':', mt.data_fim) AND v.status = 'enviado') AS avisado
       FROM matriculas mt JOIN alunos a ON a.id = mt.aluno_id JOIN planos p ON p.id = mt.plano_id
       WHERE mt.status = 'ativa' AND a.ativo = 1 AND mt.data_fim BETWEEN ? AND ? ORDER BY mt.data_fim, a.nome`, [hoje, fim]);
  }

  // Lista de vencimentos para a tela (dias restantes e se já foi avisado)
  async listarVencimentos(): Promise<Vencimento[]> {
    const hoje = hojeISO();
    return (await this.vencimentosInternos()).map((v) => ({
      matriculaId: v.matriculaId, alunoId: v.alunoId, aluno: v.aluno, plano: v.plano, dataFim: v.dataFim,
      diasRestantes: diffDays(hoje, v.dataFim), telefone: v.telefone, temTelegram: !!v.chatId || this.mensagens.destinoFixo() !== null, avisado: v.avisado === 1,
    }));
  }

  // Localiza o vencimento de uma matrícula
  private async achar(matriculaId: number): Promise<LinhaVenc> {
    const v = (await this.vencimentosInternos()).find((x) => x.matriculaId === matriculaId);
    if (!v) throw new AppError('Esta matrícula não está no período de aviso de vencimento.');
    return v;
  }

  // Monta o texto do aviso de vencimento
  private texto(v: LinhaVenc): string {
    const dias = diffDays(hojeISO(), v.dataFim);
    const quando = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
    return `Olá, ${v.aluno.split(' ')[0]}! Seu ${v.plano} na ${this.config.obter().academiaNome} vence ${quando} (${formatBR(v.dataFim)}). Passe na recepção para renovar e continuar treinando.`;
  }

  // Envia o aviso de uma matrícula
  async enviarVencimento(matriculaId: number): Promise<ResultadoEnvio> {
    return this.enviarLinha(await this.achar(matriculaId));
  }

  // Envia pelo canal ativo e registra o resultado no histórico de avisos
  private async enviarLinha(v: LinhaVenc): Promise<ResultadoEnvio> {
    // Sem chat id e sem destino fixo: não há para quem enviar
    if (!v.chatId && !this.mensagens.destinoFixo()) return { status: 'sem_contato', detalhe: 'Aluno sem Telegram cadastrado. Use o botão WhatsApp.' };
    const texto = this.texto(v);
    const { nome, impl } = this.mensagens.canal();
    const r = await impl.enviar(v.chatId ?? '', texto);
    // Registra (ou atualiza) o aviso no histórico
    await this.db.executar(
      `INSERT INTO avisos (tipo, aluno_id, chave, mensagem, canal, status, detalhe) VALUES ('vencimento', ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), detalhe = VALUES(detalhe), canal = VALUES(canal), criado_em = NOW()`,
      [v.alunoId, `venc:${v.matriculaId}:${v.dataFim}`, texto, nome, r.status, r.detalhe ?? null]);
    return r;
  }

  // Envia todos os avisos pendentes e conta enviados, falhas e sem contato
  async enviarTodosVencimentos(): Promise<{ enviados: number; falhas: number; semContato: number }> {
    const total = { enviados: 0, falhas: 0, semContato: 0 };
    for (const v of (await this.vencimentosInternos()).filter((x) => !x.avisado)) {
      const r = await this.enviarLinha(v);
      if (r.status === 'enviado' || r.status === 'simulado') total.enviados++;
      else if (r.status === 'sem_contato') total.semContato++;
      else total.falhas++;
    }
    return total;
  }

  // Gera o link do WhatsApp com a mensagem pronta
  async linkWhatsApp(matriculaId: number): Promise<string> {
    const v = await this.achar(matriculaId);
    if (!v.telefone) throw new AppError('Aluno sem telefone cadastrado.');
    return MensagemService.linkWhatsApp(v.telefone, this.texto(v));
  }

  // Últimos 50 avisos registrados
  listarAvisos(): Promise<Aviso[]> {
    return this.db.consultar<Aviso>(
      `SELECT v.id, v.tipo, v.mensagem, v.canal, v.status, v.criado_em, a.nome AS aluno
       FROM avisos v LEFT JOIN alunos a ON a.id = v.aluno_id ORDER BY v.id DESC LIMIT 50`);
  }

  // ---------- Rotina periódica ----------
  // Rotina automática: atualiza matrículas vencidas, verifica chuva e envia vencimentos
  async rotina(): Promise<void> {
    await this.config.carregar();
    // Marca como vencidas as matrículas com data de término no passado
    await this.db.executar("UPDATE matriculas SET status = 'vencida' WHERE status = 'ativa' AND data_fim < ?", [hojeISO()]);
    // Verifica a chuva (um erro aqui não interrompe o resto)
    try { await this.verificarChuva(); } catch (e) { console.error('[rotina] chuva:', e instanceof Error ? e.message : e); }
    // Envio automático dos vencimentos (se ligado e com token)
    if (this.config.obter().envioAutomatico && this.config.token()) await this.enviarTodosVencimentos();
  }
}

/** Executa a rotina ao abrir o app e a cada 30 minutos. */
export class Agendador {
  // Temporizador da rotina
  private timer?: NodeJS.Timeout;
  constructor(private readonly alertas: AlertaService, private readonly intervaloMs = 30 * 60_000) {}

  // Executa já e repete a cada 30 minutos
  iniciar(): void {
    void this.executar();
    this.timer = setInterval(() => void this.executar(), this.intervaloMs);
  }
  // Para o temporizador
  parar(): void { if (this.timer) clearInterval(this.timer); }

  // Roda a rotina sem deixar um erro derrubar o app
  private async executar(): Promise<void> {
    try { await this.alertas.rotina(); } catch (e) { console.error('[agendador]', e instanceof Error ? e.message : e); }
  }
}
