// Preload: ponte segura entre a interface (renderer) e o processo main.
import { contextBridge, ipcRenderer } from 'electron';

// Ponte mínima: o renderer só enxerga invoke() e um ouvinte de alertas. Quem decide o que é permitido é o main.
contextBridge.exposeInMainWorld('api', {
  // Pede uma operação ao main
  invoke: (canal: string, payload?: unknown): Promise<unknown> => ipcRenderer.invoke(canal, payload),
  // Recebe os alertas de chuva enviados pelo main
  aoReceberAlerta: (cb: (alerta: unknown) => void): void => {
    ipcRenderer.on('alerta:novo', (_ev, alerta) => cb(alerta));
  },
});
