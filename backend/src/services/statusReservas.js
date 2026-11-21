import { pool } from '../config/db.js';

// Valor numérico validado antes da interpolação; SQL não recebe texto arbitrário.
const configurado = Number(process.env.GRACE_SECONDS ?? 600);
export const GRACE_SECONDS = Number.isInteger(configurado) && configurado >= 1 && configurado <= 86400
  ? configurado : 600;

// Pode ser chamado sem argumento (pool) ou dentro de transação (connection).
// Não excluímos os registros: histórico e estatísticas ficam preservados.
export async function atualizarStatusReservas(db = pool, salaId = null) {
  const filtroSala = salaId === null ? '' : ' AND sala_id = ?';
  const args = salaId === null ? [] : [salaId];
  await db.execute(`
    UPDATE reservas SET status = 'expirada'
    WHERE status = 'confirmada'
      AND DATE_ADD(inicio_utc, INTERVAL ${GRACE_SECONDS} SECOND) <= UTC_TIMESTAMP()
      ${filtroSala}
  `, args);
  await db.execute(`
    UPDATE reservas SET status = 'concluida'
    WHERE status = 'em_uso' AND fim_utc <= UTC_TIMESTAMP()
      ${filtroSala}
  `, args);
}
