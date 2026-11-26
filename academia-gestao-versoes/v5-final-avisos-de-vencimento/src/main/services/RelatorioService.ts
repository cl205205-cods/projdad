// Serviço de relatórios: monta, no processo main, os números de cada perfil a partir do banco.
// A permissão é decidida pelo perfil da sessão (nunca por um valor enviado pela interface).
import { AppError } from '../AppError';
import type { Database } from '../database/Database';
import type { ConfigService } from './ConfigService';
import type { Perfil } from '../../shared/entities';
import { formatBR, toISODate } from '../../shared/dates';
import type {
  FormatoValor, KpiRelatorio, PeriodoRelatorio, PontoGrafico, Relatorio,
} from '../../shared/types';

// Períodos aceitos (em meses)
const PERIODOS: readonly PeriodoRelatorio[] = [3, 6, 12];
// Nome curto dos meses para os rótulos dos gráficos e do CSV
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// Dias da semana na ordem da tabela (0 = domingo)
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// Nome de cada perfil nos textos e no CSV
const NOME_PERFIL: Record<Perfil, string> = { admin: 'Administrador', recepcao: 'Recepção', instrutor: 'Instrutor' };

/** Garante que o período recebido é um dos aceitos (qualquer outro valor cai em 6 meses). */
export function periodoValido(v: unknown): PeriodoRelatorio {
  const n = Number(v) as PeriodoRelatorio;
  return PERIODOS.includes(n) ? n : 6;
}

// Linhas auxiliares retornadas pelas consultas
interface LinhaMes { m: string; v: number }
interface LinhaRotulo { rotulo: string; v: number }

/**
 * Relatórios por perfil. Administrador vê o financeiro completo; recepção vê a rotina de
 * atendimento (matrículas, mensalidades e aulas); instrutor vê aulas e avaliações, sem dinheiro.
 */
export class RelatorioService {
  // Formatadores usados nas tabelas e no CSV
  private readonly brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  private readonly num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

  constructor(private readonly db: Database, private readonly config: ConfigService) {}

  /** Relatório do perfil logado. O perfil vem da sessão do main, não do renderer. */
  async obter(perfil: Perfil, periodo: PeriodoRelatorio): Promise<Relatorio> {
    switch (perfil) {
      case 'admin': return this.admin(periodo);
      case 'recepcao': return this.recepcao(periodo);
      case 'instrutor': return this.instrutor(periodo);
      default: throw new AppError('Perfil inválido para relatórios.');
    }
  }

