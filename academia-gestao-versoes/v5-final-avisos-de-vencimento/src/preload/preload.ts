// Preload: ponte segura entre a interface (renderer) e o processo main.
import { contextBridge, ipcRenderer } from 'electron';

// Callbacks registrados pela interface. Ficam guardados aqui para os ouvintes do IPC serem
// registrados uma única vez (entrar, sair e entrar de novo não duplica os avisos).
let aoAlerta: ((alerta: unknown) => void) | null = null;
let aoComando: ((comando: string) => void) | null = null;
let ouvintesRegistrados = false;

// Registra os canais que vão do main para a interface (só uma vez)
function registrarOuvintes(): void {
  if (ouvintesRegistrados) return;
  ouvintesRegistrados = true;
  ipcRenderer.on('alerta:novo', (_ev, alerta) => aoAlerta?.(alerta));
  ipcRenderer.on('app:comando', (_ev, comando) => aoComando?.(String(comando)));
}

// Ponte mínima: o renderer só enxerga invoke() e os ouvintes. Quem decide o que é permitido é o main.
contextBridge.exposeInMainWorld('api', {
  // Pede uma operação ao main
  invoke: (canal: string, payload?: unknown): Promise<unknown> => ipcRenderer.invoke(canal, payload),
  // Recebe os alertas de chuva enviados pelo main
  aoReceberAlerta: (cb: (alerta: unknown) => void): void => {
    aoAlerta = cb;
    registrarOuvintes();
  },
  // Recebe comandos do menu nativo e da bandeja (ex.: "navegar:relatorios", "atualizar")
  aoReceberComando: (cb: (comando: string) => void): void => {
    aoComando = cb;
    registrarOuvintes();
  },
});
