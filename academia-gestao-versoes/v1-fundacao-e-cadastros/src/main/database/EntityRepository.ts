import { ENTITIES, type EntityDef, type EntityName, type Field, type Option } from '../../shared/entities';
import type { Row } from '../../shared/types';
import type { Limpo } from '../security/Validator';
import type { Database } from './Database';

/** Como cada entidade aparece em listas suspensas / colunas de referência. {a} = alias da tabela. */
const LABEL_SQL: Record<EntityName, string> = {
  alunos: '{a}.nome', instrutores: '{a}.nome', modalidades: '{a}.nome', planos: '{a}.nome', usuarios: '{a}.nome',
};

const q = (nome: string): string => `\`${nome}\``;

/** CRUD genérico dirigido pelos metadados. Nomes de tabela/coluna vêm só do código; valores sempre por parâmetro (?). */
export class EntityRepository {
  private readonly cols: string[];

  constructor(private readonly db: Database, private readonly def: EntityDef) {
    this.cols = def.fields.filter((f) => !f.virtual).map((f) => f.name);
  }

  private campo(f: Field): string {
    // TIME vem do MySQL como "07:00:00"; a interface trabalha com "07:00".
    return f.type === 'time' ? `TIME_FORMAT(t.${q(f.name)}, '%H:%i') AS ${q(f.name)}` : `t.${q(f.name)}`;
  }

  private selectSql(): string {
    const refs = this.def.fields.filter((f) => f.type === 'ref').map((f) => {
      const alvo = ENTITIES[f.ref!];
      return `(SELECT ${LABEL_SQL[alvo.name].replaceAll('{a}', 'r')} FROM ${q(alvo.table)} r WHERE r.id = t.${q(f.name)}) AS ${q(f.name + '_label')}`;
    });
    const campos = ['t.id', ...this.def.fields.filter((f) => !f.virtual).map((f) => this.campo(f)), ...refs];
    return `SELECT ${campos.join(', ')} FROM ${q(this.def.table)} t`;
  }

  listar(): Promise<Row[]> {
    return this.db.consultar<Row>(`${this.selectSql()} ORDER BY ${this.def.orderBy}`);
  }

  buscar(id: number): Promise<Row | undefined> {
    return this.db.um<Row>(`${this.selectSql()} WHERE t.id = ?`, [id]);
  }

  opcoes(): Promise<Option[]> {
    const label = LABEL_SQL[this.def.name].replaceAll('{a}', 't');
    return this.db.consultar<Option>(`SELECT t.id AS value, ${label} AS label FROM ${q(this.def.table)} t ORDER BY label`);
  }

  private colunas(extra: Limpo): string[] {
    const nomes = Object.keys(extra);
    if (nomes.some((n) => !/^[a-z_]+$/.test(n))) throw new Error('coluna extra inválida');
    return [...this.cols, ...nomes];
  }

  private valor(c: string, dados: Limpo, extra: Limpo): string | number | null {
    return (c in extra ? extra[c] : dados[c]) ?? null;
  }

  async criar(dados: Limpo, extra: Limpo = {}): Promise<number> {
    const cols = this.colunas(extra);
    const sql = `INSERT INTO ${q(this.def.table)} (${cols.map(q).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    return (await this.db.executar(sql, cols.map((c) => this.valor(c, dados, extra)))).insertId;
  }

  async atualizar(id: number, dados: Limpo, extra: Limpo = {}): Promise<boolean> {
    const cols = this.colunas(extra);
    const sql = `UPDATE ${q(this.def.table)} SET ${cols.map((c) => `${q(c)} = ?`).join(', ')} WHERE id = ?`;
    return (await this.db.executar(sql, [...cols.map((c) => this.valor(c, dados, extra)), id])).affectedRows > 0;
  }

  async remover(id: number): Promise<boolean> {
    return (await this.db.executar(`DELETE FROM ${q(this.def.table)} WHERE id = ?`, [id])).affectedRows > 0;
  }
}