  // ---- Administrador: visão financeira e de planos ----
  private async admin(periodo: PeriodoRelatorio): Promise<Relatorio> {
    const hoje = toISODate(new Date());
    const inicio = this.inicio(periodo);
    const meses = this.meses(periodo);
    const [receita, pagos, atraso, alunos, matriculas, porMes, formas, planos, atrasadas] = await Promise.all([
      this.db.um<{ v: number }>("SELECT COALESCE(SUM(valor), 0) AS v FROM pagamentos WHERE status = 'pago' AND data_pagamento >= ?", [inicio]),
      this.db.um<{ n: number }>("SELECT COUNT(*) AS n FROM pagamentos WHERE status = 'pago' AND data_pagamento >= ?", [inicio]),
      this.db.um<{ n: number; v: number }>("SELECT COUNT(*) AS n, COALESCE(SUM(valor), 0) AS v FROM pagamentos WHERE status = 'pendente' AND vencimento < ?", [hoje]),
      this.db.um<{ n: number }>('SELECT COUNT(*) AS n FROM alunos WHERE ativo = 1'),
      this.db.um<{ n: number }>("SELECT COUNT(*) AS n FROM matriculas WHERE status = 'ativa' AND data_fim >= ?", [hoje]),
      this.db.consultar<LinhaMes>(
        "SELECT DATE_FORMAT(data_pagamento, '%Y-%m') AS m, COALESCE(SUM(valor), 0) AS v FROM pagamentos WHERE status = 'pago' AND data_pagamento >= ? GROUP BY m", [inicio]),
      this.db.consultar<LinhaRotulo>(
        "SELECT COALESCE(forma, 'Não informado') AS rotulo, COALESCE(SUM(valor), 0) AS v FROM pagamentos WHERE status = 'pago' AND data_pagamento >= ? GROUP BY rotulo ORDER BY v DESC", [inicio]),
      this.db.consultar<LinhaRotulo>(
        `SELECT pl.nome AS rotulo, COUNT(*) AS v FROM matriculas m JOIN planos pl ON pl.id = m.plano_id
         WHERE m.status = 'ativa' AND m.data_fim >= ? GROUP BY pl.id, pl.nome ORDER BY v DESC`, [hoje]),
      this.db.consultar<{ aluno: string; plano: string; vencimento: string; dias: number; valor: number }>(
        `SELECT a.nome AS aluno, pl.nome AS plano, p.vencimento, DATEDIFF(?, p.vencimento) AS dias, p.valor
         FROM pagamentos p JOIN matriculas m ON m.id = p.matricula_id
         JOIN alunos a ON a.id = m.aluno_id JOIN planos pl ON pl.id = m.plano_id
         WHERE p.status = 'pendente' AND p.vencimento < ? ORDER BY dias DESC, p.valor DESC LIMIT 15`, [hoje, hoje]),
    ]);
    const totalRecebido = Number(receita?.v ?? 0);
    const quantidadePaga = Number(pagos?.n ?? 0);
    const emAtraso = Number(atraso?.n ?? 0);
    const kpis: KpiRelatorio[] = [
      { rotulo: 'Recebido no período', valor: totalRecebido, formato: 'moeda', detalhe: `${quantidadePaga} mensalidade(s) paga(s)`, tom: 'ok' },
      { rotulo: 'Em atraso hoje', valor: Number(atraso?.v ?? 0), formato: 'moeda', detalhe: `${emAtraso} mensalidade(s) vencida(s)`, tom: emAtraso ? 'alerta' : 'ok' },
      { rotulo: 'Ticket médio', valor: quantidadePaga ? totalRecebido / quantidadePaga : 0, formato: 'moeda', detalhe: 'por mensalidade paga' },
      { rotulo: 'Alunos ativos', valor: Number(alunos?.n ?? 0), formato: 'numero' },
      { rotulo: 'Matrículas ativas', valor: Number(matriculas?.n ?? 0), formato: 'numero', detalhe: 'em dia' },
    ];
    return {
      perfil: 'admin', periodo, titulo: 'Visão financeira e de planos',
      descricao: 'Receita recebida, inadimplência atual, formas de pagamento e distribuição das matrículas ativas. Somente o administrador vê esta visão completa.',
      kpis,
      graficos: [
        { tipo: 'linha', titulo: 'Receita mês a mês', unidade: 'R$', formato: 'moeda', dados: this.preencher(meses, porMes) },
        { tipo: 'rosca', titulo: 'Recebido por forma de pagamento', unidade: 'R$', formato: 'moeda', dados: formas.map((f) => ({ rotulo: f.rotulo, valor: Number(f.v) })) },
        { tipo: 'barras', titulo: 'Matrículas ativas por plano', formato: 'numero', dados: planos.map((p) => ({ rotulo: p.rotulo, valor: Number(p.v) })) },
      ],
      tabela: {
        titulo: 'Mensalidades em atraso',
        colunas: ['Aluno', 'Plano', 'Vencimento', 'Dias em atraso', 'Valor'],
        linhas: atrasadas.map((l) => [l.aluno, l.plano, this.data(l.vencimento), String(l.dias), this.dinheiro(Number(l.valor))]),
      },
    };
  }

