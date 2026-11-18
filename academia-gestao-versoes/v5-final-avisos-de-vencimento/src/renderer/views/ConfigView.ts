// Página: Configurações (nome, localização, regras dos alertas e Telegram) — só administrador.
import { chamar, ApiError } from '../api';
import type { Configuracoes, ResultadoEnvio } from '../../shared/types';
import { botao, h, selo, toast } from '../ui';

// Classe da tela de configurações
export class ConfigView {
  // Carrega as configurações e monta o formulário
  async montar(raiz: HTMLElement): Promise<void> {
    let cfg = await chamar<Configuracoes>('config:obter');
    // Campos de texto e numéricos do formulário
    const campos: [keyof Configuracoes, string, string, Record<string, string>][] = [
      ['academiaNome', 'Nome da academia', 'text', {}],
      ['latitude', 'Latitude do espaço externo', 'number', { step: 'any' }],
      ['longitude', 'Longitude do espaço externo', 'number', { step: 'any' }],
      ['limiarChuva', 'Avisar a partir de (% de chance de chuva)', 'number', { min: '0', max: '100' }],
      ['horasAntecedencia', 'Olhar aulas das próximas (horas)', 'number', { min: '1', max: '72' }],
      ['diasAvisoVencimento', 'Avisar plano que vence em até (dias)', 'number', { min: '1', max: '60' }],
    ];
    const entradas = new Map<string, HTMLInputElement>();
    const erros = new Map<string, HTMLElement>();
    const grade = h('div', { class: 'grade-form' });
    // Cria um campo para cada configuração
    for (const [chave, rotulo, tipo, attrs] of campos) {
      const i = h('input', { type: tipo, autocomplete: 'off', ...attrs });
      entradas.set(chave, i);
      const e = h('small', { class: 'erro-campo' });
      erros.set(chave, e);
      grade.append(h('label', { class: 'campo' }, h('span', {}, rotulo), i, e));
    }
    // Envio automático, token do bot e teste de conexão
    const auto = h('input', { type: 'checkbox' });
    const token = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Cole o token do BotFather' });
    const erroToken = h('small', { class: 'erro-campo' });
    const estado = h('span', {});
    const chatTeste = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: 'Chat id de quem vai receber (o seu, por exemplo)' });
    const testeCampo = h('label', { class: 'campo' }, h('span', {}, 'Testar conexão'),
      h('div', { class: 'linha-campo' }, chatTeste, botao('Enviar mensagem de teste', () => void testar(), 'btn leve')));
    // Preenche a tela com os valores atuais e mostra o estado do Telegram
    const preencher = (): void => {
      campos.forEach(([k]) => { entradas.get(k)!.value = String(cfg[k]); });
      auto.checked = cfg.envioAutomatico;
      token.value = '';
      estado.replaceChildren(selo(cfg.telegramConfigurado ? 'Telegram configurado' : 'Telegram não configurado: avisos só ficam registrados', cfg.telegramConfigurado ? 'ok' : 'aviso'));
      testeCampo.style.display = cfg.telegramConfigurado ? '' : 'none';
    };
    preencher();
    // Botão "Enviar mensagem de teste": pede o teste ao main
    const testar = async (): Promise<void> => {
      const chatId = chatTeste.value.trim();
      if (!chatId) { toast('Informe o chat id de quem vai receber o teste.', 'erro'); return; }
      try {
        const r = await chamar<ResultadoEnvio>('config:testarTelegram', { chatId });
        if (r.status === 'enviado') toast('Mensagem de teste enviada — confira o Telegram.', 'ok');
        else toast(r.detalhe ?? r.status, r.status === 'falha' ? 'erro' : 'aviso');
      } catch (e) { toast(e instanceof Error ? e.message : 'Falha ao testar.', 'erro'); }
    };
    // Botão "Salvar configurações": envia os dados e mostra os erros por campo
    const salvar = async (extra: Record<string, unknown> = {}): Promise<void> => {
      erros.forEach((e) => { e.textContent = ''; }); erroToken.textContent = '';
      const dados: Record<string, unknown> = { envioAutomatico: auto.checked, ...extra };
      entradas.forEach((i, k) => { dados[k] = i.value; });
      if (token.value.trim() && !('telegramToken' in extra)) dados.telegramToken = token.value;
      try { cfg = await chamar<Configuracoes>('config:salvar', dados); preencher(); toast('Configurações salvas.'); }
      catch (e) {
        if (e instanceof ApiError && e.campos) Object.entries(e.campos).forEach(([k, m]) => { (k === 'telegramToken' ? erroToken : erros.get(k))!.textContent = m; });
        toast(e instanceof Error ? e.message : 'Não foi possível salvar.', 'erro');
      }
    };
    // Monta a tela: configurações, Telegram e botões
    raiz.append(h('section', { class: 'painel' }, h('h2', {}, 'Clima e avisos'), grade,
      h('label', { class: 'campo check' }, auto, h('span', {}, 'Enviar avisos de vencimento automaticamente (só com Telegram configurado)')),
      h('h2', { class: 'subtitulo' }, 'Mensagens pelo Telegram'), estado,
      h('label', { class: 'campo' }, h('span', {}, 'Token do bot (guardado cifrado no sistema; deixe vazio para manter)'), token, erroToken),
      testeCampo,
      h('div', { class: 'acoes' },
        cfg.telegramConfigurado ? botao('Remover token', () => void salvar({ telegramToken: '' })) : null,
        botao('Salvar configurações', () => void salvar(), 'btn primario'))));
  }
}
