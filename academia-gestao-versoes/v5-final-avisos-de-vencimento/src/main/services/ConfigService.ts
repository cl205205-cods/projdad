// Serviço de configurações: nome da academia, localização, regras dos alertas e token do Telegram.
import { AppError } from '../AppError';
import type { Database } from '../database/Database';
import type { SecretVault } from '../security/SecretVault';
import type { Configuracoes } from '../../shared/types';

// Valores padrão usados enquanto nada foi salvo no banco
const PADROES: Record<string, string> = {
  academia_nome: 'Minha Academia', latitude: '-23.5505', longitude: '-46.6333',
  limiar_chuva: '50', horas_antecedencia: '48', dias_aviso_vencimento: '7', envio_automatico: '0',
};
// Formato do token devolvido pelo BotFather (o mesmo validado na tela)
// Chat id fixo padrão: vale quando a linha TELEGRAM_CHAT_ID_FIXO não existe no .env
const CHAT_FIXO_PADRAO = '7012239154';
const TOKEN_VALIDO = /^\d{6,12}:[A-Za-z0-9_-]{30,50}$/;

/** Configurações no MySQL (tabela configuracoes), com cópia em memória para leitura síncrona. */
export class ConfigService {
  // Cópia em memória das configurações
  private cache = new Map<string, string>();
  // true quando o usuário removeu o token na tela: ignora o .env até reiniciar (o .env é a configuração inicial)
  private tokenIgnorado = false;
  // Token já decifrado (a decifragem é assíncrona; token() continua síncrono lendo daqui)
  private tokenDecifrado: string | null = null;

  constructor(private readonly db: Database, private readonly cofre: SecretVault) {}

  // Lê a tabela configuracoes do banco e importa o que veio do .env
  async carregar(): Promise<void> {
    const linhas = await this.db.consultar<{ chave: string; valor: string }>('SELECT chave, valor FROM configuracoes');
    this.cache = new Map(linhas.map((l) => [l.chave, l.valor]));
    await this.importarDoAmbiente();
    await this.decifrarToken();
  }

  // Decifra o token salvo no banco e guarda em memória (null se ausente ou ilegível)
  private async decifrarToken(): Promise<void> {
    const cifrado = this.ler('telegram_token_cifrado');
    try { this.tokenDecifrado = cifrado ? await this.cofre.decifrar(cifrado) : null; }
    catch { this.tokenDecifrado = null; /* valor ilegível: token() cai no .env */ }
  }

