import type { Database } from '../database/Database';
import type { PontoAvaliacao } from '../../shared/types';

export class AvaliacaoService {
  constructor(private readonly db: Database) {}

  /** Série temporal das avaliações do aluno, com IMC calculado (usa a última altura informada). */
  async evolucao(alunoId: number): Promise<PontoAvaliacao[]> {
    const linhas = await this.db.consultar<Omit<PontoAvaliacao, 'imc'>>(
      'SELECT `data`, peso_kg, altura_cm, cintura_cm, gordura_pct FROM avaliacoes_fisicas WHERE aluno_id = ? ORDER BY `data`, id', [alunoId]);
    let altura: number | null = null;
    return linhas.map((l) => {
      altura = l.altura_cm ?? altura;
      const imc = l.peso_kg && altura ? Math.round((l.peso_kg / (altura / 100) ** 2) * 10) / 10 : null;
      return { ...l, imc };
    });
  }
}