  // ---- Recepção: rotina de atendimento, sem dados de saúde ----
  private async recepcao(periodo: PeriodoRelatorio): Promise<Relatorio> {
    const hoje = toISODate(new Date());
    const inicio = this.inicio(periodo);
    const meses = this.meses(periodo);
    const diasAviso = Math.max(7, this.config.obter().diasAvisoVencimento);
    const [novos, matriculas, recebido, alunos, pendentes, porMes, situacao, aulas, vencendo] = await Promise.all([
      this.db.um<{ n: number }>('SELECT COUNT(*) AS n FROM alunos WHERE criado_em >= ?', [inicio]),
      this.db.um<{ n: number }>('SELECT COUNT(*) AS n FROM matriculas WHERE data_inicio >= ?', [inicio]),
      this.db.um<{ n: number; q: number }>("SELECT COALESCE(SUM(valor), 0) AS n, COUNT(*) AS q FROM pagamentos WHERE status = 'pago' AND data_pagamento >= ?", [inicio]),
      this.db.um<{ n: number }>('SELECT COUNT(*) AS n FROM alunos WHERE ativo = 1'),
      this.db.um<{ n: number }>("SELECT COUNT(*) AS n FROM pagamentos WHERE status = 'pendente'"),
      this.db.consultar<LinhaMes>(
        "SELECT DATE_FORMAT(criado_em, '%Y-%m') AS m, COUNT(*) AS v FROM alunos WHERE criado_em >= ? GROUP BY m", [inicio]),
      this.db.consultar<LinhaRotulo>(
        `SELECT CASE WHEN status = 'pago' THEN 'Pago' WHEN status = 'cancelado' THEN 'Cancelado'
                     WHEN vencimento < ? THEN 'Atrasado' ELSE 'A vencer' END AS rotulo, COUNT(*) AS v
         FROM pagamentos WHERE vencimento >= ? GROUP BY rotulo`, [hoje, inicio]),
      this.aulasPorModalidade(),
      this.db.consultar<{ aluno: string; plano: string; fim: string; dias: number }>(
        `SELECT a.nome AS aluno, pl.nome AS plano, m.data_fim AS fim, DATEDIFF(m.data_fim, ?) AS dias
         FROM matriculas m JOIN alunos a ON a.id = m.aluno_id JOIN planos pl ON pl.id = m.plano_id
         WHERE m.status = 'ativa' AND m.data_fim BETWEEN ? AND DATE_ADD(?, INTERVAL ? DAY)
         ORDER BY m.data_fim LIMIT 15`, [hoje, hoje, hoje, diasAviso]),
    ]);
    const kpis: KpiRelatorio[] = [
      { rotulo: 'Novos alunos', valor: Number(novos?.n ?? 0), formato: 'numero', detalhe: 'no período' },
      { rotulo: 'Novas matrículas', valor: Number(matriculas?.n ?? 0), formato: 'numero', detalhe: 'no período' },
      { rotulo: 'Recebido no período', valor: Number(recebido?.n ?? 0), formato: 'moeda', detalhe: `${Number(recebido?.q ?? 0)} pagamento(s)`, tom: 'ok' },
      { rotulo: 'Mensalidades pendentes', valor: Number(pendentes?.n ?? 0), formato: 'numero', detalhe: 'aguardando pagamento', tom: Number(pendentes?.n ?? 0) ? 'atencao' : 'ok' },
      { rotulo: 'Alunos ativos', valor: Number(alunos?.n ?? 0), formato: 'numero' },
    ];
    return {
      perfil: 'recepcao', periodo, titulo: 'Rotina de atendimento',
      descricao: 'Novos alunos, matrículas, situação das mensalidades e aulas cadastradas. Dados de saúde e configurações continuam restritos a outros perfis.',
      kpis,
      graficos: [
        { tipo: 'barras', titulo: 'Novos alunos por mês', formato: 'numero', dados: this.preencher(meses, porMes) },
        { tipo: 'rosca', titulo: 'Mensalidades por situação', formato: 'numero', dados: situacao.map((s) => ({ rotulo: s.rotulo, valor: Number(s.v) })) },
        { tipo: 'barras', titulo: 'Aulas por modalidade', formato: 'numero', dados: aulas },
      ],
      tabela: {
        titulo: `Planos que vencem em até ${diasAviso} dias`,
        colunas: ['Aluno', 'Plano', 'Vencimento', 'Dias restantes'],
        linhas: vencendo.map((v) => [v.aluno, v.plano, this.data(v.fim), v.dias === 0 ? 'Hoje' : String(v.dias)]),
      },
    };
  }

