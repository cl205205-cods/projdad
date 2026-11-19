// Repositório genérico: faz o CRUD de qualquer entidade a partir dos metadados (entities.ts).
import { ENTITIES, type EntityDef, type EntityName, type Field, type Option } from '../../shared/entities';
import type { Row } from '../../shared/types';
import type { Limpo } from '../security/Validator';
import type { Database } from './Database';

/** Como cada entidade aparece em listas suspensas / colunas de referência. {a} = alias da tabela. */
const LABEL_SQL: Record<EntityName, string> = {
  alunos: '{a}.nome', instrutores: '{a}.nome', modalidades: '{a}.nome', planos: '{a}.nome', usuarios: '{a}.nome',
  aulas: "CONCAT((SELECT m.nome FROM modalidades m WHERE m.id = {a}.modalidade_id), ' - ', ELT({a}.dia_semana + 1, 'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'), ' ', TIME_FORMAT({a}.hora_inicio, '%H:%i'))",
  matriculas: "CONCAT((SELECT al.nome FROM alunos al WHERE al.id = {a}.aluno_id), ' - ', (SELECT p.nome FROM planos p WHERE p.id = {a}.plano_id))",
  pagamentos: "CONCAT('Pagamento #', {a}.id, ' (venc. ', {a}.vencimento, ')')",
  avaliacoes: "CONCAT('Avaliação de ', {a}.data)",
};

// Coloca crases no nome de tabela/coluna
const q = (nome: string): string => `\`${nome}\``;

/** CRUD genérico dirigido pelos metadados. Nomes de tabela/coluna vêm só do código; valores sempre por parâmetro (?). */
export class EntityRepository {
  // Colunas reais da tabela (ignora campos virtuais)
  private readonly cols: string[];

  constructor(private readonly db: Database, private readonly def: EntityDef) {
    this.cols = def.fields.filter((f) => !f.virtual).map((f) => f.name);
  }

  // Expressão SQL de um campo na listagem
  private campo(f: Field): string {
    // TIME vem do MySQL como "07:00:00"; a interface trabalha com "07:00".
    return f.type === 'time' ? `TIME_FORMAT(t.${q(f.name)}, '%H:%i') AS ${q(f.name)}` : `t.${q(f.name)}`;
  }

  // Monta o SELECT com os rótulos das referências (ex.: nome do aluno)
  private selectSql(): string {
    const refs = this.def.fields.filter((f) => f.type === 'ref').map((f) => {
      const alvo = ENTITIES[f.ref!];
      return `(SELECT ${LABEL_SQL[alvo.name].replaceAll('{a}', 'r')} FROM ${q(alvo.table)} r WHERE r.id = t.${q(f.name)}) AS ${q(f.name + '_label')}`;
    });
    const campos = ['t.id', ...this.def.fields.filter((f) => !f.virtual).map((f) => this.campo(f)), ...refs];
    return `SELECT ${campos.join(', ')} FROM ${q(this.def.table)} t`;
  }

  // READ: todas as linhas, na ordem da entidade
  listar(): Promise<Row[]> {
    return this.db.consultar<Row>(`${this.selectSql()} ORDER BY ${this.def.orderBy}`);
  }

  // READ: uma linha pelo id
  buscar(id: number): Promise<Row | undefined> {
    return this.db.um<Row>(`${this.selectSql()} WHERE t.id = ?`, [id]);
  }

  // Opções (id + rótulo) para listas suspensas
  opcoes(): Promise<Option[]> {
    const label = LABEL_SQL[this.def.name].replaceAll('{a}', 't');
    return this.db.consultar<Option>(`SELECT t.id AS value, ${label} AS label FROM ${q(this.def.table)} t ORDER BY label`);
  }

  // Colunas a gravar; recusa nomes inválidos
  private colunas(extra: Limpo): string[] {
    const nomes = Object.keys(extra);
    if (nomes.some((n) => !/^[a-z_]+$/.test(n))) throw new Error('coluna extra inválida');
    return [...this.cols, ...nomes];
  }

  // Valor de uma coluna (o extra calculado pelo sistema tem prioridade)
  private valor(c: string, dados: Limpo, extra: Limpo): string | number | null {
    return (c in extra ? extra[c] : dados[c]) ?? null;
  }

  // CREATE: INSERT parametrizado
  async criar(dados: Limpo, extra: Limpo = {}): Promise<number> {
    const cols = this.colunas(extra);
    const sql = `INSERT INTO ${q(this.def.table)} (${cols.map(q).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    return (await this.db.executar(sql, cols.map((c) => this.valor(c, dados, extra)))).insertId;
  }

  // UPDATE: UPDATE parametrizado
  async atualizar(id: number, dados: Limpo, extra: Limpo = {}): Promise<boolean> {
    const cols = this.colunas(extra);
    const sql = `UPDATE ${q(this.def.table)} SET ${cols.map((c) => `${q(c)} = ?`).join(', ')} WHERE id = ?`;
    return (await this.db.executar(sql, [...cols.map((c) => this.valor(c, dados, extra)), id])).affectedRows > 0;
  }

  // DELETE: remove pelo id
  async remover(id: number): Promise<boolean> {
    return (await this.db.executar(`DELETE FROM ${q(this.def.table)} WHERE id = ?`, [id])).affectedRows > 0;
  }
}
