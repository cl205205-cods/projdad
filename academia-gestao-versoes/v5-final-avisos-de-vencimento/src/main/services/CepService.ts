// Serviço de CEP (API ViaCEP): consulta o endereço a partir do CEP.
import { AppError } from '../AppError';
import type { HttpClient } from './HttpClient';

// Resposta bruta da API ViaCEP
interface ViaCep { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
// Endereço devolvido para o formulário
export interface Endereco { logradouro: string; bairro: string; cidade: string; uf: string }

/** API 3 — ViaCEP. Preenche o endereço no cadastro de alunos a partir do CEP. */
export class CepService {
  constructor(private readonly http: HttpClient) {}

  // Valida o CEP (8 dígitos), consulta a API e devolve o endereço
  async buscar(cep: string): Promise<Endereco> {
    // Mantém só os números
    const d = cep.replace(/\D/g, '');
    if (d.length !== 8) throw new AppError('CEP deve ter 8 dígitos.');
    // Chamada à API ViaCEP
    const r = await this.http.getJson<ViaCep>(`https://viacep.com.br/ws/${d}/json/`);
    // A API sinaliza erro quando o CEP não existe
    if (r.erro) throw new AppError('CEP não encontrado.');
    return { logradouro: r.logradouro ?? '', bairro: r.bairro ?? '', cidade: r.localidade ?? '', uf: r.uf ?? '' };
  }
}
