import type { Perfil } from './entities';

export interface SessionUser { id: number; nome: string; email: string; perfil: Perfil }

export type Resultado<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string> };

export type Row = Record<string, string | number | null>;








