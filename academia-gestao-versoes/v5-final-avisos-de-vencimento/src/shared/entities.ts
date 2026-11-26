// Metadados das entidades: usados pelo main (validação/SQL) e pelo renderer (formulários/tabelas).
export type EntityName =
  | 'alunos' | 'instrutores' | 'modalidades' | 'planos' | 'matriculas'
  | 'pagamentos' | 'aulas' | 'avaliacoes' | 'usuarios';
// Perfis de acesso
export type Perfil = 'admin' | 'recepcao' | 'instrutor';
// Ações do CRUD: c = criar, r = ler, u = editar, d = excluir
export type Acao = 'c' | 'r' | 'u' | 'd';
// Tipos de campo (definem a validação e o controle do formulário)
export type FieldType =
  | 'text' | 'textarea' | 'email' | 'tel' | 'cpf' | 'cep' | 'number'
  | 'date' | 'time' | 'select' | 'bool' | 'ref' | 'password';

// Opção de lista suspensa
export interface Option { value: string | number; label: string }
// Definição de um campo da entidade
export interface Field {
  name: string; label: string; type: FieldType;
  required?: boolean; list?: boolean;
  virtual?: boolean;   // não é coluna da tabela (ex.: senha em texto, tratada pelo serviço)
  readonly?: boolean;  // calculado pelo sistema, ignorado na entrada
  min?: number; max?: number; step?: number; maxLength?: number;
  options?: Option[]; ref?: EntityName; default?: string | number;
}
// Definição de uma entidade (tabela, rótulos e campos)
export interface EntityDef {
  name: EntityName; table: string; label: string; plural: string; orderBy: string; fields: Field[];
}

