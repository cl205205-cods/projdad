// Contrato do cofre de segredos (permite trocar a implementação, ex.: em testes).
/** Guarda segredos (token do bot) cifrados. Implementação real usa o cofre do sistema operacional. */
export interface SecretVault {
  // Informa se o cofre está disponível
  disponivel(): boolean;
  // Cifra um texto
  cifrar(texto: string): string;
  // Decifra um texto
  decifrar(cifrado: string): string;
}
