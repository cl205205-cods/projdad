// Processo principal (main) do Electron: inicia o app, conecta ao banco, monta os serviços e abre a janela.
import { app, BrowserWindow, Menu, Notification, dialog, ipcMain, session, shell, type IpcMainInvokeEvent } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { conexao, variaveisFaltando } from './conexao';
import { Database } from './database/Database';
import { ElectronSecretVault } from './security/ElectronSecretVault';
import { HttpClient } from './services/HttpClient';
import { ConfigService } from './services/ConfigService';
import { AuthService } from './services/AuthService';
import { FeriadoService } from './services/FeriadoService';
import { ClimaService } from './services/ClimaService';
import { CepService } from './services/CepService';
import { MensagemService } from './services/MensagemService';
import { PagamentoService } from './services/PagamentoService';
import { CrudService } from './services/CrudService';
import { AvaliacaoService } from './services/AvaliacaoService';
import { DashboardService } from './services/DashboardService';
import { AlertaService, Agendador } from './services/AlertaService';
import { IpcRouter } from './ipc/IpcRouter';

// Classe que orquestra a inicialização de toda a aplicação
class Aplicacao {
  // Janela principal (null quando fechada)
  private janela: BrowserWindow | null = null;
  // Rotina periódica de alertas (chuva e vencimentos)
  private agendador: Agendador | null = null;
  // Caminho da página HTML da interface (renderer)
  private readonly indexHtml = join(__dirname, '../renderer/index.html');

  // Sequência de inicialização do app
  async iniciar(): Promise<void> {
    // Permite uma única instância aberta (evita avisos duplicados)
    if (!app.requestSingleInstanceLock()) { app.quit(); return; } // uma só instância: evita rotinas de alerta e avisos duplicados
    // Se o app for aberto de novo, só traz a janela existente para a frente
    app.on('second-instance', () => { this.janela?.isMinimized() && this.janela.restore(); this.janela?.focus(); });
    // Espera o Electron ficar pronto
    await app.whenReady();

    // Segurança: nega qualquer permissão extra (câmera, microfone etc.)
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false)); // nenhuma permissão extra
    // App empacotado: remove o menu padrão
    if (app.isPackaged) Menu.setApplicationMenu(null);

    // Primeiro uso real da conexão, antes de qualquer janela existir (sem IPC): falhou -> dialog nativo.
    if (!(await this.testarConexaoBanco())) { app.quit(); return; }
    // Banco de dados: conecta e cria as tabelas que faltarem (migração)
    const db = new Database();
    await db.migrar(); // cria as tabelas que faltarem (CREATE TABLE IF NOT EXISTS)
    // Criação dos serviços (cada um cuida de uma funcionalidade)
    const http = new HttpClient();
    const config = new ConfigService(db, new ElectronSecretVault());
    await config.carregar();
    const feriados = new FeriadoService(http);
    const pagamentos = new PagamentoService(db, feriados);
    const mensagens = new MensagemService(http, config);
    const alertas = new AlertaService(db, config, new ClimaService(http), feriados, mensagens);
    // Roteador IPC: liga as telas (renderer) aos serviços, com controle de permissão
    const router = new IpcRouter({
      auth: new AuthService(db), crud: new CrudService(db, pagamentos), pagamentos, avaliacoes: new AvaliacaoService(db),
      cep: new CepService(http), dashboard: new DashboardService(db, config), alertas, config, mensagens,
    }, (url) => this.abrirExterno(url));

    // Registra cada operação como canal IPC, aceitando só chamadas da nossa página
    for (const canal of router.canais()) {
      ipcMain.handle(canal, (ev, payload) =>
        this.origemConfiavel(ev) ? router.despachar(canal, payload) : { ok: false, error: 'Origem não confiável.' });
    }

    // Novo alerta de chuva: avisa a tela e mostra notificação do sistema
    alertas.aoNovoAlerta((a) => {
      this.janela?.webContents.send('alerta:novo', a);
      if (Notification.isSupported()) {
        new Notification({ title: 'Previsão de chuva', body: `${a.modalidade} às ${a.hora}: ${a.probabilidade}% de chance. Considere remarcar.` }).show();
      }
    });

    // Abre a janela e inicia a rotina automática de alertas (ao abrir e a cada 30 min)
    this.criarJanela();
    this.agendador = new Agendador(alertas);
    this.agendador.iniciar();
    // macOS: recria a janela ao clicar no ícone se não houver nenhuma
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) this.criarJanela(); });
    // Ao fechar todas as janelas: para a rotina, fecha o banco e encerra o app
    app.on('window-all-closed', () => { this.agendador?.parar(); void db.fechar().finally(() => app.quit()); });
  }

  // Testa a conexão com o MySQL antes de abrir a janela (mostra erro nativo se falhar)
  private testarConexaoBanco(): Promise<boolean> {
    return new Promise((resolve) => {
      // Confere se o .env tem as variáveis do banco
      const faltando = variaveisFaltando();
      if (faltando.length > 0) {
        dialog.showErrorBox('Configuração do banco incompleta',
          `Defina no arquivo .env (copie o .env.example): ${faltando.join(', ')}`);
        resolve(false);
        return;
      }
      // Tenta conectar ao MySQL
      conexao.connect((erro) => {
        if (erro) {
          console.error('Erro ao conectar ao MySQL:', erro.message);
          dialog.showErrorBox('Erro de conexão com o banco', `Não foi possível conectar ao MySQL.\n\nDetalhes: ${erro.message}`);
          resolve(false);
          return;
        }
        console.log('Conectado ao MySQL com sucesso!');
        resolve(true);
      });
    });
  }

  /** Só aceita chamadas vindas da nossa própria página (não de iframes ou URLs externas). */
  private origemConfiavel(ev: IpcMainInvokeEvent): boolean {
    return ev.senderFrame?.url.startsWith(pathToFileURL(this.indexHtml).href) ?? false;
  }

  // Segurança: só abre no navegador links do WhatsApp (wa.me)
  private abrirExterno(url: string): void {
    const u = new URL(url);
    if (u.protocol === 'https:' && u.hostname === 'wa.me') void shell.openExternal(u.href); // lista fechada de destinos
  }

  // Cria a janela principal com as proteções do Electron ativas
  private criarJanela(): void {
    const j = new BrowserWindow({
      width: 1320, height: 840, minWidth: 1000, minHeight: 640, show: false, title: 'Gestão de Academia',
      backgroundColor: '#E6E9EE',
      // Segurança: contexto isolado, sem Node no renderer e sandbox ativo
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      },
    });
    // Bloqueia novas janelas e navegação para fora da interface
    j.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    j.webContents.on('will-navigate', (e) => e.preventDefault());
    j.once('ready-to-show', () => j.show());
    j.on('closed', () => { this.janela = null; });
    // Carrega a interface
    void j.loadFile(this.indexHtml);
    this.janela = j;
  }
}

// Ponto de entrada: inicia a aplicação
void new Aplicacao().iniciar();
