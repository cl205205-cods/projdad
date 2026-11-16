import { AppError } from '../AppError';
import type { Database } from '../database/Database';
import type { FeriadoService } from './FeriadoService';
import { FORMAS_PAGAMENTO } from '../../shared/entities';
import { addMonths, hojeISO } from '../../shared/dates';
import type { PagamentoLinha } from '../../shared/types';

export type FiltroPagamento = 'todos' | 'pendentes' | 'atrasados' | 'pagos';
const CLAUSULAS: Record<FiltroPagamento, string> = {
  todos: '1 = 1', pendentes: "situacao = 'pendente'", atrasados: "situacao = 'atrasado'", pagos: "situacao = 'pago'",
};

export class PagamentoService {
  constructor(private readonly db: Database, private readonly feriados: FeriadoService) {}

  /** Uma mensalidade por mês de plano; vencimento que cai em fim de semana/feriado vai para o próximo dia útil. */
  async gerarMensalidades(matriculaId: number): Promise<number> {
    const m = await this.db.um<{ data_inicio: string; duracao_meses: number; valor_mensal: number }>(
      `SELECT m.data_inicio, pl.duracao_meses, pl.valor_mensal FROM matriculas m
       JOIN planos pl ON pl.id = m.plano_id WHERE m.id = ?`, [matriculaId]);
    if (!m) throw new AppError('Matrícula não encontrada.');
    const vencimentos: string[] = [];
    for (let i = 0; i < m.duracao_meses; i++) vencimentos.push(await this.feriados.proximoDiaUtil(addMonths(m.data_inicio, i)));
    // Um único INSERT com todas as parcelas: ou entram todas, ou nenhuma.
    await this.db.executar(
      `INSERT INTO pagamentos (matricula_id, valor, vencimento) VALUES ${vencimentos.map(() => '(?, ?, ?)').join(', ')}`,
      vencimentos.flatMap((v) => [matriculaId, m.valor_mensal, v]));
    return vencimentos.length;
  }

  listar(filtro: FiltroPagamento): Promise<PagamentoLinha[]> {
    const clausula = CLAUSULAS[filtro] ?? CLAUSULAS.todos;
    const ordem = filtro === 'atrasados' ? 'ASC' : 'DESC';
    const hoje = hojeISO();
    return this.db.consultar<PagamentoLinha>(
      `SELECT * FROM (
         SELECT p.id, p.matricula_id, p.valor, p.vencimento, p.data_pagamento, p.forma, p.status,
                a.nome AS aluno_nome, pl.nome AS plano_nome,
                CASE WHEN p.status = 'pendente' AND p.vencimento < ? THEN 'atrasado' ELSE p.status END AS situacao,
                CASE WHEN p.status = 'pendente' AND p.vencimento < ? THEN DATEDIFF(?, p.vencimento) ELSE 0 END AS dias_atraso
         FROM pagamentos p
         JOIN matriculas m ON m.id = p.matricula_id
         JOIN alunos a ON a.id = m.aluno_id
         JOIN planos pl ON pl.id = m.plano_id) x
       WHERE ${clausula} ORDER BY vencimento ${ordem}, id`, [hoje, hoje, hoje]);
  }

  async registrarPagamento(id: number, forma: unknown): Promise<void> {
    if (!FORMAS_PAGAMENTO.some((f) => f.value === forma)) throw new AppError('Forma de pagamento inválida.');
    const r = await this.db.executar(
      "UPDATE pagamentos SET status = 'pago', data_pagamento = ?, forma = ? WHERE id = ? AND status = 'pendente'", [hojeISO(), forma, id]);
    if (r.affectedRows === 0) throw new AppError('Este pagamento não está pendente.');
  }

  async cancelarPendentes(matriculaId: number): Promise<void> {
    await this.db.executar("UPDATE pagamentos SET status = 'cancelado' WHERE matricula_id = ? AND status = 'pendente'", [matriculaId]);
  }
}
