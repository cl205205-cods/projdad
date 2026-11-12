import type { Perfil } from './entities';

export interface SessionUser { id: number; nome: string; email: string; perfil: Perfil }

export type Resultado<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string> };

export type Row = Record<string, string | number | null>;






export interface ResumoDashboard {
  alunosAtivos: number; matriculasAtivas: number;
  financeiro: { atrasados: number; valorAtrasado: number; recebidoNoMes: number } | null;
}


export interface PagamentoLinha extends Row {
  aluno_nome: string; plano_nome: string; situacao: 'pago' | 'pendente' | 'atrasado' | 'cancelado'; dias_atraso: number;
}
