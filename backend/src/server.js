import { app } from './app.js';
import { pool } from './config/db.js';
import { atualizarStatusReservas, GRACE_SECONDS } from './services/statusReservas.js';
import { validarConfiguracaoRa } from './utils/ra.js';
import { inicializarBancoSeSolicitado } from './config/inicializarBanco.js';

const segredo = process.env.JWT_SECRET || '';
if (segredo.length < 32 || segredo.startsWith('SUBSTITUA_')) {
  console.error('Defina JWT_SECRET forte no arquivo .env antes de iniciar.');
  process.exit(1);
}

try {
  validarConfiguracaoRa();
  await inicializarBancoSeSolicitado();
  await pool.query('SELECT 1');
  await atualizarStatusReservas();
  const porta = Number(process.env.PORT || 3001);
  app.listen(porta, () => {
    console.log(`CampusFlow API: http://localhost:${porta}/api/health`);
    console.log(`Prazo de check-in: ${GRACE_SECONDS} segundos`);
  });
  // Rotina local para transicionar status mesmo sem consultas à API.
  // A própria API também atualiza os status quando recebe consultas/reservas.
  // Na hospedagem, adicionar cron independente para não depender do processo ativo.
  // Evita polling permanente no plano serverless. Em produção, as operações da
  // API continuam atualizando os estados sob demanda.
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_STATUS_TIMER === 'true') {
    setInterval(() => atualizarStatusReservas().catch((e) => console.error('Falha em status:', e)), 15000).unref();
  }
} catch (erro) {
  console.error('Não foi possível conectar ao banco. Verifique XAMPP, importação SQL e .env.');
  console.error(erro.message);
  process.exit(1);
}
