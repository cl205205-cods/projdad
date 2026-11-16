import type { Database } from '../database/Database';
import type { Perfil } from '../../shared/entities';
import { hojeISO } from '../../shared/dates';
import type { ResumoDashboard } from '../../shared/types';

export class DashboardService {
  constructor(private readonly db: Database) {}

  async resumo(perfil: Perfil): Promise<ResumoDashboard> {
    const hoje = hojeISO();
    const um = async <T>(sql: string, ...p: unknown[]): Promise<T> => (await this.db.um<T>(sql, p))!;
    const [alunos, matriculas, atras, recebido, aulas] = await Promise.all([
      um<{ n: number }>('SELECT COUNT(*) AS n FROM alunos WHERE ativo = 1'),
      um<{ n: number }>("SELECT COUNT(*) AS n FROM matriculas WHERE status = 'ativa' AND data_fim >= ?", hoje),
      um<{ n: number; v: number }>("SELECT COUNT(*) AS n, COALESCE(SUM(valor), 0) AS v FROM pagamentos WHERE status = 'pendente' AND vencimento < ?", hoje),
      um<{ v: number }>("SELECT COALESCE(SUM(valor), 0) AS v FROM pagamentos WHERE status = 'pago' AND DATE_FORMAT(data_pagamento, '%Y-%m') = ?", hoje.slice(0, 7)),
      this.db.consultar<{ hora: string; modalidade: string; instrutor: string; aoArLivre: number }>(
        `SELECT TIME_FORMAT(a.hora_inicio, '%H:%i') AS hora, m.nome AS modalidade, i.nome AS instrutor, a.ao_ar_livre AS aoArLivre
         FROM aulas a JOIN modalidades m ON m.id = a.modalidade_id JOIN instrutores i ON i.id = a.instrutor_id
         WHERE a.dia_semana = ? ORDER BY a.hora_inicio`, [new Date().getDay()]),
    ]);
    return {
      alunosAtivos: alunos.n, matriculasAtivas: matriculas.n,
      financeiro: perfil === 'instrutor' ? null : { atrasados: atras.n, valorAtrasado: Number(atras.v), recebidoNoMes: Number(recebido.v) },
      aulasHoje: aulas.map((a) => ({ ...a, aoArLivre: a.aoArLivre === 1 })),
    };
  }
}
