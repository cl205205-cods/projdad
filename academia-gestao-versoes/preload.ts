import { contextBridge, ipcRenderer } from 'electron';

// Ponte mínima: o renderer só enxerga invoke() e um ouvinte de alertas. Quem decide o que é permitido é o main.
contextBridge.exposeInMainWorld('api', {
  invoke: (canal: string, payload?: unknown): Promise<unknown> => ipcRenderer.invoke(canal, payload),
  aoReceberAlerta: (cb: (alerta: unknown) => void): void => {
    ipcRenderer.on('alerta:novo', (_ev, alerta) => cb(alerta));
  },
});
