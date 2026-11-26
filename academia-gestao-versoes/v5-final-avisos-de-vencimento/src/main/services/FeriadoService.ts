// Serviço de feriados (API BrasilAPI): usado para mover vencimentos e avisar aulas em feriado.
import type { HttpClient } from './HttpClient';
import { addDays, ehFimDeSemana } from '../../shared/dates';

// Formato da resposta da BrasilAPI
interface FeriadoApi { date: string; name: string }

/** API 2 — BrasilAPI (feriados nacionais). Usada para mover vencimentos e avisar aulas em feriado. */
export class FeriadoService {
  // Cache dos feriados por ano
  private readonly cache = new Map<number, Map<string, string>>();
  constructor(private readonly http: HttpClient) {}

  // Busca os feriados de um ano na BrasilAPI, com cache; offline devolve vazio
  private async doAno(ano: number): Promise<Map<string, string>> {
    const guardado = this.cache.get(ano);
    if (guardado) return guardado;
    try {
      // Chamada à API BrasilAPI
      const lista = await this.http.getJson<FeriadoApi[]>(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
      const mapa = new Map(lista.map((f) => [f.date, f.name]));
      this.cache.set(ano, mapa);
      return mapa;
    } catch {
      return new Map(); // offline: segue só com a regra de fim de semana (não guarda a falha no cache)
    }
  }

  // Nome do feriado em uma data (ou null se não for feriado)
  async nomeDoFeriado(iso: string): Promise<string | null> {
    return (await this.doAno(Number(iso.slice(0, 4)))).get(iso) ?? null;
  }

  // Avança até achar um dia que não seja fim de semana nem feriado
  async proximoDiaUtil(iso: string): Promise<string> {
    let d = iso;
    for (let i = 0; i < 10; i++) {
      if (!ehFimDeSemana(d) && !(await this.nomeDoFeriado(d))) return d;
      d = addDays(d, 1);
    }
    return d;
  }
}
