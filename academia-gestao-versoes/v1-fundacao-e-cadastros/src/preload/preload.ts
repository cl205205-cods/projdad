import { contextBridge, ipcRenderer } from 'electron';

// Ponte mínima: o renderer só enxerga invoke(). Quem decide o que é permitido é o main.
contextBridge.exposeInMainWorld('api', {
  invoke: (canal: string, payload?: unknown): Promise<unknown> => ipcRenderer.invoke(canal, payload),
});