  // ---- Instrutor: aulas e acompanhamento, nunca dados financeiros ----
  private async instrutor(periodo: PeriodoRelatorio): Promise<Relatorio> {
    const inicio = this.inicio(periodo);
    const meses = this.meses(periodo);
    const [aulasSemana, modalidades, avaliacoes, alunos, porModalidade, porDia, avaliacoesMes, agenda] = await Promise.all([
      this.db.um<{ n: number }>('SELECT COUNT(*) AS n FROM aulas'),
      this.db.um<{ n: number }>('SELECT COUNT(DISTINCT modalidade_id) AS n FROM aulas'),
      this.db.um<{ n: number }>('SELECT COUNT(*) AS n FROM avaliacoes_fisicas WHERE `data` >= ?', [inicio]),
      this.db.um<{ n: number }>('SELECT COUNT(*) AS n FROM alunos WHERE ativo = 1'),
      this.aulasPorModalidade(),
      this.db.consultar<{ dia: number; v: number }>('SELECT dia_semana AS dia, COUNT(*) AS v FROM aulas GROUP BY dia_semana'),
      this.db.consultar<LinhaMes>(
        "SELECT DATE_FORMAT(`data`, '%Y-%m') AS m, COUNT(*) AS v FROM avaliacoes_fisicas WHERE `data` >= ? GROUP BY m", [inicio]),
      this.db.consultar<{ dia: number; hora: string; modalidade: string; instrutor: string; local: string | null; duracao: number; livre: number }>(
        `SELECT a.dia_semana AS dia, TIME_FORMAT(a.hora_inicio, '%H:%i') AS hora, m.nome AS modalidade,
                i.nome AS instrutor, a.local, a.duracao_min AS duracao, a.ao_ar_livre AS livre
         FROM aulas a JOIN modalidades m ON m.id = a.modalidade_id JOIN instrutores i ON i.id = a.instrutor_id
         ORDER BY a.dia_semana, a.hora_inicio`),
    ]);
    const porDiaMapa = new Map(porDia.map((d) => [Number(d.dia), Number(d.v)]));
    const kpis: KpiRelatorio[] = [
      { rotulo: 'Aulas por semana', valor: Number(aulasSemana?.n ?? 0), formato: 'numero', detalhe: 'na grade fixa' },
      { rotulo: 'Modalidades', valor: Number(modalidades?.n ?? 0), formato: 'numero', detalhe: 'com aulas' },
      { rotulo: 'Avaliações no período', valor: Number(avaliacoes?.n ?? 0), formato: 'numero', tom: 'info' },
      { rotulo: 'Alunos ativos', valor: Number(alunos?.n ?? 0), formato: 'numero' },
    ];
    return {
      perfil: 'instrutor', periodo, titulo: 'Aulas e acompanhamento',
      descricao: 'Grade de aulas, modalidades e quantidade de avaliações físicas realizadas. Os valores das mensalidades e a configuração do sistema não aparecem para este perfil.',
      kpis,
      graficos: [
        { tipo: 'barras', titulo: 'Aulas por modalidade', formato: 'numero', dados: porModalidade },
        { tipo: 'barras', titulo: 'Aulas por dia da semana', formato: 'numero', dados: DIAS.map((rotulo, i) => ({ rotulo, valor: porDiaMapa.get(i) ?? 0 })) },
        { tipo: 'linha', titulo: 'Avaliações físicas por mês', formato: 'numero', dados: this.preencher(meses, avaliacoesMes) },
      ],
      tabela: {
        titulo: 'Grade de aulas da semana',
        colunas: ['Dia', 'Horário', 'Modalidade', 'Instrutor', 'Local', 'Duração', 'Ao ar livre'],
        linhas: agenda.map((a) => [
          DIAS[Number(a.dia)] ?? '—', a.hora, a.modalidade, a.instrutor, a.local ?? '—', `${a.duracao} min`, a.livre ? 'Sim' : 'Não',
        ]),
      },
    };
  }

