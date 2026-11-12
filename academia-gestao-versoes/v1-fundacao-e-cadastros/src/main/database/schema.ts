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






  `CREATE TABLE IF NOT EXISTS configuracoes (
    chave VARCHAR(50) PRIMARY KEY,
    valor VARCHAR(1000) NOT NULL
  ) ${T}`,
];
