import { AppError, traduzirErroBanco } from '../AppError';
import { ENTITIES, type EntityName, type Perfil } from '../../shared/entities';
import type { Resultado, SessionUser } from '../../shared/types';
import type { AuthService } from '../services/AuthService';
import type { CrudService } from '../services/CrudService';
import type { CepService } from '../services/CepService';

export interface Servicos {
  auth: AuthService; crud: CrudService; cep: CepService;
}
type Payload = Record<string, unknown>;
interface Rota { aberta?: boolean; perfis?: Perfil[]; exec: (p: Payload, u: SessionUser) => unknown }

const entidade = (p: Payload): EntityName => {
  if (typeof p.entidade !== 'string' || !Object.hasOwn(ENTITIES, p.entidade)) throw new AppError('Entidade inválida.');
  return p.entidade as EntityName;
};
const inteiro = (p: Payload, chave: string): number => {
  const n = Number(p[chave]);
  if (!Number.isInteger(n) || n <= 0) throw new AppError('Identificador inválido.');
  return n;
};
const objeto = (v: unknown): Payload =>
  (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Payload;

/** Tabela única de operações expostas ao renderer. Cada rota declara quem pode chamá-la. */
export class IpcRouter {
  private readonly rotas = new Map<string, Rota>();

  constructor(private readonly s: Servicos) {
    const r = this.rotas;
    // --- sessão (únicas rotas abertas)
    r.set('auth:status', { aberta: true, exec: async () => ({ precisaConfigurar: await s.auth.precisaConfigurar(), usuario: s.auth.usuario() }) });
    r.set('auth:configurar', { aberta: true, exec: (p) => s.auth.configurar(p.nome, p.email, p.senha) });
    r.set('auth:entrar', { aberta: true, exec: (p) => s.auth.entrar(p.email, p.senha) });
    r.set('auth:sair', { aberta: true, exec: () => s.auth.sair() });
    // --- CRUD genérico (permissão por entidade/ação dentro do CrudService)
    r.set('crud:listar', { exec: (p, u) => s.crud.listar(u, entidade(p)) });
    r.set('crud:opcoes', { exec: (p, u) => s.crud.opcoes(u, entidade(p)) });
    r.set('crud:criar', { exec: (p, u) => s.crud.criar(u, entidade(p), objeto(p.dados)) });
    r.set('crud:atualizar', { exec: (p, u) => s.crud.atualizar(u, entidade(p), inteiro(p, 'id'), objeto(p.dados)) });
    r.set('crud:remover', { exec: (p, u) => s.crud.remover(u, entidade(p), inteiro(p, 'id')) });
    // --- operações específicas
    r.set('cep:buscar', { exec: (p) => s.cep.buscar(String(p.cep ?? '')) });
  }

  canais(): string[] { return [...this.rotas.keys()]; }

  async despachar(canal: string, bruto: unknown): Promise<Resultado> {
    try {
      const rota = this.rotas.get(canal);
      if (!rota) throw new AppError('Operação desconhecida.');
      const u = this.s.auth.usuario();
      if (!rota.aberta) {
        if (!u) throw new AppError('Sessão expirada. Entre novamente.');
        if (rota.perfis && !rota.perfis.includes(u.perfil)) throw new AppError('Você não tem permissão para esta operação.');
      }
      return { ok: true, data: await rota.exec(objeto(bruto), u as SessionUser) };
    } catch (e) {
      const amigavel = e instanceof AppError ? e : traduzirErroBanco(e);
      if (amigavel) return { ok: false, error: amigavel.message, fields: amigavel.fields };
      console.error(`[ipc] ${canal}:`, e); // detalhes só no log local, nunca para a interface
      return { ok: false, error: 'Erro interno. Tente novamente.' };
    }
  }
}
