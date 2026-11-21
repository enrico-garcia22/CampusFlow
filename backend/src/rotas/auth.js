import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { exigirLogin } from '../middleware/autenticacao.js';
import { ErroHttp } from '../utils/erros.js';
import { raValido, indiceRa, hashRa } from '../utils/ra.js';

export const authRouter = Router();

function limpo(v) { return typeof v === 'string' ? v.trim() : ''; }
function respostaUsuario(u) {
  return { id: u.id, nome_completo: u.nome_completo, nome_usuario: u.nome_usuario,
    email: u.email, ra_cadastrado: Boolean(u.ra_indice), telefone: u.telefone, perfil: u.perfil };
}

authRouter.post('/cadastro', async (req, res) => {
  const body = req.body ?? {};
  const nome = limpo(body.nome_completo);
  const usuario = limpo(body.nome_usuario);
  const email = limpo(body.email).toLowerCase();
  const ra = limpo(body.ra);
  const telefone = limpo(body.telefone);
  const senha = body.senha;

  if (nome.length < 3 || nome.length > 150) throw new ErroHttp(422, 'Nome completo deve ter entre 3 e 150 caracteres.');
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(usuario)) throw new ErroHttp(422, 'Nome de usuário: 3 a 30 caracteres (letras, números, ponto, hífen ou _).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) throw new ErroHttp(422, 'E-mail inválido.');
  if (!raValido(ra)) throw new ErroHttp(422, 'RA deve conter exatamente 9 dígitos numéricos.');
  if (!/^[+\d()\s-]{8,25}$/.test(telefone)) throw new ErroHttp(422, 'Telefone inválido.');
  if (typeof senha !== 'string' || senha.length < 8 || Buffer.byteLength(senha, 'utf8') > 72) {
    throw new ErroHttp(422, 'Senha deve ter pelo menos 8 caracteres e no máximo 72 bytes.');
  }

  const hash = await bcrypt.hash(senha, 12);
  const raHash = await hashRa(ra);
  const raIndice = indiceRa(ra);
  try {
    const [resultado] = await pool.execute(`
      INSERT INTO usuarios (nome_completo, nome_usuario, email, ra, ra_indice, telefone, senha_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [nome, usuario, email, raHash, raIndice, telefone, hash]);
    res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso.', id: resultado.insertId });
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') throw new ErroHttp(409, 'Já existe usuário com este nome, e-mail ou RA.');
    throw erro;
  }
});

authRouter.post('/login', async (req, res) => {
  const body = req.body ?? {};
  const identificador = limpo(body.nome_usuario);
  const senha = body.senha;
  if (!identificador || typeof senha !== 'string') throw new ErroHttp(400, 'Informe nome de usuário e senha.');
  const [usuarios] = await pool.execute(`
    SELECT * FROM usuarios WHERE nome_usuario = ? LIMIT 1
  `, [identificador]);
  if (!usuarios.length || !(await bcrypt.compare(senha, usuarios[0].senha_hash))) {
    throw new ErroHttp(401, 'Usuário ou senha incorretos.');
  }
  const u = usuarios[0];
  const token = jwt.sign({ sub: String(u.id) }, process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '8h' });
  res.json({ token, usuario: respostaUsuario(u), expira_em: '8h' });
});

authRouter.get('/me', exigirLogin, (req, res) => {
  const { ra_hash, ra_indice, ...seguro } = req.usuario;
  res.json({ usuario: { ...seguro, ra_cadastrado: Boolean(ra_indice) } });
});
