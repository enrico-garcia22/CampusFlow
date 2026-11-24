import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';

// Usar DB_INIT_ON_START=true apenas ao provisionar banco vazio.
// Adapta o SQL de desenvolvimento ao banco já criado pelo serviço MySQL da hospedagem.
export async function inicializarBancoSeSolicitado() {
  if (process.env.DB_INIT_ON_START !== 'true') return;

  const sqlOriginal = await fs.readFile(new URL('../../../banco/campusflow.sql', import.meta.url), 'utf8');
  const sql = sqlOriginal.replace(
    /CREATE DATABASE IF NOT EXISTS campusflow[\s\S]*?;\s*USE campusflow\s*;/i,
    ''
  );
  if (sql === sqlOriginal) {
    throw new Error('Não foi possível adaptar banco/campusflow.sql ao banco configurado.');
  }

  const conexao = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'campusflow',
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  try {
    await conexao.query(sql);
    console.log('[Banco] Tabelas e salas de demonstração verificadas.');
  } finally {
    await conexao.end();
  }
}
