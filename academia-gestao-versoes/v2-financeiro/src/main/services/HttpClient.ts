import { AppError } from '../AppError';

/** Cliente HTTP único do sistema: timeout, JSON e mensagens que nunca vazam a URL completa (pode conter token). */
export class HttpClient {
  constructor(private readonly timeoutMs = 8000, private readonly fetchImpl: typeof fetch = fetch) {}

  getJson<T>(url: string): Promise<T> {
    return this.requisitar<T>(url, { method: 'GET', headers: { Accept: 'application/json' } }, false);
  }

  /** Aceita corpo JSON mesmo em HTTP 4xx (ex.: Telegram devolve {ok:false, description}). */
  postJson<T>(url: string, corpo: unknown): Promise<T> {
    return this.requisitar<T>(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(corpo),
    }, true);
  }

  private async requisitar<T>(url: string, init: RequestInit, tolerante: boolean): Promise<T> {
    const host = new URL(url).hostname;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, { ...init, signal: ctrl.signal });
      if (!res.ok && !tolerante) throw new AppError(`O serviço ${host} respondeu com erro (HTTP ${res.status}).`);
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(`Não foi possível acessar ${host}. Verifique a conexão com a internet.`);
    } finally {
      clearTimeout(timer);
    }
  }
}
