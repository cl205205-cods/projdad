/** Erro com mensagem segura para exibir ao usuário. Qualquer outro erro vira "Erro interno". */
export class AppError extends Error {
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message);
    this.name = 'AppError';
  }
}

/** Converte erros do MySQL (códigos ER_*) e de rede em mensagens úteis; outros erros viram null (tratados como internos). */
export function traduzirErroBanco(e: unknown): AppError | null {
  const err = e as (Error & { code?: string }) | undefined;
  const code = err?.code ?? '';
  switch (code) {
    case 'ER_DUP_ENTRY':
      return new AppError('Já existe um registro com este valor (CPF, e-mail ou nome).');
    case 'ER_ROW_IS_REFERENCED': case 'ER_ROW_IS_REFERENCED_2': case 'ER_NO_REFERENCED_ROW': case 'ER_NO_REFERENCED_ROW_2':
      return new AppError('Operação bloqueada: há registros vinculados ou a relação informada não existe.');
    case 'ER_DATA_TOO_LONG': case 'ER_TRUNCATED_WRONG_VALUE': case 'ER_WARN_DATA_OUT_OF_RANGE': case 'ER_BAD_NULL_ERROR':
    case 'ER_CHECK_CONSTRAINT_VIOLATED': case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
      return new AppError('Valor não permitido pelas regras do banco de dados.');
    case 'ER_ACCESS_DENIED_ERROR': case 'ER_DBACCESS_DENIED_ERROR': case 'ER_TABLEACCESS_DENIED_ERROR':
      return new AppError('Acesso negado pelo banco de dados. Confira usuário e senha no arquivo .env.');
    case 'ECONNREFUSED': case 'ETIMEDOUT': case 'ENOTFOUND': case 'EHOSTUNREACH': case 'ENETUNREACH': case 'ECONNRESET': case 'PROTOCOL_CONNECTION_LOST':
      return new AppError('Sem conexão com o banco de dados. Verifique a rede da escola/VPN e o arquivo .env.');
    default:
      return /closed state/i.test(err?.message ?? '') ? new AppError('A conexão com o banco foi perdida. Tente novamente.') : null;
  }
}
