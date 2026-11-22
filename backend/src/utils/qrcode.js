import crypto from 'node:crypto';

/**
 * CampusFlow - Gerador e Validador de QR Code
 * Implementação pura em JavaScript para independência de bibliotecas nativas.
 * Gera matriz QR padrão ISO/IEC 18004 (versões 1 a 10, nível M/L, modo Byte).
 */

export function gerarTokenQr() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Gera um token unívoco e seguro para a reserva usando HMAC com o segredo do servidor.
 * Permite que o organizador recupere o QR Code autenticado sem salvar o token em texto puro no banco.
 */
export function gerarTokenReserva({ usuarioId, salaId, inicioUtc, fimUtc }) {
  const secret = process.env.JWT_SECRET || 'campusflow_jwt_secret_dev_key_min_32';
  const payload = `campusflow:reserva:${usuarioId}:${salaId}:${inicioUtc}:${fimUtc}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function hashTokenQr(token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Token inválido para hash.');
  }
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

// -------------------------------------------------------------
// Implementação de Matriz QR Code pura (sem dependências externas)
// -------------------------------------------------------------

const QRMode = { MODE_NUMBER: 1, MODE_ALPHA_NUM: 2, MODE_8BIT_BYTE: 4 };
const QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };

// Tabelas Galois Field GF(256) com polinômio primitivo 0x11D
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP_TABLE[i] = x;
  LOG_TABLE[x] = i;
  x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
}
EXP_TABLE[255] = EXP_TABLE[0];

function glog(n) {
  if (n < 1) throw new Error(`glog(${n})`);
  return LOG_TABLE[n];
}

function gexp(n) {
  while (n < 0) n += 255;
  while (n >= 255) n -= 255;
  return EXP_TABLE[n];
}

class QRPolynomial {
  constructor(num, shift = 0) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Uint8Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) {
      this.num[i] = num[offset + i];
    }
  }
  get(index) { return this.num[index]; }
  getLength() { return this.num.length; }
  multiply(e) {
    const num = new Uint8Array(this.getLength() + e.getLength() - 1);
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
      }
    }
    return new QRPolynomial(num);
  }
  mod(e) {
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = glog(this.get(0)) - glog(e.get(0));
    const num = new Uint8Array(this.num);
    for (let i = 0; i < e.getLength(); i++) {
      num[i] ^= gexp(glog(e.get(i)) + ratio);
    }
    return new QRPolynomial(num).mod(e);
  }
}

// Capacidades e blocos de código de correção de erro por versão (V1 a V10)
const RS_BLOCK_TABLE = [
  // [totalCodewords, dataCodewords, ecCount]
  // V1
  [ [1, 26, 19] ], // L
  [ [1, 26, 16] ], // M
  [ [1, 26, 13] ], // Q
  [ [1, 26, 9] ],  // H
  // V2
  [ [1, 44, 34] ],
  [ [1, 44, 28] ],
  [ [1, 44, 22] ],
  [ [1, 44, 16] ],
  // V3
  [ [1, 70, 55] ],
  [ [1, 70, 44] ],
  [ [2, 35, 17] ],
  [ [2, 35, 13] ],
  // V4
  [ [1, 100, 80] ],
  [ [2, 50, 32] ],
  [ [2, 50, 24] ],
  [ [4, 25, 9] ],
  // V5
  [ [1, 134, 108] ],
  [ [2, 67, 43] ],
  [ [2, 33, 15], [2, 34, 16] ],
  [ [2, 33, 11], [2, 34, 12] ],
  // V6
  [ [2, 86, 68] ],
  [ [4, 43, 27] ],
  [ [4, 43, 19] ],
  [ [4, 43, 15] ],
  // V7
  [ [2, 98, 78] ],
  [ [4, 49, 31] ],
  [ [2, 32, 14], [4, 33, 15] ],
  [ [4, 39, 13], [1, 40, 14] ],
  // V8
  [ [2, 121, 97] ],
  [ [2, 60, 38], [2, 61, 39] ],
  [ [4, 40, 18], [2, 41, 19] ],
  [ [4, 40, 14], [2, 41, 15] ],
  // V9
  [ [2, 146, 116] ],
  [ [3, 58, 36], [2, 59, 37] ],
  [ [4, 36, 16], [4, 37, 17] ],
  [ [4, 36, 12], [4, 37, 13] ],
  // V10
  [ [2, 86, 68], [2, 87, 69] ],
  [ [4, 69, 43], [1, 70, 44] ],
  [ [6, 43, 19], [2, 44, 20] ],
  [ [6, 43, 15], [2, 44, 16] ],
];

const ALIGNMENT_PATTERN_TABLE = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

class QR8bitByte {
  constructor(data) {
    this.mode = QRMode.MODE_8BIT_BYTE;
    this.data = new TextEncoder().encode(data);
  }
  getLength() { return this.data.length; }
  write(buffer) {
    for (let i = 0; i < this.data.length; i++) {
      buffer.put(this.data[i], 8);
    }
  }
}

class QRBitBuffer {
  constructor() {
    this.buffer = [];
    this.length = 0;
  }
  get(index) {
    const bufIndex = Math.floor(index / 8);
    return ((this.buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1;
  }
  put(num, length) {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }
  putBit(bit) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
    this.length++;
  }
}

class QRCodeModel {
  constructor(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataList = [];
  }
  addData(data) {
    this.dataList.push(new QR8bitByte(data));
  }
  isDark(row, col) {
    if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
      throw new Error(`${row},${col}`);
    }
    return this.modules[row][col];
  }
  getModuleCount() { return this.moduleCount; }
  make() {
    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = Array.from({ length: this.moduleCount }, () => new Array(this.moduleCount).fill(null));
    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);
    this.setupPositionAdjustPattern();
    this.setupTimingPattern();
    this.setupTypeInfo(true, 0);
    if (this.typeNumber >= 7) this.setupTypeNumber(true);

    const data = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
    this.mapData(data, 0);
  }
  setupPositionProbePattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        if ((0 <= r && r <= 6 && (c === 0 || c === 6))
            || (0 <= c && c <= 6 && (r === 0 || r === 6))
            || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
          this.modules[row + r][col + c] = true;
        } else {
          this.modules[row + r][col + c] = false;
        }
      }
    }
  }
  setupTimingPattern() {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] !== null) continue;
      this.modules[r][6] = (r % 2 === 0);
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] !== null) continue;
      this.modules[6][c] = (c % 2 === 0);
    }
  }
  setupPositionAdjustPattern() {
    const pos = ALIGNMENT_PATTERN_TABLE[this.typeNumber - 1];
    if (!pos) return;
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i];
        const col = pos[j];
        if (this.modules[row][col] !== null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
              this.modules[row + r][col + c] = true;
            } else {
              this.modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  }
  setupTypeInfo(test, maskPattern) {
    const data = (this.errorCorrectLevel << 3) | maskPattern;
    const bits = QRCodeModel.getBCHTypeInfo(data);
    for (let i = 0; i < 15; i++) {
      const mod = (!test && ((bits >> i) & 1) === 1);
      if (i < 6) this.modules[i][8] = mod;
      else if (i < 8) this.modules[i + 1][8] = mod;
      else this.modules[this.moduleCount - 15 + i][8] = mod;
    }
    for (let i = 0; i < 15; i++) {
      const mod = (!test && ((bits >> i) & 1) === 1);
      if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
      else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
      else this.modules[8][15 - i - 1] = mod;
    }
    this.modules[this.moduleCount - 8][8] = !test;
  }
  setupTypeNumber(test) {
    const bits = QRCodeModel.getBCHTypeNumber(this.typeNumber);
    for (let i = 0; i < 18; i++) {
      const mod = (!test && ((bits >> i) & 1) === 1);
      this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod;
    }
    for (let i = 0; i < 18; i++) {
      const mod = (!test && ((bits >> i) & 1) === 1);
      this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  }
  mapData(data, maskPattern) {
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;

    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
            }
            const mask = QRCodeModel.getMask(maskPattern, row, col - c);
            if (mask) dark = !dark;
            this.modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }

  static getMask(maskPattern, i, j) {
    switch (maskPattern) {
      case 0: return (i + j) % 2 === 0;
      case 1: return i % 2 === 0;
      case 2: return j % 3 === 0;
      case 3: return (i + j) % 3 === 0;
      case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
      case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
      case 7: return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
      default: throw new Error(`maskPattern:${maskPattern}`);
    }
  }

  static getBCHTypeInfo(data) {
    let d = data << 10;
    while (QRCodeModel.getBCHDigit(d) - QRCodeModel.getBCHDigit(0x537) >= 0) {
      d ^= (0x537 << (QRCodeModel.getBCHDigit(d) - QRCodeModel.getBCHDigit(0x537)));
    }
    return ((data << 10) | d) ^ 0x5412;
  }
  static getBCHTypeNumber(data) {
    let d = data << 12;
    while (QRCodeModel.getBCHDigit(d) - QRCodeModel.getBCHDigit(0x1F25) >= 0) {
      d ^= (0x1F25 << (QRCodeModel.getBCHDigit(d) - QRCodeModel.getBCHDigit(0x1F25)));
    }
    return (data << 12) | d;
  }
  static getBCHDigit(data) {
    let digit = 0;
    while (data !== 0) {
      digit++;
      data >>>= 1;
    }
    return digit;
  }

  static createData(typeNumber, errorCorrectLevel, dataList) {
    const rsBlocks = RS_BLOCK_TABLE[(typeNumber - 1) * 4 + errorCorrectLevel];
    const buffer = new QRBitBuffer();

    for (const data of dataList) {
      buffer.put(data.mode, 4);
      buffer.put(data.getLength(), typeNumber < 10 ? 8 : 16);
      data.write(buffer);
    }

    let totalDataCount = 0;
    for (const block of rsBlocks) {
      totalDataCount += block[0] * block[2];
    }

    if (buffer.length + 4 <= totalDataCount * 8) {
      buffer.put(0, 4);
    }
    while (buffer.length % 8 !== 0) {
      buffer.putBit(false);
    }
    while (buffer.length < totalDataCount * 8) {
      buffer.put(0xec, 8);
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0x11, 8);
    }

    return QRCodeModel.createBytes(buffer, rsBlocks);
  }

  static createBytes(buffer, rsBlocks) {
    let offset = 0;
    let maxDcCount = 0;
    let maxEcCount = 0;

    const dcdata = [];
    const ecdata = [];

    for (const block of rsBlocks) {
      const count = block[0];
      const totalCount = block[1];
      const dataCount = block[2];
      const ecCount = totalCount - dataCount;

      maxDcCount = Math.max(maxDcCount, dataCount);
      maxEcCount = Math.max(maxEcCount, ecCount);

      for (let r = 0; r < count; r++) {
        const dc = new Uint8Array(dataCount);
        for (let i = 0; i < dataCount; i++) {
          dc[i] = 0xff & buffer.buffer[i + offset];
        }
        offset += dataCount;
        dcdata.push(dc);

        const rsPoly = QRCodeModel.getErrorCorrectPolynomial(ecCount);
        const rawPoly = new QRPolynomial(dc, rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);

        const ec = new Uint8Array(rsPoly.getLength() - 1);
        for (let i = 0; i < ec.length; i++) {
          const modIndex = i + modPoly.getLength() - ec.length;
          ec[i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
        }
        ecdata.push(ec);
      }
    }

    const totalBytes = dcdata.reduce((acc, b) => acc + b.length, 0)
                     + ecdata.reduce((acc, b) => acc + b.length, 0);
    const data = new Uint8Array(totalBytes);
    let index = 0;

    for (let i = 0; i < maxDcCount; i++) {
      for (let r = 0; r < dcdata.length; r++) {
        if (i < dcdata[r].length) data[index++] = dcdata[r][i];
      }
    }
    for (let i = 0; i < maxEcCount; i++) {
      for (let r = 0; r < ecdata.length; r++) {
        if (i < ecdata[r].length) data[index++] = ecdata[r][i];
      }
    }
    return data;
  }

  static getErrorCorrectPolynomial(errorCorrectLength) {
    let a = new QRPolynomial([1], 0);
    for (let i = 0; i < errorCorrectLength; i++) {
      a = a.multiply(new QRPolynomial([1, gexp(i)], 0));
    }
    return a;
  }
}

/**
 * Determina a menor versão de QR necessária para a quantidade de bytes
 */
function determinarVersao(numBytes, errorCorrectLevel = QRErrorCorrectLevel.M) {
  for (let v = 1; v <= 10; v++) {
    const rsBlocks = RS_BLOCK_TABLE[(v - 1) * 4 + errorCorrectLevel];
    let totalDataCount = 0;
    for (const b of rsBlocks) totalDataCount += b[0] * b[2];
    // Modo Byte consome 4 bits modo + 8 bits tamanho + dados*8 + 4 bits término
    const bitsNecessarios = 4 + 8 + (numBytes * 8) + 4;
    if (bitsNecessarios <= totalDataCount * 8) return v;
  }
  return 10;
}

/**
 * Gera o SVG correspondente ao texto fornecido (URL ou token).
 * @param {string} texto Dados a codificar
 * @param {object} opcoes { tamanho: number, margem: number, corEscura: string, corClara: string }
 * @returns {string} Código XML do SVG
 */
export function gerarQrCodeSvg(texto, {
  tamanho = 280,
  margem = 4,
  corEscura = '#0f172a',
  corClara = '#ffffff',
} = {}) {
  const bytes = new TextEncoder().encode(texto);
  const versao = determinarVersao(bytes.length, QRErrorCorrectLevel.M);
  const qr = new QRCodeModel(versao, QRErrorCorrectLevel.M);
  qr.addData(texto);
  qr.make();

  const count = qr.getModuleCount();
  const total = count + margem * 2;

  let pathD = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        const x = c + margem;
        const y = r + margem;
        pathD += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${tamanho}" height="${tamanho}" shape-rendering="crispEdges" role="img" aria-label="QR Code para validação de presença">`,
    `<rect width="100%" height="100%" fill="${corClara}"/>`,
    `<path d="${pathD.trim()}" fill="${corEscura}"/>`,
    `</svg>`,
  ].join('');
}

/**
 * Gera Data URI do SVG para uso direto em src de <img>
 */
export function gerarQrCodeDataUri(texto, opcoes = {}) {
  const svg = gerarQrCodeSvg(texto, opcoes);
  const base64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
