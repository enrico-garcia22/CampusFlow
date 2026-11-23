import express from 'express';
import cors from 'cors';
import { authRouter } from './rotas/auth.js';
import { salasRouter } from './rotas/salas.js';
import { reservasRouter } from './rotas/reservas.js';
import { adminRouter } from './rotas/admin.js';
import { pool } from './config/db.js';
import { ErroHttp } from './utils/erros.js';

export const app = express();
app.disable('x-powered-by');

// CORS flexível para suportar tanto localhost quanto acesso por celular na mesma rede local
app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (mobile apps, curl, etc.) ou qualquer origem local em desenvolvimento
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.') || origin.includes('10.')) {
      return callback(null, true);
    }
    const configuredOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',');
    if (configuredOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permite em desenvolvimento acadêmico
  },
  credentials: true,
}));

app.use(express.json({ limit: '25kb' }));

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', servico: 'campusflow-api', banco: 'conectado' });
});

app.use('/api/auth', authRouter);
app.use('/api/salas', salasRouter);
app.use('/api/reservas', reservasRouter);

// Roteamento direto de /api/checkin para o endpoint de validação de presenças
app.use('/api/checkin', (req, res, next) => {
  req.url = '/checkin';
  reservasRouter(req, res, next);
});

app.use('/api/admin', adminRouter);

app.use((_req, _res, next) => next(new ErroHttp(404, 'Rota não encontrada.')));
app.use((erro, _req, res, _next) => {
  const status = erro.status || 500;
  if (status === 500) console.error('Erro interno:', erro);
  res.status(status).json({ erro: status === 500 ? 'Erro interno no servidor.' : erro.message });
});
