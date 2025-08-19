/*!
 * qr.js — minimal QR-Erzeugung für Estimation Poker
 * Abgeleitet von "qrcode.js" (Kazuhiko Arase / davidshimjs) – MIT License.
 * Diese Datei stellt eine sehr kleine API bereit:
 *
 *   window.SimpleQR.drawTo(canvas, text, { size: 320, margin: 4, ecl: 'M' })
 *
 * - canvas:   <canvas>-Element, in das der Code gerendert wird
 * - text:     zu codierende Zeichenkette (UTF-8)
 * - size:     Zielgröße (px) der sichtbaren Fläche
 * - margin:   weißer Rand in QR-Modulen
 * - ecl:      Fehlerkorrektur: 'L' | 'M' | 'Q' | 'H'  (Default 'M')
 *
 * Keine externen Abhängigkeiten, keine Netzwerk-Calls.
 */

/* =========================
 *  Interne QR-Implementierung
 *  (kompakte, in sich geschlossene Variante)
 * ========================= */
(function(global){
  'use strict';

  // --- Hilfsfunktionen UTF-8 ---
  function toUTF8Bytes(str){
    // Schnelle UTF-8 Kodierung
    const bytes = [];
    for (let i=0; i<str.length; i++){
      let code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6),
                   0x80 | (code & 0x3f));
      } else if (code >= 0xd800 && code <= 0xdbff) {
        // surrogate pair
        i++;
        const code2 = str.charCodeAt(i);
        const u = ((code - 0xd800) << 10) + (code2 - 0xdc00) + 0x10000;
        bytes.push(0xf0 | (u >> 18),
                   0x80 | ((u >> 12) & 0x3f),
                   0x80 | ((u >> 6) & 0x3f),
                   0x80 | (u & 0x3f));
      } else {
        bytes.push(0xe0 | (code >> 12),
                   0x80 | ((code >> 6) & 0x3f),
                   0x80 | (code & 0x3f));
      }
    }
    return bytes;
  }

  // --- Konstanten / Tabellen (aus qrcode.js, MIT) ---
  const QRMode = { MODE_NUMBER:1, MODE_ALPHA_NUM:2, MODE_8BIT_BYTE:4 };
  const QRErrorCorrectLevel = { L:1, M:0, Q:3, H:2 }; // Reihenfolge wie in Original
  const QRMaskPattern = {
    PATTERN000:0, PATTERN001:1, PATTERN010:2, PATTERN011:3,
    PATTERN100:4, PATTERN101:5, PATTERN110:6, PATTERN111:7
  };

  // Galois-Feld für RS
  const QRMath = (function(){
    const EXP_TABLE = new Array(256);
    const LOG_TABLE = new Array(256);
    for (let i=0; i<8; i++) EXP_TABLE[i] = 1 << i;
    for (let i=8; i<256; i++) EXP_TABLE[i] = EXP_TABLE[i-4] ^ EXP_TABLE[i-5] ^ EXP_TABLE[i-6] ^ EXP_TABLE[i-8];
    for (let i=0; i<255; i++) LOG_TABLE[EXP_TABLE[i]] = i;
    function gexp(n){ while(n<0) n+=255; while(n>=255) n-=255; return EXP_TABLE[n]; }
    function glog(n){ if(n<1) throw new Error('glog(' + n + ')'); return LOG_TABLE[n]; }
    return { gexp, glog };
  })();

  function QRPolynomial(num, shift){
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + (shift||0));
    for (let i=0; i<num.length - offset; i++) this.num[i] = num[i+offset];
  }
  QRPolynomial.prototype.get = function(index){ return this.num[index]; };
  QRPolynomial.prototype.getLength = function(){ return this.num.length; };
  QRPolynomial.prototype.multiply = function(e){
    const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
    for (let i=0; i<this.getLength(); i++){
      for (let j=0; j<e.getLength(); j++){
        num[i+j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
      }
    }
    return new QRPolynomial(num, 0);
  };
  QRPolynomial.prototype.mod = function(e){
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
    const num = this.num.slice();
    for (let i=0; i<e.getLength(); i++){
      if (e.get(i) !== 0) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
    }
    return new QRPolynomial(num, 0).mod(e);
  };

  const QRUtil = (function(){
    const PATTERN_POSITION_TABLE = [
      [], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42], [6,26,46],
      [6,28,50], [6,30,54], [6,32,58], [6,34,62], [6,26,46,66], [6,26,48,70],
      [6,26,50,74], [6,30,54,78], [6,30,56,82], [6,30,58,86], [6,34,62,90],
      [6,28,50,72,94], [6,26,50,74,98], [6,30,54,78,102], [6,28,54,80,106],
      [6,32,58,84,110], [6,30,58,86,114], [6,34,62,90,118], [6,26,50,74,98,122],
      [6,30,54,78,102,126], [6,26,54,82,110,138], [6,30,56,82,108,134], [6,34,60,86,112,138],
      [6,30,58,86,114,142], [6,34,62,90,118,146], [6,30,54,78,102,126,150],
      [6,24,50,76,102,128,154], [6,28,54,80,106,132,158], [6,32,58,84,110,136,162],
      [6,26,54,82,110,138,166], [6,30,58,86,114,142,170]
    ];
    function getBCHTypeInfo(data){
      let d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(0b10100110111) >= 0) {
        d ^= (0b10100110111 << (getBCHDigit(d) - getBCHDigit(0b10100110111)));
      }
      return ((data << 10) | d) ^ 0b101010000010010;
    }
    function getBCHTypeNumber(data){
      let d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(0b1111100100101) >= 0) {
        d ^= (0b1111100100101 << (getBCHDigit(d) - getBCHDigit(0b1111100100101)));
      }
      return (data << 12) | d;
    }
    function getBCHDigit(data){
      let digit = 0; while(data !== 0){ digit++; data >>>= 1; } return digit;
    }
    function getPatternPosition(typeNumber){ return PATTERN_POSITION_TABLE[typeNumber-1] || []; }
    function getMask(maskPattern, i, j){
      switch(maskPattern){
        case QRMaskPattern.PATTERN000: return (i + j) % 2 === 0;
        case QRMaskPattern.PATTERN001: return i % 2 === 0;
        case QRMaskPattern.PATTERN010: return j % 3 === 0;
        case QRMaskPattern.PATTERN011: return (i + j) % 3 === 0;
        case QRMaskPattern.PATTERN100: return (Math.floor(i/2) + Math.floor(j/3)) % 2 === 0;
        case QRMaskPattern.PATTERN101: return ((i*j) % 2) + ((i*j) % 3) === 0;
        case QRMaskPattern.PATTERN110: return (((i*j) % 3) + (i + j) % 2) === 0;
        case QRMaskPattern.PATTERN111: return (((i + j) % 3) + ((i*j) % 2)) === 0;
        default: return false;
      }
    }
    function getErrorCorrectPolynomial(ecLength){
      let a = new QRPolynomial([1], 0);
      for (let i=0; i<ecLength; i++){
        a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    }
    function getLengthInBits(mode, type){
      if (mode === QRMode.MODE_NUMBER) return type < 10 ? 10 : type < 27 ? 12 : 14;
      if (mode === QRMode.MODE_ALPHA_NUM) return type < 10 ? 9 : type < 27 ? 11 : 13;
      return type < 10 ? 8 : 16; // 8bit byte
    }
    function getLostPoint(qr){
      const moduleCount = qr.getModuleCount();
      let lostPoint = 0;

      // Adjacent modules in row/column in same color
      for (let row=0; row<moduleCount; row++){
        for (let col=0; col<moduleCount; col++){
          let sameCount = 0;
          const dark = qr.isDark(row,col);
          for (let r=-1; r<=1; r++){
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (let c=-1; c<=1; c++){
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r === 0 && c === 0) continue;
              if (dark === qr.isDark(row+r, col+c)) sameCount++;
            }
          }
          if (sameCount > 5) lostPoint += 3 + sameCount - 5;
        }
      }
      // 1:1:3:1:1 pattern in rows/cols
      function hasPattern(arr, i){
        return (arr[i] && !arr[i+1] && arr[i+2] && arr[i+3] && arr[i+4] && !arr[i+5] && arr[i+6]) ||
               (arr[i] && arr[i+1] && arr[i+2] && arr[i+3] && arr[i+4] && !arr[i+5] && arr[i+6]);
      }
      for (let row=0; row<moduleCount; row++){
        let arr = [];
        for (let col=0; col<moduleCount; col++) arr.push(qr.isDark(row,col));
        for (let i=0; i<moduleCount-6; i++){
          if (hasPattern(arr, i)) lostPoint += 40;
        }
      }
      for (let col=0; col<moduleCount; col++){
        let arr = [];
        for (let row=0; row<moduleCount; row++) arr.push(qr.isDark(row,col));
        for (let i=0; i<moduleCount-6; i++){
          if (hasPattern(arr, i)) lostPoint += 40;
        }
      }
      // Proportion of dark modules
      let darkCount = 0;
      for (let row=0; row<moduleCount; row++){
        for (let col=0; col<moduleCount; col++){
          if (qr.isDark(row,col)) darkCount++;
        }
      }
      const ratio = Math.abs(100 * darkCount / (moduleCount*moduleCount) - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    }

    return {
      getBCHTypeInfo, getBCHTypeNumber, getPatternPosition, getMask,
      getErrorCorrectPolynomial, getLengthInBits, getLostPoint
    };
  })();

  const QRRSBlock = (function(){
    // Tabellen reduziert auf häufige Versionen; ausreichend für typische URL-Längen
    const RS_BLOCK_TABLE = [
      // L,  M,  Q,  H  (für Typ 1..40) – Einträge aus qrcode.js
      // type 1
      [1,26,19],[1,26,16],[1,26,13],[1,26,9],
      // 2
      [1,44,34],[1,44,28],[1,44,22],[1,44,16],
      // 3
      [1,70,55],[1,70,44],[2,35,17],[2,35,13],
      // 4
      [1,100,80],[2,50,32],[2,50,24],[4,25,9],
      // 5
      [1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],
      // 6
      [2,86,68],[4,43,27],[4,43,19],[4,43,15],
      // 7
      [2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],
      // 8
      [2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],
      // 9
      [2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],
      // 10
      [2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16]
    ];
    function getRSBlocks(typeNumber, errorCorrectLevel){
      // Eingeschränkt auf Typ 1..10 zur Kompaktheit
      const t = (typeNumber-1)*4 + errorCorrectLevel; // naive Indexierung
      const list = [];
      const rs = RS_BLOCK_TABLE.slice((typeNumber-1)*4, (typeNumber-1)*4 + 4)[errorCorrectLevel];
      // rs kann Arrays mit Paaren enthalten (count, totalCodewords)
      // Kompakte Auswertung:
      const arr = RS_BLOCK_TABLE.slice((typeNumber-1)*4, (typeNumber-1)*4 + 4);
      const entry = arr[errorCorrectLevel];
      if (!entry) throw new Error('No RS block for type ' + typeNumber);
      // Flatten
      if (entry.length === 3){
        const [count,total,ec] = entry;
        for (let i=0; i<count; i++) list.push({ totalCount: total, dataCount: total - ec });
      } else {
        for (let i=0; i<entry.length; i+=3){
          const count = entry[i], total = entry[i+1], ec = entry[i+2];
          for (let c=0; c<count; c++) list.push({ totalCount: total, dataCount: total - ec });
        }
      }
      return list;
    }
    return { getRSBlocks };
  })();

  function QRBitBuffer(){
    this.buffer = [];
    this.length = 0;
  }
  QRBitBuffer.prototype.get = function(index){
    return ((this.buffer[Math.floor(index/8)] >>> (7 - index % 8)) & 1) === 1;
  };
  QRBitBuffer.prototype.put = function(num, length){
    for (let i=0; i<length; i++){
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  };
  QRBitBuffer.prototype.putBit = function(bit){
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
    this.length++;
  };

  function QR8bitByte(data){
    this.mode = QRMode.MODE_8BIT_BYTE;
    this.data = data;
  }
  QR8bitByte.prototype.getLength = function(){ return this.data.length; };
  QR8bitByte.prototype.write = function(buffer){
    for (let i=0; i<this.data.length; i++){
      buffer.put(this.data[i], 8);
    }
  };

  function QRCodeModel(typeNumber, errorCorrectLevel){
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataList = [];
  }
  QRCodeModel.prototype.addData = function(dataBytes){
    this.dataList.push(new QR8bitByte(dataBytes));
  };
  QRCodeModel.prototype.isDark = function(row,col){ return this.modules[row][col]; };
  QRCodeModel.prototype.getModuleCount = function(){ return this.moduleCount; };

  QRCodeModel.prototype.make = function(){
    this.makeImpl(false, this.getBestMaskPattern());
  };
  QRCodeModel.prototype.makeImpl = function(test, maskPattern){
    this.moduleCount = this.typeNumber*4 + 17;
    this.modules = new Array(this.moduleCount);
    for (let row=0; row<this.moduleCount; row++){
      this.modules[row] = new Array(this.moduleCount).fill(null);
    }
    // Finder / Timing / Alignment
    function setupPositionProbePattern(modules, row, col){
      for (let r=-1; r<=7; r++){
        if (row + r <= -1 || modules.length <= row + r) continue;
        for (let c=-1; c<=7; c++){
          if (col + c <= -1 || modules.length <= col + c) continue;
          modules[row + r][col + c] =
            (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4);
        }
      }
    }
    function setupPositionAdjustPattern(modules, typeNumber){
      const pos = QRUtil.getPatternPosition(typeNumber);
      for (let i=0; i<pos.length; i++){
        for (let j=0; j<pos.length; j++){
          const row = pos[i], col = pos[j];
          if (modules[row][col] !== null) continue;
          for (let r=-2; r<=2; r++){
            for (let c=-2; c<=2; c++){
              modules[row + r][col + c] = (Math.max(Math.abs(r), Math.abs(c)) !== 1);
            }
          }
        }
      }
    }
    function setupTimingPattern(modules){
      for (let i=0; i<modules.length; i++){
        if (modules[6][i] === null) modules[6][i] = (i % 2 === 0);
        if (modules[i][6] === null) modules[i][6] = (i % 2 === 0);
      }
    }
    setupPositionProbePattern(this.modules, 0, 0);
    setupPositionProbePattern(this.modules, this.moduleCount-7, 0);
    setupPositionProbePattern(this.modules, 0, this.moduleCount-7);
    setupTimingPattern(this.modules);
    setupPositionAdjustPattern(this.modules, this.typeNumber);

    // Type / Format (später gesetzt)
    // Daten platzieren
    const data = this.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;

    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--; // Skip vertical timing
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            }
            const mask = QRUtil.getMask(maskPattern, row, col - c);
            this.modules[row][col - c] = mask ? !dark : dark;
            bitIndex--;
            if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break; }
      }
    }

    this.setupTypeInfo(this.modules, this.errorCorrectLevel, maskPattern);
    if (this.typeNumber >= 7) this.setupTypeNumber(this.modules, this.typeNumber);
  };

  QRCodeModel.prototype.setupTypeInfo = function(modules, errorCorrectLevel, maskPattern){
    const data = (QRErrorCorrectLevel.L === errorCorrectLevel ? 1 :
                  QRErrorCorrectLevel.M === errorCorrectLevel ? 0 :
                  QRErrorCorrectLevel.Q === errorCorrectLevel ? 3 : 2) << 3 | maskPattern;
    const bits = QRUtil.getBCHTypeInfo(data);
    for (let i=0; i<15; i++){
      const mod = ((bits >> i) & 1) === 1;
      // vertical
      if (i<6) modules[i][8] = mod;
      else if (i<8) modules[i+1][8] = mod;
      else modules[this.moduleCount-15+i][8] = mod;
      // horizontal
      if (i<8) modules[8][this.moduleCount - i -1] = mod;
      else if (i<9) modules[8][15 - i -1 + 1] = mod;
      else modules[8][15 - i -1] = mod;
    }
    // fixed dark module
    modules[this.moduleCount-8][8] = true;
  };

  QRCodeModel.prototype.setupTypeNumber = function(modules, typeNumber){
    const bits = QRUtil.getBCHTypeNumber(typeNumber);
    for (let i=0; i<18; i++){
      const mod = ((bits >> i) & 1) === 1;
      modules[Math.floor(i/3)][i%3 + this.moduleCount - 8 - 3] = mod;
      modules[i%3 + this.moduleCount - 8 - 3][Math.floor(i/3)] = mod;
    }
  };

  QRCodeModel.prototype.getBestMaskPattern = function(){
    let min = 0, pattern = 0;
    for (let i=0; i<8; i++){
      this.makeImpl(true, i);
      const lost = QRUtil.getLostPoint(this);
      if (i === 0 || lost < min){ min = lost; pattern = i; }
    }
    return pattern;
  };

  QRCodeModel.prototype.createBytes = function(buffer, rsBlocks){
    let offset = 0;
    let maxDc = 0, maxEc = 0;
    const dcdata = [];
    const ecdata = [];

    for (let r=0; r<rsBlocks.length; r++){
      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;
      maxDc = Math.max(maxDc, dcCount);
      maxEc = Math.max(maxEc, ecCount);
      dcdata[r] = new Array(dcCount);
      for (let i=0; i<dcCount; i++) dcdata[r][i] = buffer.buffer[i + offset] || 0;
      offset += dcCount;
      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
      const rawPoly = new QRPolynomial(dcdata[r], 0);
      const modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(ecCount);
      const modLen = modPoly.getLength();
      for (let i=0; i<ecCount; i++){
        ecdata[r][i] = i < ecCount - modLen ? 0 : modPoly.get(i - (ecCount - modLen));
      }
    }

    const totalCodeCount = rsBlocks.reduce((s, b) => s + b.totalCount, 0);
    const data = new Array(totalCodeCount);
    let index = 0;

    for (let i=0; i<maxDc; i++){
      for (let r=0; r<rsBlocks.length; r++){
        if (i < dcdata[r].length) data[index++] = dcdata[r][i];
      }
    }
    for (let i=0; i<maxEc; i++){
      for (let r=0; r<rsBlocks.length; r++){
        if (i < ecdata[r].length) data[index++] = ecdata[r][i];
      }
    }
    return data;
  };

  QRCodeModel.prototype.createData = function(typeNumber, errorCorrectLevel, dataList){
    const buffer = new QRBitBuffer();
    for (let i=0; i<dataList.length; i++){
      const data = dataList[i];
      buffer.put(QRMode.MODE_8BIT_BYTE, 4);
      buffer.put(data.getLength(), QRUtil.getLengthInBits(QRMode.MODE_8BIT_BYTE, typeNumber));
      data.write(buffer);
    }
    // Terminator
    const totalDataCount = QRCodeModel.getTotalDataCount(typeNumber, errorCorrectLevel);
    if (buffer.length + 4 <= totalDataCount*8) buffer.put(0, 4);
    // Pad to byte
    while (buffer.length % 8 !== 0) buffer.putBit(false);
    // Pad bytes
    while (buffer.length/8 < totalDataCount){
      buffer.put(0xec, 8);
      if (buffer.length/8 < totalDataCount) buffer.put(0x11, 8);
    }

    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
    return this.createBytes(buffer, rsBlocks);
  };

  // Daten-Kapazitäten für Typ 1..10 / ECL L,M,Q,H (Byte-Mode) – ausreichend für typische URLs
  const CAP_TABLE = {
    1:  {L:17,  M:14,  Q:11,  H:7 },
    2:  {L:32,  M:26,  Q:20,  H:14},
    3:  {L:53,  M:42,  Q:32,  H:24},
    4:  {L:78,  M:62,  Q:46,  H:34},
    5:  {L:106, M:84,  Q:60,  H:44},
    6:  {L:134, M:106, Q:74,  H:58},
    7:  {L:154, M:122, Q:86,  H:64},
    8:  {L:192, M:152, Q:108, H:84},
    9:  {L:230, M:180, Q:130, H:98},
    10: {L:271, M:213, Q:151, H:119}
  };

  QRCodeModel.getTotalDataCount = function(typeNumber, errorCorrectLevel){
    // total data codewords = Sum(dataCount) der RS-Blöcke
    const blocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
    return blocks.reduce((s,b)=>s + b.dataCount, 0);
  };

  function chooseTypeFor(length, ecl){
    for (let t=1; t<=10; t++){
      if (CAP_TABLE[t] && CAP_TABLE[t][ecl] && length <= CAP_TABLE[t][ecl]) return t;
    }
    // Falls extrem lang: konservativ maximale der Tabelle
    return 10;
  }

  // --- Öffentliche, kleine API ---
  function drawTo(canvas, text, opts){
    if (!canvas || !canvas.getContext) throw new Error('SimpleQR: canvas required');
    opts = opts || {};
    const size = Math.max(48, Math.floor(opts.size || 320));
    const margin = Math.max(0, Math.floor(opts.margin || 4));
    const ecl = (opts.ecl || 'M').toUpperCase();
    const ecLevel = {L:QRErrorCorrectLevel.L, M:QRErrorCorrectLevel.M, Q:QRErrorCorrectLevel.Q, H:QRErrorCorrectLevel.H}[ecl] ?? QRErrorCorrectLevel.M;

    const data = toUTF8Bytes(String(text || ''));
    const typeNumber = chooseTypeFor(data.length, ecl);

    const qr = new QRCodeModel(typeNumber, ecLevel);
    qr.addData(data);
    qr.make();

    const count = qr.getModuleCount();
    const modules = count + margin*2;

    // Canvas vorbereiten (High-DPI sauber)
    const ctx = canvas.getContext('2d');
    const scale = 1; // echte Pixel
    const pxSize = modules; // 1:1 Roh-Matrix
    canvas.width = pxSize;
    canvas.height = pxSize;

    // Hintergrund (weiß)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pxSize, pxSize);

    // Module zeichnen
    ctx.fillStyle = '#000000';
    for (let r=0; r<count; r++){
      for (let c=0; c<count; c++){
        if (qr.isDark(r,c)){
          ctx.fillRect(c + margin, r + margin, 1, 1);
        }
      }
    }

    // Sauber auf Zielgröße skalieren (imageSmoothing disabled)
    if (size !== pxSize){
      const tmp = document.createElement('canvas');
      tmp.width = pxSize; tmp.height = pxSize;
      tmp.getContext('2d').drawImage(canvas, 0, 0);
      canvas.width = size; canvas.height = size;
      const ctx2 = canvas.getContext('2d');
      ctx2.imageSmoothingEnabled = false;
      ctx2.drawImage(tmp, 0, 0, size, size);
    }
  }

  global.SimpleQR = { drawTo };

})(window);
