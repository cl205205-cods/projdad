// Serviço de clima (API Open-Meteo): previsão de chuva por hora para as aulas ao ar livre.
import type { HttpClient } from './HttpClient';
import { pad } from '../../shared/dates';

// Formato da resposta da Open-Meteo
interface PrevisaoApi { hourly: { time: string[]; precipitation_probability: (number | null)[]; precipitation: (number | null)[] } }
// Resultado usado pelo sistema: maior chance de chuva e total em mm
export interface Previsao { probabilidade: number; mm: number }

/** API 1 — Open-Meteo (previsão por hora). Decide se uma aula ao ar livre corre risco de chuva. */
export class ClimaService {
  // Cache (30 min) para não repetir chamadas à API
  private readonly cache = new Map<string, { em: number; dados: PrevisaoApi['hourly'] }>();
  constructor(private readonly http: HttpClient, private readonly ttlMs = 30 * 60_000) {}

  // Busca a previsão hora a hora (4 dias) na Open-Meteo, usando o cache
  private async horaria(lat: number, lon: number): Promise<PrevisaoApi['hourly']> {
    const chave = `${lat},${lon}`;
    const c = this.cache.get(chave);
    // Usa o cache se ainda estiver válido
    if (c && Date.now() - c.em < this.ttlMs) return c.dados;
    // Parâmetros da consulta: local, dados por hora e fuso automático
    const qs = new URLSearchParams({
      latitude: String(lat), longitude: String(lon), hourly: 'precipitation_probability,precipitation',
      timezone: 'auto', forecast_days: '4',
    });
    // Chamada à API Open-Meteo
    const r = await this.http.getJson<PrevisaoApi>(`https://api.open-meteo.com/v1/forecast?${qs}`);
    this.cache.set(chave, { em: Date.now(), dados: r.hourly });
    return r.hourly;
  }

  /** Maior probabilidade e total de chuva (mm) nas horas cobertas pela aula; null se fora da janela da previsão. */
  async previsao(lat: number, lon: number, data: string, hora: string, duracaoMin: number): Promise<Previsao | null> {
    // Previsão por hora da região
    const h = await this.horaria(lat, lon);
    // Horário da aula em minutos e horas cobertas por ela
    const inicio = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
    const primeira = Math.floor(inicio / 60);
    const ultima = Math.min(23, Math.ceil((inicio + duracaoMin) / 60) - 1);
    let prob = -1; let mm = 0;
    // Para cada hora da aula: maior probabilidade e soma da chuva
    for (let hh = primeira; hh <= Math.max(primeira, ultima); hh++) {
      const i = h.time.indexOf(`${data}T${pad(hh)}:00`);
      if (i < 0) continue;
      prob = Math.max(prob, h.precipitation_probability[i] ?? 0);
      mm += h.precipitation[i] ?? 0;
    }
    // Sem dados dentro da janela da previsão: devolve null
    return prob < 0 ? null : { probabilidade: prob, mm: Math.round(mm * 10) / 10 };
  }
}
