import { AppError } from '../AppError';
import type { Database } from '../database/Database';
import { ENTITIES } from '../../shared/entities';
import type { Perfil } from '../../shared/entities';
import type { SessionUser } from '../../shared/types';
import { PasswordHasher } from '../security/PasswordHasher';
import { Validator } from '../security/Validator';

const MAX_TENTATIVAS = 5;
interface LinhaUsuario { id: number; nome: string; email: string; senha_hash: string; perfil: Perfil; ativo: number; tentativas_falhas: number; bloqueado: number }

/** Autenticação. A sessão vive só na memória do processo main: o renderer não consegue forjar perfil. */
export class AuthService {
  private atual: SessionUser | null = null;
  private readonly hashFalso = PasswordHasher.hash('senha-inexistente-1'); // equaliza o tempo de resposta

  constructor(private readonly db: Database) {}

  usuario(): SessionUser | null { return this.atual; }
  sair(): void { this.atual = null; }

  async precisaConfigurar(): Promise<boolean> {
    return ((await this.db.um<{ c: number }>('SELECT COUNT(*) AS c FROM usuarios'))?.c ?? 0) === 0;
  }

  /** Primeiro acesso: cria o administrador. Não existe senha padrão no sistema. */
  async configurar(nome: unknown, email: unknown, senha: unknown): Promise<SessionUser> {
    if (!(await this.precisaConfigurar())) throw new AppError('O sistema já foi configurado.');
    const d = Validator.limpar(ENTITIES.usuarios, { nome, email, senha, perfil: 'admin', ativo: 1 }, 'create');
    const r = await this.db.executar('INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
      [d.nome, d.email, PasswordHasher.hash(String(d.senha)), 'admin']);
    return (this.atual = { id: r.insertId, nome: String(d.nome), email: String(d.email), perfil: 'admin' });
  }

  async entrar(email: unknown, senha: unknown): Promise<SessionUser> {
    const generico = new AppError('E-mail ou senha incorretos.');
    if (typeof email !== 'string' || typeof senha !== 'string' || senha.length > 128) throw generico;
    const u = await this.db.um<LinhaUsuario>(
      'SELECT *, (bloqueado_ate IS NOT NULL AND bloqueado_ate > NOW()) AS bloqueado FROM usuarios WHERE email = ?',
      [email.trim().toLowerCase()]);
    if (!u) { PasswordHasher.verify(senha, this.hashFalso); throw generico; }
    if (u.bloqueado) throw new AppError('Muitas tentativas. Aguarde alguns minutos e tente de novo.');
    if (!u.ativo || !PasswordHasher.verify(senha, u.senha_hash)) {
      if (u.tentativas_falhas + 1 >= MAX_TENTATIVAS)
        await this.db.executar('UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE id = ?', [u.id]);
      else await this.db.executar('UPDATE usuarios SET tentativas_falhas = ? WHERE id = ?', [u.tentativas_falhas + 1, u.id]);
      throw generico;
    }
    await this.db.executar('UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = ?', [u.id]);
    return (this.atual = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil });
  }
}
