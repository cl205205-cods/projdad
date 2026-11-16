import type { Perfil } from './entities';

export interface SessionUser { id: number; nome: string; email: string; perfil: Perfil }

export type Resultado<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string> };

export type Row = Record<string, string | number | null>;

export interface AlertaChuva {
  aulaId: number; modalidade: string; instrutor: string; local: string | null;
  data: string; hora: string; probabilidade: number; mm: number;
  vaiChover: boolean; feriado: string | null; novo: boolean;
}



export interface Aviso {
  id: number; tipo: string; mensagem: string; canal: string; status: string; criado_em: string; aluno: string | null;
}

export interface Configuracoes {
  academiaNome: string; latitude: number; longitude: number; limiarChuva: number;
  horasAntecedencia: number; diasAvisoVencimento: number;
}

export interface ResumoDashboard {
  alunosAtivos: number; matriculasAtivas: number; vencendo: number;
  financeiro: { atrasados: number; valorAtrasado: number; recebidoNoMes: number } | null;
  aulasHoje: { hora: string; modalidade: string; instrutor: string; aoArLivre: boolean }[];
}

export interface PontoAvaliacao {
  data: string; peso_kg: number | null; altura_cm: number | null; cintura_cm: number | null;
  gordura_pct: number | null; imc: number | null;
}

export interface PagamentoLinha extends Row {
  aluno_nome: string; plano_nome: string; situacao: 'pago' | 'pendente' | 'atrasado' | 'cancelado'; dias_atraso: number;
}
