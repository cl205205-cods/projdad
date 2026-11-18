// Serviço de CRUD das 9 entidades: permissão, validação, regras de negócio e gravação.
import { AppError } from '../AppError';
import type { Database } from '../database/Database';
import { EntityRepository } from '../database/EntityRepository';
import { ENTITIES, pode, type Acao, type EntityName, type Option } from '../../shared/entities';
import { addMonths, hojeISO } from '../../shared/dates';
import type { Row, SessionUser } from '../../shared/types';
import { PasswordHasher } from '../security/PasswordHasher';
import { Validator, type Limpo } from '../security/Validator';
import type { PagamentoService } from './PagamentoService';

// Meses de duração de cada tipo de plano
const MESES: Record<string, number> = { mensal: 1, trimestral: 3, anual: 12 };

/** CRUD das 9 entidades: permissão (RBAC) -> validação -> regras de negócio da entidade -> persistência. */
export class CrudService {
  // Um repositório (EntityRepository) por entidade
  private readonly repos = new Map<EntityName, EntityRepository>();

  constructor(private readonly db: Database, private readonly pagamentos: PagamentoService) {
    // Cria o repositório de cada entidade
    for (const def of Object.values(ENTITIES)) this.repos.set(def.name, new EntityRepository(db, def));
  }

  // Repositório da entidade pedida
  private repo(e: EntityName): EntityRepository { return this.repos.get(e)!; }

  // Confere a permissão (RBAC) do perfil para a ação
  private exigir(u: SessionUser, e: EntityName, acao: Acao): void {
    if (!pode(u.perfil, e, acao)) throw new AppError('Você não tem permissão para esta operação.');
  }

  // READ: lista os registros
  listar(u: SessionUser, e: EntityName): Promise<Row[]> { this.exigir(u, e, 'r'); return this.repo(e).listar(); }
  // READ: opções (id + rótulo) para listas suspensas
  opcoes(u: SessionUser, e: EntityName): Promise<Option[]> { this.exigir(u, e, 'r'); return this.repo(e).opcoes(); }

  // CREATE: valida, aplica as regras da entidade e grava
  async criar(u: SessionUser, e: EntityName, entrada: Record<string, unknown>): Promise<number> {
    this.exigir(u, e, 'c');
    const dados = Validator.limpar(ENTITIES[e], entrada, 'create');
    const extra = await this.antesDeSalvar(u, e, dados, 'create');
    const id = await this.repo(e).criar(dados, extra);
    // Nova matrícula gera as mensalidades do plano
    if (e === 'matriculas') {
      try { await this.pagamentos.gerarMensalidades(id); } // gera as mensalidades do plano
      catch (erro) { await this.repo(e).remover(id); throw erro; } // não deixa matrícula sem mensalidades
    }
    return id;
  }

  // UPDATE: valida, aplica as regras e atualiza
  async atualizar(u: SessionUser, e: EntityName, id: number, entrada: Record<string, unknown>): Promise<void> {
    this.exigir(u, e, 'u');
    const dados = Validator.limpar(ENTITIES[e], entrada, 'update');
    const extra = await this.antesDeSalvar(u, e, dados, 'update', id);
    if (!(await this.repo(e).atualizar(id, dados, extra))) throw new AppError('Registro não encontrado.');
    // Matrícula cancelada cancela as mensalidades pendentes
    if (e === 'matriculas' && dados.status === 'cancelada') await this.pagamentos.cancelarPendentes(id);
  }

  // DELETE: o usuário não pode excluir a si mesmo nem o último administrador
  async remover(u: SessionUser, e: EntityName, id: number): Promise<void> {
    this.exigir(u, e, 'd');
    if (e === 'usuarios') {
      if (id === u.id) throw new AppError('Você não pode excluir o próprio usuário.');
      await this.garantirOutroAdmin(id);
    }
    if (!(await this.repo(e).remover(id))) throw new AppError('Registro não encontrado.');
  }

  /** Regras específicas por entidade. Devolve colunas extras (calculadas pelo sistema, nunca vindas do formulário). */
  private async antesDeSalvar(u: SessionUser, e: EntityName, d: Limpo, modo: 'create' | 'update', id?: number): Promise<Limpo> {
    switch (e) {
      // Plano: duração em meses calculada pelo tipo
      case 'planos':
        return { duracao_meses: MESES[String(d.tipo)] };
      // Matrícula: data de término = início + duração do plano
      case 'matriculas': {
        const p = await this.db.um<{ duracao_meses: number }>('SELECT duracao_meses FROM planos WHERE id = ?', [d.plano_id]);
        if (!p) throw new AppError('Corrija os campos destacados.', { plano_id: 'Plano não encontrado.' });
        d.data_fim = addMonths(String(d.data_inicio), p.duracao_meses);
        return {};
      }
      // Pagamento: a data de pagamento só existe quando o status é pago
      case 'pagamentos':
        d.data_pagamento = d.status === 'pago' ? (d.data_pagamento ?? hojeISO()) : null;
        return {};
      // Usuário: protege o próprio perfil e o último admin; a senha vira hash
      case 'usuarios': {
        if (modo === 'update') {
          if (id === u.id && (d.perfil !== u.perfil || d.ativo === 0))
            throw new AppError('Você não pode alterar o próprio perfil nem se desativar.');
          if (d.perfil !== 'admin' || d.ativo === 0) await this.garantirOutroAdmin(id!);
        }
        return d.senha ? { senha_hash: PasswordHasher.hash(String(d.senha)) } : {};
      }
      // Demais entidades: sem regra extra
      default:
        return {};
    }
  }

  /** Impede ficar sem nenhum administrador ativo. */
  private async garantirOutroAdmin(id: number): Promise<void> {
    const alvo = await this.db.um<{ perfil: string; ativo: number }>('SELECT perfil, ativo FROM usuarios WHERE id = ?', [id]);
    if (alvo?.perfil !== 'admin' || !alvo.ativo) return;
    const outros = (await this.db.um<{ c: number }>("SELECT COUNT(*) AS c FROM usuarios WHERE perfil = 'admin' AND ativo = 1 AND id <> ?", [id]))?.c ?? 0;
    if (outros === 0) throw new AppError('Precisa existir ao menos um administrador ativo.');
  }
}
