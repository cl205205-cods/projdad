// Erro com a mensagem segura e os campos inválidos devolvidos pelo backend
// Chamada às operações do main a partir da interface.
export class ApiError extends Error {
  constructor(mensagem: string, public readonly campos?: Record<string, string>) { super(mensagem); }
}

/** Chama uma operação do processo main. Lança ApiError com a mensagem segura devolvida pelo backend. */
export async function chamar<T = unknown>(canal: string, payload?: unknown): Promise<T> {
  const r = await window.api.invoke<T>(canal, payload);
  if (!r.ok) throw new ApiError(r.error, r.fields);
  return r.data;
}
