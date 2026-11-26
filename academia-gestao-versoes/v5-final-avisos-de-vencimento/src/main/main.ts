// Processo principal (main) do Electron: inicia o app, conecta ao banco, monta os serviços e abre a janela.
import {
  app, BrowserWindow, Menu, Notification, Tray, dialog, ipcMain, nativeImage, session, shell,
  type IpcMainInvokeEvent, type MenuItemConstructorOptions, type MessageBoxOptions,
} from 'electron';
import { writeFile } from 'node:fs/promises';
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
import { RelatorioService } from './services/RelatorioService';
import { AlertaService, Agendador } from './services/AlertaService';
import { IpcRouter } from './ipc/IpcRouter';

// Classe que orquestra a inicialização de toda a aplicação
class Aplicacao {
  // Janela principal (null quando fechada)
  private janela: BrowserWindow | null = null;
  // Ícone da bandeja do sistema (criado uma única vez)
  private bandeja: Tray | null = null;
  // Rotina periódica de alertas (chuva e vencimentos)
  private agendador: Agendador | null = null;
  // Conexão com o banco usada no encerramento limpo
  private banco: Database | null = null;
  private bancoFechado = false;
  // true quando o usuário escolheu Sair (aí o X fecha de verdade)
  private encerrando = false;
  // Aviso "continua na bandeja" aparece só uma vez por execução
  private avisoBandejaMostrado = false;
  // Caminho da página HTML da interface (renderer)
  private readonly indexHtml = join(__dirname, '../renderer/index.html');
  // Ícones do aplicativo (janela, barra de tarefas e bandeja)
  private readonly icone = join(app.getAppPath(), 'assets', 'icon.png');
  private readonly iconeBandeja = join(app.getAppPath(), 'assets', 'icon-32.png');