  /** Gera o CSV do mesmo relatório, com os dados montados no main (o renderer não envia conteúdo). */
  async csv(perfil: Perfil, periodo: PeriodoRelatorio): Promise<{ nome: string; conteudo: string }> {
    const r = await this.obter(perfil, periodo);
    const linhas: string[][] = [
      ['Relatório', r.titulo],
      ['Perfil', NOME_PERFIL[perfil]],
      ['Período', `Últimos ${periodo} meses`],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      [],
      ['Indicadores'],
      ['Indicador', 'Valor', 'Detalhe'],
      ...r.kpis.map((k) => [k.rotulo, this.formatar(k.valor, k.formato), k.detalhe ?? '']),
      [],
      [r.tabela.titulo],
      r.tabela.colunas,
      ...r.tabela.linhas,
    ];
    const conteudo = linhas.map((l) => l.map((c) => this.csvCelula(c)).join(';')).join('\r\n');
    return { nome: `relatorio-${perfil}-${toISODate(new Date())}.csv`, conteudo };
  }

  // ---- utilitários ----

  // Primeiro dia do mês inicial do período (ex.: 12 meses atrás)
  private inicio(periodo: PeriodoRelatorio): string {
    const hoje = new Date();
    return toISODate(new Date(hoje.getFullYear(), hoje.getMonth() - (periodo - 1), 1));
  }

  // Meses do período, com chave para o SQL ("2026-11") e rótulo curto ("nov/26")
  private meses(periodo: PeriodoRelatorio): { chave: string; rotulo: string }[] {
    const hoje = new Date();
    return Array.from({ length: periodo }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (periodo - 1 - i), 1);
      return { chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, rotulo: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` };
    });
  }

  // Completa com zero os meses sem movimento (o gráfico não pode "pular" um mês)
  private preencher(meses: { chave: string; rotulo: string }[], linhas: LinhaMes[]): PontoGrafico[] {
    const mapa = new Map(linhas.map((l) => [String(l.m), Number(l.v)]));
    return meses.map((m) => ({ rotulo: m.rotulo, valor: mapa.get(m.chave) ?? 0 }));
  }

  // Aulas agrupadas por modalidade (usado por recepção e instrutor)
  private aulasPorModalidade(): Promise<PontoGrafico[]> {
    return this.db.consultar<{ rotulo: string; v: number }>(
      `SELECT m.nome AS rotulo, COUNT(*) AS v FROM aulas a JOIN modalidades m ON m.id = a.modalidade_id
       GROUP BY m.id, m.nome ORDER BY v DESC`).then((l) => l.map((x) => ({ rotulo: x.rotulo, valor: Number(x.v) })));
  }

  // Formata um número para o CSV
  private formatar(v: number, formato: FormatoValor): string {
    if (formato === 'moeda') return this.dinheiro(v);
    if (formato === 'percentual') return `${this.num.format(v)}%`;
    return this.num.format(v);
  }

  // Data ISO -> DD/MM/AAAA
  private data(iso: string): string { return formatBR(iso); }
  // Número -> R$ 1.234,56
  private dinheiro(v: number): string { return this.brl.format(v); }

  // Célula segura para CSV: escapa separador/aspas e evita fórmulas ao abrir no Excel
  private csvCelula(valor: string): string {
    let s = String(valor ?? '');
    if (/^[=+\-@]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`;
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
}
