// DDL do banco relacional (MySQL/InnoDB). 11 tabelas ligadas por chaves estrangeiras.
// Todas com IF NOT EXISTS: o app cria o que falta ao conectar (equivale ao setup_projeto.sql da aula).
const T = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil ENUM('admin','recepcao','instrutor') NOT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    tentativas_falhas INT NOT NULL DEFAULT 0,
    bloqueado_ate DATETIME NULL
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS alunos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    cpf CHAR(11) NOT NULL UNIQUE,
    email VARCHAR(120), telefone VARCHAR(13), nascimento DATE,
    cep CHAR(8), logradouro VARCHAR(120), bairro VARCHAR(120), cidade VARCHAR(120), uf VARCHAR(2),
    telegram_chat_id VARCHAR(20),
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS planos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    tipo ENUM('mensal','trimestral','anual') NOT NULL,
    duracao_meses TINYINT NOT NULL,
    valor_mensal DECIMAL(10,2) NOT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS instrutores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL, email VARCHAR(120), telefone VARCHAR(13),
    ativo TINYINT(1) NOT NULL DEFAULT 1
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS modalidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE,
    descricao VARCHAR(500)
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS matriculas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    aluno_id INT NOT NULL,
    plano_id INT NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    status ENUM('ativa','vencida','cancelada') NOT NULL DEFAULT 'ativa',
    INDEX idx_matriculas_fim (status, data_fim),
    CONSTRAINT fk_matricula_aluno FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
    CONSTRAINT fk_matricula_plano FOREIGN KEY (plano_id) REFERENCES planos(id) ON DELETE RESTRICT
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS pagamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    matricula_id INT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    vencimento DATE NOT NULL,
    data_pagamento DATE NULL,
    forma ENUM('pix','dinheiro','cartao','boleto') NULL,
    status ENUM('pendente','pago','cancelado') NOT NULL DEFAULT 'pendente',
    INDEX idx_pagamentos_venc (status, vencimento),
    CONSTRAINT fk_pagamento_matricula FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS aulas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    modalidade_id INT NOT NULL,
    instrutor_id INT NOT NULL,
    dia_semana TINYINT NOT NULL,
    hora_inicio TIME NOT NULL,
    duracao_min INT NOT NULL,
    capacidade INT NULL,
    \`local\` VARCHAR(120) NULL,
    ao_ar_livre TINYINT(1) NOT NULL DEFAULT 0,
    CONSTRAINT fk_aula_modalidade FOREIGN KEY (modalidade_id) REFERENCES modalidades(id) ON DELETE RESTRICT,
    CONSTRAINT fk_aula_instrutor FOREIGN KEY (instrutor_id) REFERENCES instrutores(id) ON DELETE RESTRICT
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS avaliacoes_fisicas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    aluno_id INT NOT NULL,
    \`data\` DATE NOT NULL,
    peso_kg DECIMAL(6,2), altura_cm DECIMAL(5,1), cintura_cm DECIMAL(5,1), quadril_cm DECIMAL(5,1),
    peito_cm DECIMAL(5,1), braco_cm DECIMAL(5,1), coxa_cm DECIMAL(5,1), gordura_pct DECIMAL(4,1),
    observacoes VARCHAR(500),
    INDEX idx_avaliacoes_aluno (aluno_id, \`data\`),
    CONSTRAINT fk_avaliacao_aluno FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
  ) ${T}`,


  `CREATE TABLE IF NOT EXISTS configuracoes (
    chave VARCHAR(50) PRIMARY KEY,
    valor VARCHAR(1000) NOT NULL
  ) ${T}`,
];