  // Sequência de inicialização do app
  async iniciar(): Promise<void> {
    // Nome exibido no Windows (barra de tarefas, notificações e menu Ajuda)
    app.setName('Gestão de Academia');
    // Agrupa a janela e o ícone na barra de tarefas do Windows
    if (process.platform === 'win32') app.setAppUserModelId('com.dad.gestao-academia');
    // Permite uma única instância aberta (evita avisos duplicados)
    if (!app.requestSingleInstanceLock()) { app.quit(); return; } // uma só instância: evita rotinas de alerta e avisos duplicados
    // Se o app for aberto de novo, só traz a janela existente para a frente
    app.on('second-instance', () => this.mostrarJanela());
    // Espera o Electron ficar pronto
    await app.whenReady();

    // Segurança: nega qualquer permissão extra (câmera, microfone etc.)
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false)); // nenhuma permissão extra
    // Menu nativo do sistema (Arquivo, Exibir, Ferramentas e Ajuda)
    this.montarMenu();

    // Primeiro uso real da conexão, antes de qualquer janela existir (sem IPC): falhou -> dialog nativo.
    if (!(await this.testarConexaoBanco())) { app.quit(); return; }
    // Banco de dados: conecta e cria as tabelas que faltarem (migração)
    const db = new Database();
    this.banco = db;
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
      relatorios: new RelatorioService(db, config),
    }, (url) => this.abrirExterno(url), (nome, conteudo) => this.salvarArquivo(nome, conteudo));

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

    // Abre a janela e a bandeja, e inicia a rotina automática de alertas (ao abrir e a cada 30 min)
    this.criarJanela();
    this.criarBandeja();
    this.agendador = new Agendador(alertas);
    this.agendador.iniciar();
    // macOS: recria a janela ao clicar no ícone se não houver nenhuma
    app.on('activate', () => this.mostrarJanela());
    // Com a bandeja, fechar a janela não encerra o app; isso é feito pelo menu "Sair"
    app.on('window-all-closed', () => { /* a janela fica na bandeja; o app só sai por Sair */ });
    // Encerramento limpo: para a rotina, remove a bandeja, fecha o banco e só então sai
    app.on('before-quit', (e) => {
      this.encerrando = true;
      if (this.bancoFechado) return;
      const banco = this.banco;
      if (!banco) return;
      e.preventDefault();
      this.bancoFechado = true;
      this.agendador?.parar();
      this.agendador = null;
      this.bandeja?.destroy();
      this.bandeja = null;
      // Garantia: se o banco demorar a fechar, o processo termina mesmo assim
      const limite = setTimeout(() => app.exit(0), 4000);
      limite.unref();
      void banco.fechar().finally(() => { clearTimeout(limite); app.quit(); });
    });
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

  // Salva o CSV do relatório no local escolhido pelo usuário (diálogo nativo do sistema)
  private async salvarArquivo(nome: string, conteudo: string): Promise<boolean> {
    const opcoes = {
      title: 'Salvar relatório',
      defaultPath: join(app.getPath('documents'), nome),
      filters: [{ name: 'Planilha CSV', extensions: ['csv'] }],
    };
    const r = this.janela && !this.janela.isDestroyed()
      ? await dialog.showSaveDialog(this.janela, opcoes)
      : await dialog.showSaveDialog(opcoes);
    if (r.canceled || !r.filePath) return false;
    // BOM no início: o Excel abre os acentos corretamente
    await writeFile(r.filePath, `\uFEFF${conteudo}`, 'utf8');
    return true;
  }

  // Mostra a mensagem nativa presa à janela (ou solta, se não houver janela)
  private caixa(opcoes: MessageBoxOptions): Promise<{ response: number }> {
    return this.janela && !this.janela.isDestroyed()
      ? dialog.showMessageBox(this.janela, opcoes)
      : dialog.showMessageBox(opcoes);
  }

  // Menu nativo: mesmas funcionalidades da interface, com atalhos de teclado
  private montarMenu(): void {
    const modelo: MenuItemConstructorOptions[] = [
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
      {
        label: 'Arquivo',
        submenu: [
          { label: 'Abrir janela principal', accelerator: 'CmdOrCtrl+Shift+A', click: () => this.mostrarJanela() },
          { label: 'Configurações', accelerator: 'CmdOrCtrl+,', click: () => this.enviarComando('navegar:config') },
          { type: 'separator' },
          { label: 'Sair', accelerator: 'CmdOrCtrl+Q', click: () => { this.encerrando = true; app.quit(); } },
        ],
      },
      {
        label: 'Exibir',
        submenu: [
          { label: 'Atualizar conteúdo', accelerator: 'F5', click: () => this.enviarComando('atualizar') },
          { label: 'Recarregar interface', accelerator: 'CmdOrCtrl+R', click: () => this.janela?.webContents.reload() },
          { type: 'separator' },
          {
            label: 'Tela cheia', accelerator: 'F11',
            click: () => { const j = this.janela; if (j && !j.isDestroyed()) j.setFullScreen(!j.isFullScreen()); },
          },
        ],
      },
      {
        label: 'Ferramentas',
        submenu: [
          { label: 'Painel', click: () => this.enviarComando('navegar:painel') },
          { label: 'Relatórios', click: () => this.enviarComando('navegar:relatorios') },
          { type: 'separator' },
          { label: 'Alunos', click: () => this.enviarComando('navegar:alunos') },
          { label: 'Matrículas', click: () => this.enviarComando('navegar:matriculas') },
          { label: 'Pagamentos', click: () => this.enviarComando('navegar:pagamentos') },
          { label: 'Avaliações físicas', click: () => this.enviarComando('navegar:avaliacoes') },
          { label: 'Clima e avisos', click: () => this.enviarComando('navegar:alertas') },
        ],
      },
      {
        label: 'Ajuda',
        submenu: [
          { label: 'Sobre o aplicativo', click: () => void this.sobre() },
          { label: 'Atalhos de teclado', click: () => void this.atalhos() },
          { label: `Versão ${app.getVersion()}`, enabled: false },
          { type: 'separator' },
          { label: 'Suporte (abrir README)', click: () => void this.abrirReadme() },
        ],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(modelo));
  }

  // Envia um comando para a interface; se a janela ainda não existe, cria e espera carregar
  private enviarComando(comando: string): void {
    const j = this.janela;
    if (j && !j.isDestroyed()) { j.webContents.send('app:comando', comando); return; }
    this.criarJanela();
    const nova = this.janela as BrowserWindow | null;
    if (nova) {
      nova.webContents.once('did-finish-load', () => {
        if (!nova.isDestroyed()) nova.webContents.send('app:comando', comando);
      });
    }
  }

  // Abre (ou restaura) a janela principal, criando de novo se necessário
  private mostrarJanela(): void {
    const j = this.janela;
    if (!j || j.isDestroyed()) { this.criarJanela(); return; }
    if (j.isMinimized()) j.restore();
    j.show();
    j.focus();
  }

  // Cria a bandeja do sistema uma única vez
  private criarBandeja(): void {
    if (this.bandeja) return;
    let imagem = nativeImage.createFromPath(this.iconeBandeja);
    if (imagem.isEmpty()) imagem = nativeImage.createFromPath(this.icone);
    this.bandeja = new Tray(imagem);
    this.bandeja.setToolTip('Gestão de Academia');
    this.bandeja.setContextMenu(Menu.buildFromTemplate([
      { label: 'Abrir aplicativo', click: () => this.mostrarJanela() },
      { label: 'Minimizar aplicativo', click: () => this.janela?.hide() },
      { type: 'separator' },
      {
        label: 'Configurações',
        click: () => { this.mostrarJanela(); this.enviarComando('navegar:config'); },
      },
      { type: 'separator' },
      { label: 'Sair', click: () => { this.encerrando = true; app.quit(); } },
    ]));
    // Clique com o botão esquerdo abre/restaura; o direito abre o menu acima
    this.bandeja.on('click', () => this.mostrarJanela());
  }

  // Aviso único ao fechar a janela pela primeira vez, explicando que o app continua na bandeja
  private avisarBandeja(): void {
    if (this.avisoBandejaMostrado) return;
    this.avisoBandejaMostrado = true;
    if (!Notification.isSupported()) return;
    new Notification({
      title: 'Gestão de Academia',
      body: 'O aplicativo continua na bandeja do sistema. Clique no ícone para reabrir; use o menu da bandeja (ou Arquivo > Sair) para encerrar.',
      silent: true,
    }).show();
  }

  // Caixa "Sobre": nome, versão e tecnologia usada
  private async sobre(): Promise<void> {
    await this.caixa({
      type: 'info', title: 'Sobre o aplicativo', message: 'Gestão de Academia',
      detail: `Versão ${app.getVersion()}\n\nAplicativo desktop para gestão de academia de bairro: alunos, planos, matrículas, mensalidades, aulas, avaliações físicas e avisos de chuva/vencimento.\n\nElectron ${process.versions.electron} · Chromium ${process.versions.chrome} · Node ${process.versions.node}\nBanco de dados MySQL.\n\nProjeto final da disciplina DAD.`,
      buttons: ['Fechar'], defaultId: 0, noLink: true,
    });
  }

  // Lista dos atalhos de teclado do menu
  private async atalhos(): Promise<void> {
    await this.caixa({
      type: 'info', title: 'Atalhos de teclado', message: 'Atalhos do aplicativo',
      detail: 'Ctrl+Shift+A — abrir/restaurar a janela principal\nCtrl+, — configurações\nF5 — atualizar o conteúdo da tela atual\nCtrl+R — recarregar a interface\nF11 — alternar tela cheia\nCtrl+Q — sair do aplicativo',
      buttons: ['Fechar'], defaultId: 0, noLink: true,
    });
  }

  // Abre o README do projeto como material de suporte
  private async abrirReadme(): Promise<void> {
    const erro = await shell.openPath(join(app.getAppPath(), 'README.md'));
    if (erro) await this.caixa({ type: 'warning', title: 'Suporte', message: 'Não foi possível abrir o README.', detail: erro, buttons: ['Fechar'], noLink: true });
  }

  // Cria a janela principal com as proteções do Electron ativas
  private criarJanela(): void {
    const j = new BrowserWindow({
      width: 1320, height: 840, minWidth: 1000, minHeight: 640, show: false, title: 'Gestão de Academia',
      backgroundColor: '#E6E9EE', icon: this.icone,
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
    // Fechar a janela apenas esconde o app na bandeja; "Sair" encerra de verdade
    j.on('close', (e) => {
      if (this.encerrando) return;
      e.preventDefault();
      j.hide();
      this.avisarBandeja();
    });
    j.on('closed', () => { this.janela = null; });
    // Carrega a interface
    void j.loadFile(this.indexHtml);
    this.janela = j;
  }
}

// Ponto de entrada: inicia a aplicação
void new Aplicacao().iniciar();