// Dias da semana (0 = Domingo)
export const DIAS_SEMANA: Option[] = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  .map((label, value) => ({ value, label }));
// Formas de pagamento aceitas
export const FORMAS_PAGAMENTO: Option[] = [
  { value: 'pix', label: 'Pix' }, { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' }, { value: 'boleto', label: 'Boleto' },
];

// Atalho para criar campos de medida corporal
const medida = (name: string, label: string, max: number): Field =>
  ({ name, label, type: 'number', min: 1, max, step: 0.1 });

// Todas as entidades do sistema: o CRUD, a validação e os formulários nascem daqui
export const ENTITIES: Record<EntityName, EntityDef> = {
  // Entidade: Alunos (dados pessoais, endereço e Telegram)
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
  // Entidade: Instrutores
  instrutores: {
    name: 'instrutores', table: 'instrutores', label: 'Instrutor', plural: 'Instrutores', orderBy: 't.nome',
    fields: [
      { name: 'nome', label: 'Nome', type: 'text', required: true, list: true },
      { name: 'email', label: 'E-mail', type: 'email', list: true },
      { name: 'telefone', label: 'Telefone', type: 'tel', list: true },
      { name: 'ativo', label: 'Ativo', type: 'bool', list: true, default: 1 },
    ],
  },
  // Entidade: Modalidades
  modalidades: {
    name: 'modalidades', table: 'modalidades', label: 'Modalidade', plural: 'Modalidades', orderBy: 't.nome',
    fields: [
      { name: 'nome', label: 'Nome', type: 'text', required: true, list: true },
      { name: 'descricao', label: 'Descrição', type: 'textarea', list: true },
    ],
  },
  // Entidade: Planos (mensal, trimestral e anual)
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
  // Entidade: Matrículas (aluno + plano; término calculado)
  matriculas: {
    name: 'matriculas', table: 'matriculas', label: 'Matrícula', plural: 'Matrículas', orderBy: 't.data_fim DESC',
    fields: [
      { name: 'aluno_id', label: 'Aluno', type: 'ref', ref: 'alunos', required: true, list: true },
      { name: 'plano_id', label: 'Plano', type: 'ref', ref: 'planos', required: true, list: true },
      { name: 'data_inicio', label: 'Início', type: 'date', required: true, list: true },
      { name: 'data_fim', label: 'Término (calculado)', type: 'date', readonly: true, list: true },
      {
        name: 'status', label: 'Situação', type: 'select', required: true, list: true, default: 'ativa',
        options: [{ value: 'ativa', label: 'Ativa' }, { value: 'vencida', label: 'Vencida' }, { value: 'cancelada', label: 'Cancelada' }],
      },
    ],
  },
  // Entidade: Pagamentos (mensalidades)
  pagamentos: {
    name: 'pagamentos', table: 'pagamentos', label: 'Pagamento', plural: 'Pagamentos', orderBy: 't.vencimento DESC',
    fields: [
      { name: 'matricula_id', label: 'Matrícula', type: 'ref', ref: 'matriculas', required: true, list: true },
      { name: 'valor', label: 'Valor (R$)', type: 'number', required: true, list: true, min: 0, max: 100000, step: 0.01 },
      { name: 'vencimento', label: 'Vencimento', type: 'date', required: true, list: true },
      { name: 'data_pagamento', label: 'Pago em', type: 'date' },
      { name: 'forma', label: 'Forma', type: 'select', options: FORMAS_PAGAMENTO },
      {
        name: 'status', label: 'Status', type: 'select', required: true, list: true, default: 'pendente',
        options: [{ value: 'pendente', label: 'Pendente' }, { value: 'pago', label: 'Pago' }, { value: 'cancelado', label: 'Cancelado' }],
      },
    ],
  },
  // Entidade: Aulas semanais (modalidade + instrutor)
  aulas: {
    name: 'aulas', table: 'aulas', label: 'Aula', plural: 'Aulas', orderBy: 't.dia_semana, t.hora_inicio',
    fields: [
      { name: 'modalidade_id', label: 'Modalidade', type: 'ref', ref: 'modalidades', required: true, list: true },
      { name: 'instrutor_id', label: 'Instrutor', type: 'ref', ref: 'instrutores', required: true, list: true },
      { name: 'dia_semana', label: 'Dia da semana', type: 'select', required: true, list: true, options: DIAS_SEMANA },
      { name: 'hora_inicio', label: 'Horário', type: 'time', required: true, list: true },
      { name: 'duracao_min', label: 'Duração (min)', type: 'number', required: true, min: 15, max: 240, step: 5, default: 60 },
      { name: 'capacidade', label: 'Vagas', type: 'number', min: 1, max: 200, step: 1 },
      { name: 'local', label: 'Local', type: 'text', list: true },
      { name: 'ao_ar_livre', label: 'Ao ar livre', type: 'bool', list: true, default: 0 },
    ],
  },
  // Entidade: Avaliações físicas (dado sensível de saúde)
  avaliacoes: {
    name: 'avaliacoes', table: 'avaliacoes_fisicas', label: 'Avaliação física', plural: 'Avaliações físicas', orderBy: 't.data DESC',
    fields: [
      { name: 'aluno_id', label: 'Aluno', type: 'ref', ref: 'alunos', required: true, list: true },
      { name: 'data', label: 'Data', type: 'date', required: true, list: true },
      { ...medida('peso_kg', 'Peso (kg)', 400), list: true },
      medida('altura_cm', 'Altura (cm)', 250),
      { ...medida('cintura_cm', 'Cintura (cm)', 300), list: true },
      medida('quadril_cm', 'Quadril (cm)', 300),
      medida('peito_cm', 'Peitoral (cm)', 300),
      medida('braco_cm', 'Braço (cm)', 100),
      medida('coxa_cm', 'Coxa (cm)', 150),
      { ...medida('gordura_pct', 'Gordura corporal (%)', 80), list: true },
      { name: 'observacoes', label: 'Observações', type: 'textarea' },
    ],
  },
  // Entidade: Usuários do sistema (login e perfil)
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
// Permissões por entidade
type Matriz = Partial<Record<EntityName, Acao[]>>;
// Todas as ações do CRUD
const CRUD: Acao[] = ['c', 'r', 'u', 'd'];
// Matriz de permissões: admin faz tudo; recepção cuida de alunos, matrículas e pagamentos; instrutor das avaliações
export const PERMISSOES: Record<Perfil, Matriz | '*'> = {
  admin: '*',
  recepcao: {
    alunos: CRUD, matriculas: CRUD, pagamentos: CRUD,
    planos: ['r'], instrutores: ['r'], modalidades: ['r'], aulas: ['r'], avaliacoes: ['r'],
  },
  instrutor: {
    alunos: ['r'], aulas: ['r'], modalidades: ['r'], instrutores: ['r'], avaliacoes: CRUD,
  },
};

// Confere se um perfil pode executar uma ação em uma entidade
export function pode(perfil: Perfil, entidade: EntityName, acao: Acao): boolean {
  const m = PERMISSOES[perfil];
  return m === '*' || (m[entidade]?.includes(acao) ?? false);
}
