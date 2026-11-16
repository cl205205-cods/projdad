import { AppError } from '../AppError';
import type { Database } from '../database/Database';
import type { Configuracoes } from '../../shared/types';

const PADROES: Record<string, string> = {
  academia_nome: 'Minha Academia', latitude: '-23.5505', longitude: '-46.6333',
  limiar_chuva: '50', horas_antecedencia: '48', dias_aviso_vencimento: '7', envio_automatico: '0',
};

/** Configurações no MySQL (tabela configuracoes), com cópia em memória para leitura síncrona. */
export class ConfigService {
  private cache = new Map<string, string>();

  constructor(private readonly db: Database) {}

  async carregar(): Promise<void> {
    const linhas = await this.db.consultar<{ chave: string; valor: string }>('SELECT chave, valor FROM configuracoes');
    this.cache = new Map(linhas.map((l) => [l.chave, l.valor]));
  }

  private ler(chave: string): string | undefined { return this.cache.get(chave); }

  private async gravar(chave: string, valor: string): Promise<void> {
    await this.db.executar('INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [chave, valor]);
    this.cache.set(chave, valor);
  }

  obter(): Configuracoes {
    const v = (k: string): string => this.ler(k) ?? PADROES[k];
    return {
      academiaNome: v('academia_nome'), latitude: Number(v('latitude')), longitude: Number(v('longitude')),
      limiarChuva: Number(v('limiar_chuva')), horasAntecedencia: Number(v('horas_antecedencia')),
      diasAvisoVencimento: Number(v('dias_aviso_vencimento')),
    };
  }


  async salvar(e: Record<string, unknown>): Promise<void> {
    const erros: Record<string, string> = {};
    const gravar: [string, string][] = [];
    const numero = (campo: string, min: number, max: number, chave: string): void => {
      if (e[campo] === undefined) return;
      const n = Number(e[campo]);
      if (!Number.isFinite(n) || n < min || n > max) erros[campo] = `Informe um valor entre ${min} e ${max}.`;
      else gravar.push([chave, String(n)]);
    };
    const nome = e.academiaNome === undefined ? undefined : String(e.academiaNome).trim();
    if (nome !== undefined) {
      if (!nome || nome.length > 80) erros.academiaNome = 'Informe um nome de até 80 caracteres.';
      else gravar.push(['academia_nome', nome]);
    }
    numero('latitude', -90, 90, 'latitude');
    numero('longitude', -180, 180, 'longitude');
    numero('limiarChuva', 0, 100, 'limiar_chuva');
    numero('horasAntecedencia', 1, 72, 'horas_antecedencia');
    numero('diasAvisoVencimento', 1, 60, 'dias_aviso_vencimento');
    if (Object.keys(erros).length) throw new AppError('Corrija os campos destacados.', erros);
    for (const [chave, valor] of gravar) await this.gravar(chave, valor);
  }
}
