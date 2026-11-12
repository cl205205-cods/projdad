import { join } from 'node:path';
import { config as carregarEnv } from 'dotenv';
import { createConnection, type Connection } from 'mysql2';

// Credenciais ficam no arquivo .env (raiz do projeto), nunca no código nem no Git.
carregarEnv({ path: join(__dirname, '../../.env'), quiet: true });

const OBRIGATORIAS = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const;
export const variaveisFaltando = (): string[] => OBRIGATORIAS.filter((v) => !process.env[v]);

function criarConexao(): Connection {
  const c = createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    dateStrings: true,     // DATE/DATETIME chegam como texto "AAAA-MM-DD" (sem surpresas de fuso)
    decimalNumbers: true,  // DECIMAL chega como número, não como texto
    connectTimeout: 10_000,
  });
  // Sem este ouvinte, uma queda de conexão derrubaria o processo main.
  c.on('error', (e) => console.error('[mysql] conexão:', e.message));
  return c;
}

/** Única conexão do app (somente no processo Main). `let` porque reconectar() a recria após uma queda. */
export let conexao: Connection = criarConexao();

export function reconectar(): Connection {
  try { conexao.destroy(); } catch { /* já estava fechada */ }
  conexao = criarConexao();
  return conexao;
}
