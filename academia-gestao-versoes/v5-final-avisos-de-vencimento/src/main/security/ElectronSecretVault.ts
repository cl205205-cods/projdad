// Cofre de segredos real: usa a criptografia do sistema operacional (safeStorage do Electron).
import { safeStorage } from 'electron';
import type { SecretVault } from './SecretVault';

/** Usa DPAPI (Windows), Keychain (macOS) ou libsecret (Linux) via safeStorage do Electron. */
export class ElectronSecretVault implements SecretVault {
  // O sistema oferece criptografia?
  disponivel(): boolean { return safeStorage.isEncryptionAvailable(); }
  // Cifra um texto (ex.: token do bot) e devolve em base64
  cifrar(texto: string): string { return safeStorage.encryptString(texto).toString('base64'); }
  // Decifra um texto guardado
  async decifrar(cifrado: string): Promise<string> {
    const { result } = await safeStorage.decryptStringAsync(Buffer.from(cifrado, 'base64'));
    return result;
  }
}
