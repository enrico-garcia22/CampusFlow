-- CampusFlow: modelo inicial de dados para MariaDB/MySQL (XAMPP)
-- Execute no phpMyAdmin > SQL ou importe este arquivo.
-- Datas de reservas e check-ins sao armazenadas em UTC.
CREATE DATABASE IF NOT EXISTS campusflow
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campusflow;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome_completo VARCHAR(150) NOT NULL,
  nome_usuario VARCHAR(50) NOT NULL,
  email VARCHAR(190) NOT NULL,
  ra VARCHAR(30) NOT NULL,
  telefone VARCHAR(30) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  perfil ENUM('aluno', 'admin') NOT NULL DEFAULT 'aluno',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuarios_nome_usuario (nome_usuario),
  UNIQUE KEY uq_usuarios_email (email),
  UNIQUE KEY uq_usuarios_ra (ra)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS salas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL,
  predio VARCHAR(100) NOT NULL,
  capacidade SMALLINT UNSIGNED NOT NULL,
  abre_as TIME NOT NULL,
  fecha_as TIME NOT NULL,
  descricao VARCHAR(255) NULL,
  ativa TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_salas_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  sala_id INT UNSIGNED NOT NULL,
  inicio_utc DATETIME NOT NULL,
  fim_utc DATETIME NOT NULL,
  qtd_pessoas SMALLINT UNSIGNED NOT NULL,
  responsavel_nome VARCHAR(150) NOT NULL,
  responsavel_ra VARCHAR(30) NOT NULL,
  responsavel_telefone VARCHAR(30) NOT NULL,
  titulo VARCHAR(150) NULL,
  descricao TEXT NULL,
  nomes_participantes TEXT NULL,
  status ENUM('confirmada', 'em_uso', 'expirada', 'cancelada', 'concluida')
    NOT NULL DEFAULT 'confirmada',
  qr_token_hash CHAR(64) NULL,
  confirmado_em_utc DATETIME NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reservas_qr_token_hash (qr_token_hash),
  KEY idx_reservas_sala_periodo (sala_id, inicio_utc, fim_utc, status),
  KEY idx_reservas_usuario (usuario_id, criado_em),
  CONSTRAINT fk_reservas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_reservas_sala FOREIGN KEY (sala_id) REFERENCES salas(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS checkins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reserva_id INT UNSIGNED NOT NULL,
  validado_por_usuario_id INT UNSIGNED NOT NULL,
  registrado_em_utc DATETIME NOT NULL,
  metodo ENUM('qr','manual') NOT NULL DEFAULT 'qr',
  UNIQUE KEY uq_checkins_reserva (reserva_id),
  CONSTRAINT fk_checkins_reserva FOREIGN KEY (reserva_id) REFERENCES reservas(id),
  CONSTRAINT fk_checkins_validador FOREIGN KEY (validado_por_usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Cinco salas de demonstração; substituíveis pelas salas reais posteriormente.
INSERT IGNORE INTO salas (nome, predio, capacidade, abre_as, fecha_as, descricao) VALUES
  ('Sala 101', 'Bloco A', 15, '07:00:00', '22:00:00', 'Sala para grupos pequenos'),
  ('Sala 102', 'Bloco A', 30, '07:00:00', '22:00:00', 'Sala de aula padrão'),
  ('Sala 201', 'Bloco B', 50, '08:00:00', '22:00:00', 'Sala de grande capacidade'),
  ('Sala 202', 'Bloco B', 25, '08:00:00', '20:00:00', 'Sala para atividades acadêmicas'),
  ('Sala 301', 'Bloco C', 40, '07:00:00', '22:00:00', 'Sala para aulas e reuniões');
