// Metadados das entidades: usados pelo main (validação/SQL) e pelo renderer (formulários/tabelas).
export type EntityName = 'alunos' | 'instrutores' | 'modalidades' | 'planos' | 'usuarios';
export type Perfil = 'admin' | 'recepcao' | 'instrutor';
export type Acao = 'c' | 'r' | 'u' | 'd';
export type FieldType =
  | 'text' | 'textarea' | 'email' | 'tel' | 'cpf' | 'cep' | 'number'
  | 'date' | 'time' | 'select' | 'bool' | 'ref' | 'password';

export interface Option { value: string | number; label: string }
export interface Field {
  name: string; label: string; type: FieldType;
  required?: boolean; list?: boolean;
  virtual?: boolean;   // não é coluna da tabela (ex.: senha em texto, tratada pelo serviço)
  readonly?: boolean;  // calculado pelo sistema, ignorado na entrada
  min?: number; max?: number; step?: number; maxLength?: number;
  options?: Option[]; ref?: EntityName; default?: string | number;
}
export interface EntityDef {
  name: EntityName; table: string; label: string; plural: string; orderBy: string; fields: Field[];
}



export const ENTITIES: Record<EntityName, EntityDef> = {
  alunos: {
    name: 'alunos', table: 'alunos', label: 'Aluno', plural: 'Alunos', orderBy: 't.nome',
    fields: [
      { name: 'nome', label: 'Nome', type: 'text', required: true, list: true },
      { name: 'cpf', label: 'CPF', type: 'cpf', required: true, list: true },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'telefone', label: 'Telefone / WhatsApp', type: 'tel', list: true },
      { name: 'nascimento', label: 'Nascimento', type: 'date' },
      { name: 'cep', label: 'CEP', type: 'cep' },
      { name: 'logradouro', label: 'Logradouro', type: 'text' },
      { name: 'bairro', label: 'Bairro', type: 'text' },
      { name: 'cidade', label: 'Cidade', type: 'text' },
      { name: 'uf', label: 'UF', type: 'text', maxLength: 2 },
      { name: 'telegram_chat_id', label: 'Telegram (chat id)', type: 'text', maxLength: 20 },
      { name: 'ativo', label: 'Ativo', type: 'bool', list: true, default: 1 },
    ],
  },
  instrutores: {
    name: 'instrutores', table: 'instrutores', label: 'Instrutor', plural: 'Instrutores', orderBy: 't.nome',
    fields: [
      { name: 'nome', label: 'Nome', type: 'text', required: true, list: true },
      { name: 'email', label: 'E-mail', type: 'email', list: true },
      { name: 'telefone', label: 'Telefone', type: 'tel', list: true },
      { name: 'ativo', label: 'Ativo', type: 'bool', list: true, default: 1 },
    ],
  },
  modalidades: {
    name: 'modalidades', table: 'modalidades', label: 'Modalidade', plural: 'Modalidades', orderBy: 't.nome',
    fields: [
      { name: 'nome', label: 'Nome', type: 'text', required: true, list: true },
      { name: 'descricao', label: 'Descrição', type: 'textarea', list: true },
    ],
  },
  planos: {
    name: 'planos', table: 'planos', label: 'Plano', plural: 'Planos', orderBy: 't.duracao_meses, t.nome',
    fields: [
      { name: 'nome', label: 'Nome', type: 'text', required: true, list: true },
      {
        name: 'tipo', label: 'Tipo', type: 'select', required: true, list: true,
        options: [{ value: 'mensal', label: 'Mensal (1 mês)' }, { value: 'trimestral', label: 'Trimestral (3 meses)' }, { value: 'anual', label: 'Anual (12 meses)' }],
      },
      { name: 'valor_mensal', label: 'Valor da mensalidade (R$)', type: 'number', required: true, list: true, min: 0, max: 100000, step: 0.01 },
      { name: 'ativo', label: 'Ativo', type: 'bool', list: true, default: 1 },
    ],
  },
  usuarios: {
    name: 'usuarios', table: 'usuarios', label: 'Usuário', plural: 'Usuários', orderBy: 't.nome',
    fields: [
      { name: 'nome', label: 'Nome', type: 'text', required: true, list: true },
      { name: 'email', label: 'E-mail (login)', type: 'email', required: true, list: true },
      {
        name: 'perfil', label: 'Perfil', type: 'select', required: true, list: true,
        options: [{ value: 'admin', label: 'Administrador' }, { value: 'recepcao', label: 'Recepção' }, { value: 'instrutor', label: 'Instrutor' }],
      },
      { name: 'senha', label: 'Senha (deixe vazio para manter)', type: 'password', virtual: true, required: true },
      { name: 'ativo', label: 'Ativo', type: 'bool', list: true, default: 1 },
    ],
  },
};

// ---- Controle de acesso (RBAC). A regra real é aplicada no processo main; o renderer só usa para esconder menus.
type Matriz = Partial<Record<EntityName, Acao[]>>;
const CRUD: Acao[] = ['c', 'r', 'u', 'd'];
export const PERMISSOES: Record<Perfil, Matriz | '*'> = {
  admin: '*',
  recepcao: {
    alunos: CRUD,
    planos: ['r'], instrutores: ['r'], modalidades: ['r'],
  },
  instrutor: {
    alunos: ['r'], modalidades: ['r'], instrutores: ['r'],
  },
};

export function pode(perfil: Perfil, entidade: EntityName, acao: Acao): boolean {
  const m = PERMISSOES[perfil];
  return m === '*' || (m[entidade]?.includes(acao) ?? false);
}
