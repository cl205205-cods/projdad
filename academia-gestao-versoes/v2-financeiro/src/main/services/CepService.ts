import { AppError } from '../AppError';
import type { HttpClient } from './HttpClient';

interface ViaCep { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
export interface Endereco { logradouro: string; bairro: string; cidade: string; uf: string }

/** API 3 — ViaCEP. Preenche o endereço no cadastro de alunos a partir do CEP. */
export class CepService {
  constructor(private readonly http: HttpClient) {}

  async buscar(cep: string): Promise<Endereco> {
    const d = cep.replace(/\D/g, '');
    if (d.length !== 8) throw new AppError('CEP deve ter 8 dígitos.');
    const r = await this.http.getJson<ViaCep>(`https://viacep.com.br/ws/${d}/json/`);
    if (r.erro) throw new AppError('CEP não encontrado.');
    return { logradouro: r.logradouro ?? '', bairro: r.bairro ?? '', cidade: r.localidade ?? '', uf: r.uf ?? '' };
  }
}