  /**
   * Copia para as configurações o token definido no .env, quando ainda não há valor salvo.
   * O token entra cifrado pelo cofre do sistema e nunca aparece em log. Não sobrescreve o que o usuário salvou.
   * O chat fixo NÃO é copiado: ele é lido só do ambiente (decisão 0004), para trocar ou remover a linha valer.
   */
  private async importarDoAmbiente(): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (token && !this.ler('telegram_token_cifrado') && this.cofre.disponivel()
      && TOKEN_VALIDO.test(token)) {
      try { await this.gravar('telegram_token_cifrado', this.cofre.cifrar(token)); }
      catch { /* cofre ou banco indisponível: o .env continua valendo como fallback */ }
    }
  }

  // Lê uma configuração do cache
  private ler(chave: string): string | undefined { return this.cache.get(chave); }

  // Salva (ou atualiza) uma configuração no banco e no cache
  private async gravar(chave: string, valor: string): Promise<void> {
    await this.db.executar('INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [chave, valor]);
    this.cache.set(chave, valor);
  }

  // Devolve todas as configurações já convertidas (números e booleanos)
  obter(): Configuracoes {
    const v = (k: string): string => this.ler(k) ?? PADROES[k];
    return {
      academiaNome: v('academia_nome'), latitude: Number(v('latitude')), longitude: Number(v('longitude')),
      limiarChuva: Number(v('limiar_chuva')), horasAntecedencia: Number(v('horas_antecedencia')),
      diasAvisoVencimento: Number(v('dias_aviso_vencimento')), envioAutomatico: v('envio_automatico') === '1',
      telegramConfigurado: this.token() !== null,
    };
  }

  /** Token do bot: valor cifrado no banco ou, se ainda não houver, o TELEGRAM_BOT_TOKEN do .env. Nunca volta ao renderer. */
  token(): string | null {
    if (this.tokenIgnorado) return null;
    if (this.tokenDecifrado) return this.tokenDecifrado;
    const env = process.env.TELEGRAM_BOT_TOKEN?.trim();
    return env && TOKEN_VALIDO.test(env) ? env : null;
  }

  /**
   * Chat id único que recebe todos os avisos: lido só do TELEGRAM_CHAT_ID_FIXO do .env.
   * Não vai para o banco (decisão 0004): trocar ou apagar a linha no .env vale na próxima abertura,
   * e sem a linha cada aluno recebe no próprio chat. null = cada aluno no seu.
   */
  chatFixo(): string | null {
    // Linha ausente = padrão; linha com outro id = troca; linha vazia (TELEGRAM_CHAT_ID_FIXO=) = cada aluno no seu chat
    const id = (process.env.TELEGRAM_CHAT_ID_FIXO ?? CHAT_FIXO_PADRAO).trim();
    return /^-?\d{1,20}$/.test(id) ? id : null;
  }

  // Valida e salva as configurações vindas da tela (o token do bot vai cifrado)
  async salvar(e: Record<string, unknown>): Promise<void> {
    const erros: Record<string, string> = {};
    const gravar: [string, string][] = [];
    let removerToken = false;
    let tokenNovo = false;
    let tokenPlano = '';
    // Valida campos numéricos com limites
    const numero = (campo: string, min: number, max: number, chave: string): void => {
      if (e[campo] === undefined) return;
      const n = Number(e[campo]);
      if (!Number.isFinite(n) || n < min || n > max) erros[campo] = `Informe um valor entre ${min} e ${max}.`;
      else gravar.push([chave, String(n)]);
    };
    // Valida o nome da academia
    const nome = e.academiaNome === undefined ? undefined : String(e.academiaNome).trim();
    if (nome !== undefined) {
      if (!nome || nome.length > 80) erros.academiaNome = 'Informe um nome de até 80 caracteres.';
      else gravar.push(['academia_nome', nome]);
    }
    // Localização do espaço externo e regras dos alertas
    numero('latitude', -90, 90, 'latitude');
    numero('longitude', -180, 180, 'longitude');
    numero('limiarChuva', 0, 100, 'limiar_chuva');
    numero('horasAntecedencia', 1, 72, 'horas_antecedencia');
    numero('diasAvisoVencimento', 1, 60, 'dias_aviso_vencimento');
    // Liga/desliga o envio automático de avisos
    if (e.envioAutomatico !== undefined) gravar.push(['envio_automatico', e.envioAutomatico ? '1' : '0']);
    // Token do bot: vazio remove; senão valida o formato e guarda cifrado
    if (typeof e.telegramToken === 'string') {
      const token = e.telegramToken.trim();
      if (token === '') removerToken = true;
      else if (!TOKEN_VALIDO.test(token)) erros.telegramToken = 'Token fora do formato do BotFather.';
      else if (!this.cofre.disponivel()) erros.telegramToken = 'Cofre do sistema indisponível; defina TELEGRAM_BOT_TOKEN no ambiente.';
      else { gravar.push(['telegram_token_cifrado', this.cofre.cifrar(token)]); tokenNovo = true; tokenPlano = token; }
    }
    // Se houve erro, não grava nada
    if (Object.keys(erros).length) throw new AppError('Corrija os campos destacados.', erros);
    for (const [chave, valor] of gravar) await this.gravar(chave, valor);
    // Remove o token do banco quando o campo foi esvaziado
    if (removerToken) {
      await this.db.executar("DELETE FROM configuracoes WHERE chave = 'telegram_token_cifrado'");
      this.cache.delete('telegram_token_cifrado');
      // Enquanto o app estiver aberto, o .env não recoloca o token que o usuário acabou de remover
      this.tokenIgnorado = true;
      this.tokenDecifrado = null;
    }
    if (tokenNovo) { this.tokenIgnorado = false; this.tokenDecifrado = tokenPlano; }
  }
}
