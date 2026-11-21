import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { ErroHttp } from '../utils/erros.js';

export async function exigirLogin(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw new ErroHttp(401, 'Token de acesso ausente.');
    let payload;
    try {
      payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      throw new ErroHttp(401, 'Token inválido ou expirado.');
    }
    const [usuarios] = await pool.execute(`
      SELECT id, nome_completo, nome_usuario, email, ra, ra_indice, telefone, perfil
      FROM usuarios WHERE id = ?
    `, [payload.sub]);
    if (usuarios.length === 0) throw new ErroHttp(401, 'Usuário não encontrado.');
    // O hash é usado apenas internamente ao criar a reserva.
    req.usuario = { ...usuarios[0], ra_hash: usuarios[0].ra };
    delete req.usuario.ra;
    next();
  } catch (erro) { next(erro); }
}

export function exigirAdmin(req, _res, next) {
  if (req.usuario?.perfil !== 'admin') return next(new ErroHttp(403, 'Acesso exclusivo ao administrador.'));
  next();
}
