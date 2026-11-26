// Serviço de mensagens (API Telegram Bot): envio dos avisos e teste de conexão.
import { AppError } from '../AppError';
import type { HttpClient } from './HttpClient';
import type { ConfigService } from './ConfigService';
import type { ResultadoEnvio } from '../../shared/types';

// Contrato de um canal de envio (Telegram, simulado...)
export interface CanalMensagem { enviar(destino: string, texto: string): Promise<ResultadoEnvio> }

/** API 4 — Telegram Bot API (sendMessage). O aluno precisa ter iniciado conversa com o bot da academia. */
export class TelegramCanal implements CanalMensagem {
  constructor(private readonly http: HttpClient, private readonly token: string) {}
  async enviar(destino: string, texto: string): Promise<ResultadoEnvio> {
    // Valida o chat id (só números)
    if (!/^-?\d{1,20}$/.test(destino)) return { status: 'falha', detalhe: 'Chat id do Telegram inválido.' };
    try {
      // Chamada à API do Telegram (sendMessage)
      const r = await this.http.postJson<{ ok: boolean; description?: string }>(
        `https://api.telegram.org/bot${this.token}/sendMessage`, { chat_id: destino, text: texto });
      // Telegram aceitou? Senão devolve o motivo da recusa
      return r.ok ? { status: 'enviado' } : { status: 'falha', detalhe: r.description ?? 'Telegram recusou a mensagem.' };
    } catch (e) {
      return { status: 'falha', detalhe: e instanceof Error ? e.message : 'Falha de rede.' };
    }
  }
}

/** Redireciona qualquer envio para um único chat (TELEGRAM_CHAT_ID_FIXO), ignorando o chat id do aluno. */
export class DestinoFixoCanal implements CanalMensagem {
  constructor(private readonly interno: CanalMensagem, private readonly chatId: string) {}
  enviar(_destino: string, texto: string): Promise<ResultadoEnvio> { return this.interno.enviar(this.chatId, texto); }
}

/** Usado enquanto o bot não está configurado: só registra o aviso, sem enviar nada. */
export class SimuladoCanal implements CanalMensagem {
  async enviar(): Promise<ResultadoEnvio> {
    return { status: 'simulado', detalhe: 'Telegram não configurado: aviso apenas registrado.' };
  }
}

// Escolhe o canal de envio e oferece o teste de conexão
export class MensagemService {
  constructor(private readonly http: HttpClient, private readonly config: ConfigService) {}

  /** Chat id único que recebe TODOS os avisos (vencimento e chuva). null = cada aluno recebe no seu. */
  destinoFixo(): string | null {
    return this.config.chatFixo();
  }

  // Telegram quando há token; senão o modo simulado
  canal(): { nome: string; impl: CanalMensagem } {
    const token = this.config.token();
    if (!token) return { nome: 'simulado', impl: new SimuladoCanal() };
    const telegram = new TelegramCanal(this.http, token);
    const fixo = this.destinoFixo();
    return { nome: 'telegram', impl: fixo ? new DestinoFixoCanal(telegram, fixo) : telegram };
  }

  /** Usado pelo botão "Testar conexão" em Configurações: confirma, na hora, que o token funciona de verdade. */
  async testar(chatId: string): Promise<ResultadoEnvio> {
    const token = this.config.token();
    if (!token) throw new AppError('Salve o token do bot antes de testar.');
    const texto = 'Mensagem de teste do sistema de gestão da academia: se você recebeu isto, a conexão com o Telegram está funcionando.';
    // Campo vazio usa o chat fixo (padrão do .env); um id digitado vai direto nele, sem o destino fixo esconder um id errado
    const destino = chatId.trim() || this.destinoFixo();
    if (!destino) throw new AppError('Informe o chat id de quem vai receber o teste.');
    return new TelegramCanal(this.http, token).enviar(destino, texto);
  }

  /** Alternativa sem API: link wa.me para a recepção abrir a conversa já preenchida. */
  static linkWhatsApp(telefone: string, texto: string): string {
    const d = telefone.replace(/\D/g, '');
    const numero = d.length <= 11 ? `55${d}` : d;
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  }
}
