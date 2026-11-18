// Utilitários de data (sempre ISO "YYYY-MM-DD", em horário local).
// Completa com zero à esquerda (5 vira 05)
export const pad = (n: number): string => String(n).padStart(2, '0');
// Date -> "AAAA-MM-DD"
export const toISODate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// "AAAA-MM-DD" -> Date (horário local)
export const parseISODate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
// Data de hoje
export const hojeISO = (): string => toISODate(new Date());
// "AAAA-MM-DD" -> "DD/MM/AAAA"
export const formatBR = (iso: string): string => iso.split('-').reverse().join('/');

// Soma dias a uma data
export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Soma meses preservando o dia (31/01 + 1 mês = 28/02 ou 29/02). */
export function addMonths(iso: string, n: number): string {
  const d = parseISODate(iso);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return toISODate(d);
}

// Diferença em dias entre duas datas
export const diffDays = (de: string, ate: string): number =>
  Math.round((parseISODate(ate).getTime() - parseISODate(de).getTime()) / 86_400_000);

// É sábado ou domingo?
export const ehFimDeSemana = (iso: string): boolean => [0, 6].includes(parseISODate(iso).getDay());
