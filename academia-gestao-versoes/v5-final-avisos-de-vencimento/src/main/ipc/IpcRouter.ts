// Roteador IPC: tabela única das operações que a interface pode pedir ao main, cada uma com os perfis permitidos.
import { AppError, traduzirErroBanco } from '../AppError';
import { ENTITIES, type EntityName, type Perfil } from '../../shared/entities';
import type { Resultado, SessionUser } from '../../shared/types';
import type { AuthService } from '../services/AuthService';
import type { CrudService } from '../services/CrudService';
import type { PagamentoService, FiltroPagamento } from '../services/PagamentoService';
import type { AvaliacaoService } from '../services/AvaliacaoService';
import type { CepService } from '../services/CepService';
import type { DashboardService } from '../services/DashboardService';
import type { AlertaService } from '../services/AlertaService';
import type { ConfigService } from '../services/ConfigService';
import type { MensagemService } from '../services/MensagemService';
import { periodoValido, type RelatorioService } from '../services/RelatorioService';
import { pode } from '../../shared/entities';

// Conjunto de serviços injetados no roteador
export interface Servicos {
  auth: AuthService; crud: CrudService; pagamentos: PagamentoService; avaliacoes: AvaliacaoService;
  cep: CepService; dashboard: DashboardService; alertas: AlertaService; config: ConfigService; mensagens: MensagemService;
  relatorios: RelatorioService;
}
type Payload = Record<string, unknown>;
// Uma rota: se é aberta (sem login), quais perfis podem usá-la e a função que executa
interface Rota { aberta?: boolean; perfis?: Perfil[]; exec: (p: Payload, u: SessionUser) => unknown }

