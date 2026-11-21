import { pool } from '../src/config/db.js';

const nomeUsuario = process.argv[2];
if (!nomeUsuario) {
  console.error('Uso: npm run admin -- nome_de_usuario');
  process.exit(1);
}
try {
  const [resultado] = await pool.execute(
    "UPDATE usuarios SET perfil = 'admin' WHERE nome_usuario = ?", [nomeUsuario]);
  if (!resultado.affectedRows) {
    console.error('Usuário não encontrado. Cadastre-o antes pela API.');
    process.exitCode = 1;
  } else {
    console.log(`Usuário ${nomeUsuario} agora possui perfil admin.`);
  }
} catch (erro) {
  console.error('Erro:', erro.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
