// Segurança de senhas: gera e confere hashes (scrypt com salt aleatório).
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Senhas nunca são guardadas em texto: scrypt (KDF resistente a GPU) + salt aleatório por senha. */
export class PasswordHasher {
  // Custo do scrypt (quanto maior, mais difícil quebrar por força bruta)
  private static readonly N = 16384;

  // Gera o hash da senha com salt aleatório (formato scrypt$N$salt$hash)
  static hash(senha: string): string {
    const salt = randomBytes(16);
    const h = scryptSync(senha, salt, 64, { N: PasswordHasher.N, r: 8, p: 1 });
    return `scrypt$${PasswordHasher.N}$${salt.toString('base64')}$${h.toString('base64')}`;
  }

  // Confere a senha digitada com o hash guardado
  static verify(senha: string, armazenado: string): boolean {
    const [alg, n, salt, hash] = armazenado.split('$');
    if (alg !== 'scrypt' || !salt || !hash) return false;
    const esperado = Buffer.from(hash, 'base64');
    const calculado = scryptSync(senha, Buffer.from(salt, 'base64'), esperado.length, { N: Number(n), r: 8, p: 1 });
    return timingSafeEqual(esperado, calculado); // comparação em tempo constante
  }

  /** Política mínima: 8+ caracteres com letra e número. Retorna a mensagem de erro ou null. */
  static politica(senha: string): string | null {
    if (senha.length < 8) return 'A senha deve ter ao menos 8 caracteres.';
    if (senha.length > 128) return 'A senha é longa demais.';
    if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return 'Use letras e números na senha.';
    return null;
  }
}
