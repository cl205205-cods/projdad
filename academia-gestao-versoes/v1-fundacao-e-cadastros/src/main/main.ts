import { app, BrowserWindow, Menu, dialog, ipcMain, session, type IpcMainInvokeEvent } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { conexao, variaveisFaltando } from './conexao';
import { Database } from './database/Database';
import { HttpClient } from './services/HttpClient';
import { AuthService } from './services/AuthService';
import { CepService } from './services/CepService';
import { CrudService } from './services/CrudService';
import { IpcRouter } from './ipc/IpcRouter';

class Aplicacao {
  private janela: BrowserWindow | null = null;
  private readonly indexHtml = join(__dirname, '../renderer/index.html');

  async iniciar(): Promise<void> {
    if (!app.requestSingleInstanceLock()) { app.quit(); return; } // uma só instância: evita rotinas de alerta e avisos duplicados
    app.on('second-instance', () => { this.janela?.isMinimized() && this.janela.restore(); this.janela?.focus(); });
    await app.whenReady();

    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false)); // nenhuma permissão extra
    if (app.isPackaged) Menu.setApplicationMenu(null);

    // Primeiro uso real da conexão, antes de qualquer janela existir (sem IPC): falhou -> dialog nativo.
    if (!(await this.testarConexaoBanco())) { app.quit(); return; }
    const db = new Database();
    await db.migrar(); // cria as tabelas que faltarem (CREATE TABLE IF NOT EXISTS)
    const http = new HttpClient();
    const router = new IpcRouter({ auth: new AuthService(db), crud: new CrudService(db), cep: new CepService(http) });

    for (const canal of router.canais()) {
      ipcMain.handle(canal, (ev, payload) =>
        this.origemConfiavel(ev) ? router.despachar(canal, payload) : { ok: false, error: 'Origem não confiável.' });
    }


    this.criarJanela();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) this.criarJanela(); });
    app.on('window-all-closed', () => { void db.fechar().finally(() => app.quit()); });
  }

  private testarConexaoBanco(): Promise<boolean> {
    return new Promise((resolve) => {
      const faltando = variaveisFaltando();
      if (faltando.length > 0) {
        dialog.showErrorBox('Configuração do banco incompleta',
          `Defina no arquivo .env (copie o .env.example): ${faltando.join(', ')}`);
        resolve(false);
        return;
      }
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


  private criarJanela(): void {
    const j = new BrowserWindow({
      width: 1320, height: 840, minWidth: 1000, minHeight: 640, show: false, title: 'Gestão de Academia',
      backgroundColor: '#E6E9EE',
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      },
    });
    j.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    j.webContents.on('will-navigate', (e) => e.preventDefault());
    j.once('ready-to-show', () => j.show());
    j.on('closed', () => { this.janela = null; });
    void j.loadFile(this.indexHtml);
    this.janela = j;
  }
}

void new Aplicacao().iniciar();
