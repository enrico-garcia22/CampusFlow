import { ErroHttp } from './erros.js';

export const FUSO_CAMPUS = 'America/Sao_Paulo';

// A API recebe data/hora com fuso, como 2026-11-20T14:00:00-03:00.
// Assim não confundimos 14h em Sorocaba com 14h UTC.
export function lerInstante(valor, nomeCampo) {
  if (typeof valor !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(valor)) {
    throw new ErroHttp(400, `${nomeCampo} deve incluir data, hora e fuso (ex.: 2026-11-20T14:00:00-03:00).`);
  }
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) {
    throw new ErroHttp(400, `${nomeCampo} inválido.`);
  }
  return instante;
}

const formatoCampus = new Intl.DateTimeFormat('en-GB', {
  timeZone: FUSO_CAMPUS,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function partesCampus(data) {
  const p = Object.fromEntries(formatoCampus.formatToParts(data).map((x) => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

export function validarPeriodo(inicio, fim, agora = new Date()) {
  const dataInicio = lerInstante(inicio, 'inicio');
  const dataFim = lerInstante(fim, 'fim');
  if (dataInicio.getTime() < agora.getTime()) {
    throw new ErroHttp(422, 'O início da reserva deve estar no futuro.');
  }
  if (dataFim.getTime() <= dataInicio.getTime()) {
    throw new ErroHttp(422, 'O fim precisa ser posterior ao início.');
  }
  if (partesCampus(dataInicio).dia !== partesCampus(dataFim).dia) {
    throw new ErroHttp(422, 'Nesta primeira versão, a reserva deve começar e terminar no mesmo dia.');
  }
  return { dataInicio, dataFim };
}

export function dentroDoHorarioSala(dataInicio, dataFim, sala) {
  const hInicio = partesCampus(dataInicio).hora;
  const hFim = partesCampus(dataFim).hora;
  return hInicio >= sala.abre_as.slice(0, 5) && hFim <= sala.fecha_as.slice(0, 5);
}

export function paraSqlUtc(data) {
  return data.toISOString().slice(0, 19).replace('T', ' ');
}

export function sqlUtcParaIso(valor) {
  return valor ? `${valor.replace(' ', 'T')}Z` : null;
}
