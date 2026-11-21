// Migração única do esquema antigo (RA em texto puro) para hash com 9 dígitos.
// ANTES: pare a API, exporte o banco pelo phpMyAdmin e configure RA_PEPPER no .env.
// Execute: npm.cmd run migrar-ra -- ra-migracao.local.json
// Nunca comite o arquivo com o mapeamento de RA.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pool } from '../src/config/db.js';
import { raValido, hashRa, indiceRa, validarConfiguracaoRa } from '../src/utils/ra.js';

function mapaDeCorrecao() {
  const caminho = process.argv[2];
  if (!caminho) return {};
  const valor = JSON.parse(readFileSync(resolve(caminho), 'utf8'));
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new Error('Arquivo de mapeamento precisa ser um objeto JSON: { "nome_usuario": "123456789" }.');
  }
  return valor;
}

function ehBcrypt(valor) {
  return typeof valor === 'string' && /^\$2[aby]\$\d\d\$/.test(valor);
}

async function indiceExiste(con, nome) {
  const [linhas] = await con.query(`SHOW INDEX FROM usuarios WHERE Key_name = ?`, [nome]);
  return linhas.length > 0;
}

async function finalizarIndice(con) {
  const [pendentes] = await con.query('SELECT COUNT(*) AS total FROM usuarios WHERE ra_indice IS NULL');
  if (Number(pendentes[0].total) !== 0) throw new Error('Há usuários sem índice de RA. Finalização interrompida.');
  if (await indiceExiste(con, 'uq_usuarios_ra')) {
    await con.query('ALTER TABLE usuarios DROP INDEX uq_usuarios_ra');
  }
  await con.query('ALTER TABLE usuarios MODIFY ra_indice CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL');
  if (!(await indiceExiste(con, 'uq_usuarios_ra_indice'))) {
    await con.query('ALTER TABLE usuarios ADD UNIQUE KEY uq_usuarios_ra_indice (ra_indice)');
  }
}

const con = await pool.getConnection();
try {
  validarConfiguracaoRa();
  const mapa = mapaDeCorrecao();

  const [colunaIndice] = await con.query("SHOW COLUMNS FROM usuarios LIKE 'ra_indice'");
  const temIndice = colunaIndice.length > 0;
  const [usuarios] = await con.query(temIndice
    ? 'SELECT id, nome_usuario, ra, ra_indice FROM usuarios ORDER BY id'
    : 'SELECT id, nome_usuario, ra FROM usuarios ORDER BY id');

  const migrados = usuarios.filter((u) => ehBcrypt(u.ra) && u.ra_indice);
  const legados = usuarios.filter((u) => !ehBcrypt(u.ra) && !u.ra_indice);
  if (migrados.length && legados.length) {
    throw new Error('Banco parcialmente migrado; não é seguro aplicar automaticamente. Restaure o backup e refaça.');
  }
  if (usuarios.length && migrados.length === usuarios.length) {
    await finalizarIndice(con);
    console.log(`Migração já aplicada: ${usuarios.length} usuário(s) protegidos. Índice verificado.`);
    process.exitCode = 0;
  } else {
    if (usuarios.some((u) => ehBcrypt(u.ra) || u.ra_indice)) {
      throw new Error('Estado de migração inconsistente. Restaure o backup e examine os registros.');
    }

    const trabalhos = [];
    const indicesUsados = new Set();
    for (const u of usuarios) {
      const fornecido = Object.hasOwn(mapa, u.nome_usuario) ? mapa[u.nome_usuario] : u.ra;
      if (!raValido(fornecido)) {
        throw new Error(`O usuário "${u.nome_usuario}" precisa de um RA válido de 9 dígitos no arquivo de mapeamento. Nenhum dado foi alterado.`);
      }
      const indice = indiceRa(fornecido);
      if (indicesUsados.has(indice)) {
        throw new Error('Dois usuários receberam o mesmo RA no mapeamento. Nenhum dado foi alterado.');
      }
      indicesUsados.add(indice);
      trabalhos.push({ id: u.id, indice, raHash: await hashRa(fornecido) });
    }

    // Pré-condições satisfeitas: DDL de ampliação é não destrutiva, mas auto-commit no MariaDB.
    // É por isso que o backup e a parada da API são obrigatórios antes desta etapa.
    if (!temIndice) {
      await con.query('ALTER TABLE usuarios MODIFY ra VARCHAR(100) NOT NULL, ADD COLUMN ra_indice CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL');
    } else {
      await con.query('ALTER TABLE usuarios MODIFY ra VARCHAR(100) NOT NULL');
    }
    await con.query('ALTER TABLE reservas MODIFY responsavel_ra VARCHAR(100) NOT NULL');

    await con.beginTransaction();
    try {
      for (const tarefa of trabalhos) {
        await con.execute('UPDATE usuarios SET ra = ?, ra_indice = ? WHERE id = ?',
          [tarefa.raHash, tarefa.indice, tarefa.id]);
        // Preserva o histórico; substitui apenas a cópia textual do RA pelo mesmo hash.
        await con.execute('UPDATE reservas SET responsavel_ra = ? WHERE usuario_id = ?',
          [tarefa.raHash, tarefa.id]);
      }
      await con.commit();
    } catch (erro) {
      await con.rollback();
      throw erro;
    }
    await finalizarIndice(con);
    console.log(`Migração concluída: ${trabalhos.length} usuário(s) e suas reservas foram protegidos.`);
    console.log('Nenhum RA em texto puro foi exibido. Reinicie a API após verificar os dados.');
  }
} catch (erro) {
  // Nunca imprimir SQL/bindings ou o conteúdo do arquivo de mapeamento.
  console.error(`Migração interrompida: ${erro.message}`);
  process.exitCode = 1;
} finally {
  con.release();
  await pool.end();
}
