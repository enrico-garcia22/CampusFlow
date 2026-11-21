import { createHmac } from 'node:crypto';
import bcrypt from 'bcryptjs';

// O RA é um identificador numérico, mas decidimos tratá-lo como segredo:
// nem o dado original nem um hash rápido sem chave são persistidos.
export function raValido(ra) {
  return typeof ra === 'string' && /^[0-9]{9}$/.test(ra);
}

export function validarConfiguracaoRa() {
  const chave = process.env.RA_PEPPER || '';
  if (!/^[0-9a-f]{64}$/i.test(chave)) {
    throw new Error('Defina RA_PEPPER com 32 bytes aleatórios (64 caracteres hexadecimais) no .env.');
  }
  return Buffer.from(chave, 'hex');
}

function hmacRa(dominio, ra) {
  if (!raValido(ra)) throw new Error('RA deve conter exatamente 9 dígitos numéricos.');
  const chave = validarConfiguracaoRa();
  return createHmac('sha256', chave).update(`campusflow:${dominio}:v1:`).update(ra, 'utf8');
}

// Índice determinístico, protegido por chave fora do banco, para impedir duplicidade.
export function indiceRa(ra) {
  return hmacRa('indice', ra).digest('hex');
}

function entradaBcryptRa(ra) {
  // 44 bytes de base64; evita o limite de 72 bytes do bcrypt.
  return hmacRa('hash', ra).digest('base64');
}

export async function hashRa(ra) {
  return bcrypt.hash(entradaBcryptRa(ra), 12);
}

export async function conferirRa(ra, hashArmazenado) {
  if (!raValido(ra) || typeof hashArmazenado !== 'string') return false;
  return bcrypt.compare(entradaBcryptRa(ra), hashArmazenado);
}
