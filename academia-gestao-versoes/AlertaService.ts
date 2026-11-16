import type { Database } from '../database/Database';
import type { ConfigService } from './ConfigService';
import type { ClimaService } from './ClimaService';
import type { FeriadoService } from './FeriadoService';
import { formatBR, hojeISO, toISODate } from '../../shared/dates';
import type { AlertaChuva, Aviso } from '../../shared/types';

/** Próxima vez (a partir de agora) em que a aula semanal acontece. */
export function proximaOcorrencia(diaSemana: number, hora: string, agora = new Date()): Date {
  const d = new Date(agora);
  d.setHours(Number(hora.slice(0, 2)), Number(hora.slice(3, 5)), 0, 0);
  d.setDate(d.getDate() + ((diaSemana - agora.getDay() + 7) % 7));
  if (d.getTime() < agora.getTime()) d.setDate(d.getDate() + 7);
  return d;
}


/** Regras de alerta: chuva em aulas ao ar livre. */
export class AlertaService {
  private ouvintes: ((a: AlertaChuva) => void)[] = [];

  constructor(
    private readonly db: Database, private readonly config: ConfigService, private readonly clima: ClimaService,
    private readonly feriados: FeriadoService,
  ) {}

  aoNovoAlerta(cb: (a: AlertaChuva) => void): void { this.ouvintes.push(cb); }

  // ---------- Chuva ----------
  async verificarChuva(): Promise<AlertaChuva[]> {
    const cfg = this.config.obter();
    const aulas = await this.db.consultar<
      { id: number; dia_semana: number; hora_inicio: string; duracao_min: number; local: string | null; modalidade: string; instrutor: string }>(
      `SELECT a.id, a.dia_semana, TIME_FORMAT(a.hora_inicio, '%H:%i') AS hora_inicio, a.duracao_min, a.\`local\`, m.nome AS modalidade, i.nome AS instrutor
       FROM aulas a JOIN modalidades m ON m.id = a.modalidade_id JOIN instrutores i ON i.id = a.instrutor_id
       WHERE a.ao_ar_livre = 1 AND i.ativo = 1 ORDER BY a.dia_semana, a.hora_inicio`);
    const agora = new Date();
    const limite = agora.getTime() + cfg.horasAntecedencia * 3_600_000;
    const saida: AlertaChuva[] = [];
    for (const a of aulas) {
      const inicio = proximaOcorrencia(a.dia_semana, a.hora_inicio, agora);
      if (inicio.getTime() > limite) continue;
      const data = toISODate(inicio);
      const p = await this.clima.previsao(cfg.latitude, cfg.longitude, data, a.hora_inicio, a.duracao_min);
      if (!p) continue;
      const vaiChover = p.probabilidade >= cfg.limiarChuva || p.mm >= 0.5;
      const alerta: AlertaChuva = {
        aulaId: a.id, modalidade: a.modalidade, instrutor: a.instrutor, local: a.local, data, hora: a.hora_inicio,
        probabilidade: p.probabilidade, mm: p.mm, vaiChover, feriado: await this.feriados.nomeDoFeriado(data), novo: false,
      };
      if (vaiChover) {
        const msg = `Previsão de chuva (${p.probabilidade}%) para ${a.modalidade} em ${formatBR(data)} às ${a.hora_inicio}. Considere remarcar para o espaço interno.`;
        alerta.novo = (await this.db.executar(
          "INSERT IGNORE INTO avisos (tipo, aula_id, chave, mensagem, canal, status) VALUES ('chuva', ?, ?, ?, 'app', 'gerado')",
          [a.id, `chuva:${a.id}:${data}`, msg])).affectedRows === 1;
        if (alerta.novo) this.ouvintes.forEach((cb) => cb(alerta));
      }
      saida.push(alerta);
    }
    return saida;
  }

  listarAvisos(): Promise<Aviso[]> {
    return this.db.consultar<Aviso>(
      `SELECT v.id, v.tipo, v.mensagem, v.canal, v.status, v.criado_em, a.nome AS aluno
       FROM avisos v LEFT JOIN alunos a ON a.id = v.aluno_id ORDER BY v.id DESC LIMIT 50`);
  }

  // ---------- Rotina periódica ----------
  async rotina(): Promise<void> {
    await this.config.carregar();
    await this.db.executar("UPDATE matriculas SET status = 'vencida' WHERE status = 'ativa' AND data_fim < ?", [hojeISO()]);
    try { await this.verificarChuva(); } catch (e) { console.error('[rotina] chuva:', e instanceof Error ? e.message : e); }
  }
}

/** Executa a rotina ao abrir o app e a cada 30 minutos. */
export class Agendador {
  private timer?: NodeJS.Timeout;
  constructor(private readonly alertas: AlertaService, private readonly intervaloMs = 30 * 60_000) {}

  iniciar(): void {
    void this.executar();
    this.timer = setInterval(() => void this.executar(), this.intervaloMs);
  }
  parar(): void { if (this.timer) clearInterval(this.timer); }

  private async executar(): Promise<void> {
    try { await this.alertas.rotina(); } catch (e) { console.error('[agendador]', e instanceof Error ? e.message : e); }
  }
}
