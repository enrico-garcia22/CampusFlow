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
app.use(cors({ origin: (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '25kb' }));

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', servico: 'campusflow-api', banco: 'conectado' });
});

app.use('/api/auth', authRouter);
app.use('/api/salas', salasRouter);
app.use('/api/reservas', reservasRouter);
app.use('/api/admin', adminRouter);

app.use((_req, _res, next) => next(new ErroHttp(404, 'Rota não encontrada.')));
app.use((erro, _req, res, _next) => {
  const status = erro.status || 500;
  if (status === 500) console.error('Erro interno:', erro);
  res.status(status).json({ erro: status === 500 ? 'Erro interno no servidor.' : erro.message });
});
