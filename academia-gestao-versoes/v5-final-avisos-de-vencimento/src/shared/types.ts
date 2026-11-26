// Tipos compartilhados entre o main e a interface.
import type { Perfil } from './entities';

// Usuário logado
export interface SessionUser { id: number; nome: string; email: string; perfil: Perfil }

// Formato de toda resposta do main: sucesso com dados ou erro com mensagem segura
export type Resultado<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string> };

// Linha genérica de tabela
export type Row = Record<string, string | number | null>;

// Alerta de chuva de uma aula ao ar livre
export interface AlertaChuva {
  aulaId: number; modalidade: string; instrutor: string; local: string | null;
  data: string; hora: string; probabilidade: number; mm: number;
  vaiChover: boolean; feriado: string | null; novo: boolean;
}

// Plano perto de vencer
export interface Vencimento {
  matriculaId: number; alunoId: number; aluno: string; plano: string; dataFim: string;
  diasRestantes: number; telefone: string | null; temTelegram: boolean; avisado: boolean;
}

// Resultado de um envio de mensagem
export interface ResultadoEnvio { status: 'enviado' | 'simulado' | 'falha' | 'sem_contato'; detalhe?: string }

// Registro do histórico de avisos
export interface Aviso {
  id: number; tipo: string; mensagem: string; canal: string; status: string; criado_em: string; aluno: string | null;
}

// Configurações do sistema
export interface Configuracoes {
  academiaNome: string; latitude: number; longitude: number; limiarChuva: number;
  horasAntecedencia: number; diasAvisoVencimento: number; envioAutomatico: boolean; telegramConfigurado: boolean;
}

// Números do painel inicial
export interface ResumoDashboard {
  alunosAtivos: number; matriculasAtivas: number; vencendo: number;
  financeiro: { atrasados: number; valorAtrasado: number; recebidoNoMes: number } | null;
  aulasHoje: { hora: string; modalidade: string; instrutor: string; aoArLivre: boolean }[];
}

// Um ponto da evolução física (inclui o IMC)
export interface PontoAvaliacao {
  data: string; peso_kg: number | null; altura_cm: number | null; cintura_cm: number | null;
  gordura_pct: number | null; imc: number | null;
}

// ---- Relatórios (cada perfil recebe um conjunto próprio, montado no main) ----
// Período em meses cobertos pelo relatório
export type PeriodoRelatorio = 3 | 6 | 12;
// Como um número deve ser exibido
export type FormatoValor = 'moeda' | 'numero' | 'percentual';
// Indicador numérico (KPI)
export interface KpiRelatorio {
  rotulo: string; valor: number; formato: FormatoValor;
  detalhe?: string; tom?: 'ok' | 'atencao' | 'alerta' | 'info';
}
// Ponto de um gráfico (barras, linha ou rosca)
export interface PontoGrafico { rotulo: string; valor: number }
// Gráfico do relatório
export interface GraficoRelatorio {
  tipo: 'barras' | 'linha' | 'rosca'; titulo: string; unidade?: string;
  formato: FormatoValor; dados: PontoGrafico[];
}
// Tabela detalhada do relatório (células já formatadas para exibição e CSV)
export interface TabelaRelatorio { titulo: string; colunas: string[]; linhas: string[][] }
// Relatório completo de um perfil
export interface Relatorio {
  perfil: Perfil; periodo: PeriodoRelatorio; titulo: string; descricao: string;
  kpis: KpiRelatorio[]; graficos: GraficoRelatorio[]; tabela: TabelaRelatorio;
}

// Pagamento com nome do aluno e do plano e a situação
export interface PagamentoLinha extends Row {
  aluno_nome: string; plano_nome: string; situacao: 'pago' | 'pendente' | 'atrasado' | 'cancelado'; dias_atraso: number;
}
