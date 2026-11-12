import type { Resultado } from '../shared/types';

declare global {
  interface Window {
    api: {
      invoke<T = unknown>(canal: string, payload?: unknown): Promise<Resultado<T>>;
    };
  }
}
export {};
