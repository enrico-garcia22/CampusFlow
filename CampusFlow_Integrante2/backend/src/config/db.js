import 'dotenv/config';
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campusflow',
  waitForConnections: true,
  connectionLimit: 10,
  // Todos os DATETIME *_utc são gravados em UTC.
  timezone: 'Z',
  dateStrings: true,
  multipleStatements: false,
  charset: 'utf8mb4',
});
