import type { AlertaChuva, Resultado } from '../shared/types';

declare global {
  interface Window {
    api: {
      invoke<T = unknown>(canal: string, payload?: unknown): Promise<Resultado<T>>;
      aoReceberAlerta(cb: (alerta: AlertaChuva) => void): void;
    };
  }
}
export {};
