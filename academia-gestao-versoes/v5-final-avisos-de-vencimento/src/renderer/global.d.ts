// Tipos da ponte window.api (definida no preload).
import type { AlertaChuva, Resultado } from '../shared/types';

declare global {
  interface Window {
    api: {
      // Chama uma operação do main
      invoke<T = unknown>(canal: string, payload?: unknown): Promise<Resultado<T>>;
      // Ouvinte de alertas de chuva
      aoReceberAlerta(cb: (alerta: AlertaChuva) => void): void;
    };
  }
}
export {};