// Perfis de gestão (administrador e recepção)
const GESTAO: Perfil[] = ['admin', 'recepcao'];
// Valida o nome da entidade recebido da interface (só aceita as conhecidas)
const entidade = (p: Payload): EntityName => {
  if (typeof p.entidade !== 'string' || !Object.hasOwn(ENTITIES, p.entidade)) throw new AppError('Entidade inválida.');
  return p.entidade as EntityName;
};
// Valida identificadores numéricos positivos
const inteiro = (p: Payload, chave: string): number => {
  const n = Number(p[chave]);
  if (!Number.isInteger(n) || n <= 0) throw new AppError('Identificador inválido.');
  return n;
};
// Garante que o payload recebido é um objeto simples
const objeto = (v: unknown): Payload =>
  (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Payload;

/** Tabela única de operações expostas ao renderer. Cada rota declara quem pode chamá-la. */
export class IpcRouter {
  // Mapa: nome da rota -> definição da rota
  private readonly rotas = new Map<string, Rota>();

  // Registra todas as rotas disponíveis
  constructor(
    private readonly s: Servicos,
    private readonly abrirExterno: (url: string) => void,
    private readonly salvarArquivo: (nome: string, conteudo: string) => Promise<boolean>,
  ) {
    const r = this.rotas;
    // --- sessão (únicas rotas abertas)
    // Estado da sessão: usuário logado e se precisa criar o administrador
    r.set('auth:status', { aberta: true, exec: async () => ({ precisaConfigurar: await s.auth.precisaConfigurar(), usuario: s.auth.usuario() }) });
    // Primeiro acesso: cria o administrador
    r.set('auth:configurar', { aberta: true, exec: (p) => s.auth.configurar(p.nome, p.email, p.senha) });
    // Login
    r.set('auth:entrar', { aberta: true, exec: (p) => s.auth.entrar(p.email, p.senha) });
    // Logout
    r.set('auth:sair', { aberta: true, exec: () => s.auth.sair() });
    // --- CRUD genérico (permissão por entidade/ação dentro do CrudService)
    // CRUD (READ): lista os registros da entidade
    r.set('crud:listar', { exec: (p, u) => s.crud.listar(u, entidade(p)) });
    // Opções (id + rótulo) para as listas suspensas
    r.set('crud:opcoes', { exec: (p, u) => s.crud.opcoes(u, entidade(p)) });
    // CRUD (CREATE): cadastra um registro
    r.set('crud:criar', { exec: (p, u) => s.crud.criar(u, entidade(p), objeto(p.dados)) });
    // CRUD (UPDATE): edita um registro
    r.set('crud:atualizar', { exec: (p, u) => s.crud.atualizar(u, entidade(p), inteiro(p, 'id'), objeto(p.dados)) });
    // CRUD (DELETE): exclui um registro
    r.set('crud:remover', { exec: (p, u) => s.crud.remover(u, entidade(p), inteiro(p, 'id')) });
    // --- operações específicas
    // Pagamentos: lista com filtro (atrasados, a vencer, pagos)
    r.set('pagamentos:listar', { perfis: GESTAO, exec: (p) => s.pagamentos.listar(String(p.filtro) as FiltroPagamento) });
    // Registra o pagamento de uma mensalidade
    r.set('pagamentos:pagar', { perfis: GESTAO, exec: (p) => s.pagamentos.registrarPagamento(inteiro(p, 'id'), p.forma) });
    // Evolução (peso, IMC e medidas) de um aluno
    r.set('avaliacoes:evolucao', {
      exec: (p, u) => {
        if (!pode(u.perfil, 'avaliacoes', 'r')) throw new AppError('Você não tem permissão para esta operação.');
        return s.avaliacoes.evolucao(inteiro(p, 'alunoId'));
      },
    });
    // API ViaCEP: busca o endereço pelo CEP
    r.set('cep:buscar', { exec: (p) => s.cep.buscar(String(p.cep ?? '')) });
    // Números do painel inicial
    r.set('dashboard:resumo', { exec: (_p, u) => s.dashboard.resumo(u.perfil) });
    // Relatório do perfil logado (o main escolhe os dados; o renderer não informa o perfil)
    r.set('relatorios:obter', { exec: (p, u) => s.relatorios.obter(u.perfil, periodoValido(p.periodo)) });
    // Exporta o relatório em CSV: o conteúdo é gerado no main e salvo pelo diálogo nativo
    r.set('relatorios:exportar', {
      exec: async (p, u) => {
        const arquivo = await s.relatorios.csv(u.perfil, periodoValido(p.periodo));
        return { salvo: await this.salvarArquivo(arquivo.nome, arquivo.conteudo) };
      },
    });
    // API Open-Meteo: previsão de chuva das aulas ao ar livre
    r.set('alertas:chuva', { exec: () => s.alertas.verificarChuva() });
    // Planos perto de vencer
    r.set('alertas:vencimentos', { perfis: GESTAO, exec: () => s.alertas.listarVencimentos() });
    // Envia o aviso de vencimento de uma matrícula pelo Telegram
    r.set('alertas:enviar', { perfis: GESTAO, exec: (p) => s.alertas.enviarVencimento(inteiro(p, 'matriculaId')) });
    // Envia todos os avisos de vencimento pendentes
    r.set('alertas:enviarTodos', { perfis: GESTAO, exec: () => s.alertas.enviarTodosVencimentos() });
    // Abre o WhatsApp com a mensagem pronta (link wa.me)
    r.set('alertas:whatsapp', {
      perfis: GESTAO,
      exec: async (p) => { this.abrirExterno(await s.alertas.linkWhatsApp(inteiro(p, 'matriculaId'))); return true; },
    });
    // Histórico de avisos
    r.set('avisos:listar', { perfis: GESTAO, exec: () => s.alertas.listarAvisos() });
    // Configurações do sistema (só administrador)
    r.set('config:obter', { perfis: ['admin'], exec: async () => { await s.config.carregar(); return s.config.obter(); } });
    // Salva as configurações (só administrador)
    r.set('config:salvar', { perfis: ['admin'], exec: async (p) => { await s.config.salvar(p); return s.config.obter(); } });
    // Botão "Testar conexão" do Telegram (só administrador)
    r.set('config:testarTelegram', { perfis: ['admin'], exec: (p) => s.mensagens.testar(String(p.chatId ?? '')) });
  }

  // Lista os nomes das rotas para registro no Electron
  canais(): string[] { return [...this.rotas.keys()]; }

  // Executa uma rota: confere login e perfil, roda e devolve {ok, data} ou um erro seguro
  async despachar(canal: string, bruto: unknown): Promise<Resultado> {
    try {
      // A rota existe?
      const rota = this.rotas.get(canal);
      if (!rota) throw new AppError('Operação desconhecida.');
      const u = this.s.auth.usuario();
      // Rotas fechadas exigem usuário logado e perfil permitido
      if (!rota.aberta) {
        if (!u) throw new AppError('Sessão expirada. Entre novamente.');
        if (rota.perfis && !rota.perfis.includes(u.perfil)) throw new AppError('Você não tem permissão para esta operação.');
      }
      return { ok: true, data: await rota.exec(objeto(bruto), u as SessionUser) };
    } catch (e) {
      // Erros conhecidos viram mensagem amigável; os demais vão só para o log
      const amigavel = e instanceof AppError ? e : traduzirErroBanco(e);
      if (amigavel) return { ok: false, error: amigavel.message, fields: amigavel.fields };
      console.error(`[ipc] ${canal}:`, e); // detalhes só no log local, nunca para a interface
      return { ok: false, error: 'Erro interno. Tente novamente.' };
    }
  }
}
