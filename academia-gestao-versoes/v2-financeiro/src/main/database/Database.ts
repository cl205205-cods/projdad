import type { ResultSetHeader } from 'mysql2';
import { conexao, reconectar } from '../conexao';
import { SCHEMA_STATEMENTS } from './schema';

/**
 * Acesso ao MySQL. Cada consulta envolve conexao.query num `new Promise` (resolve/reject), como na aula,
 * para que o resto do código possa usar async/await.
 */
export class Database {
  private rodar<T>(sql: string, params: unknown[], jaTentouReconectar = false): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      conexao.query(sql, params, (erro, resultado) => {
        if (erro) {
          // Conexão derrubada (ex.: notebook em repouso): recria e repete UMA vez; o comando nem chegou a ser enviado.
          if (!jaTentouReconectar && /closed state|PROTOCOL_ENQUEUE/i.test(`${erro.message} ${erro.code ?? ''}`)) {
            reconectar();
            this.rodar<T>(sql, params, true).then(resolve, reject);
            return;
          }
          reject(erro);
          return;
        }
        resolve(resultado as unknown as T);
      });
    });
  }

  consultar<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.rodar<T[]>(sql, params); }
  async um<T>(sql: string, params: unknown[] = []): Promise<T | undefined> { return (await this.consultar<T>(sql, params))[0]; }
  executar(sql: string, params: unknown[] = []): Promise<ResultSetHeader> { return this.rodar<ResultSetHeader>(sql, params); }

  /** Cria as tabelas que faltarem e carrega o catálogo inicial uma única vez. */
  async migrar(): Promise<void> {
    for (const ddl of SCHEMA_STATEMENTS) await this.executar(ddl);
    const feito = await this.um<{ c: number }>("SELECT COUNT(*) AS c FROM configuracoes WHERE chave = 'catalogo_inicial'");
    if (feito && feito.c > 0) return;
    await this.executar(
      'INSERT IGNORE INTO modalidades (nome, descricao) VALUES (?, ?), (?, ?), (?, ?)',
      ['Musculação', 'Treino com pesos e máquinas, na sala de musculação.',
        'Funcional', 'Circuitos de condicionamento com peso corporal.',
        'Dança', 'Aulas de dança com foco em ritmo e condicionamento.']);
    await this.executar(
      'INSERT INTO planos (nome, tipo, duracao_meses, valor_mensal) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)',
      ['Plano Mensal', 'mensal', 1, 99.9, 'Plano Trimestral', 'trimestral', 3, 89.9, 'Plano Anual', 'anual', 12, 79.9]);
    await this.executar("INSERT INTO configuracoes (chave, valor) VALUES ('catalogo_inicial', '1')");
  }

  fechar(): Promise<void> {
    return new Promise((resolve) => conexao.end(() => resolve()));
  }
}
