/*!
 * qr.js — Minimaler QR-Generator (Byte-Mode), MIT.
 * API:
 *   window.SimpleQR.drawTo(canvas, text, { size: 320, margin: 4, ecl: 'M' })
 * Hinweise:
 * - Keine externen Abhängigkeiten, keine Netz-Calls.
 * - Korrigierte RS-Block-Tabelle & Auswertung (fix für iPhone-Scan).
 */

(function(global){
  'use strict';

  /* ========== Utils ========== */
  function toUTF8Bytes(str){
    const out = [];
    for (let i=0; i<str.length; i++){
      let c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c>>6), 0x80 | (c & 0x3F));
      else if (c >= 0xD800 && c <= 0xDBFF){
        i++;
        const c2 = str.charCodeAt(i);
        const u = ((c-0xD800)<<10) + (c2-0xDC00) + 0x10000;
        out.push(0xF0 | (u>>18), 0x80 | ((u>>12)&0x3F), 0x80 | ((u>>6)&0x3F), 0x80 | (u&0x3F));
      } else {
        out.push(0xE0 | (c>>12), 0x80 | ((c>>6)&0x3F), 0x80 | (c&0x3F));
      }
    }
    return out;
  }

  /* ========== GF(256) / RS ========== */
  const QRMath = (function(){
    const EXP = new Array(256), LOG = new Array(256);
    for (let i=0; i<8; i++) EXP[i] = 1<<i;
    for (let i=8; i<256; i++) EXP[i] = EXP[i-4]^EXP[i-5]^EXP[i-6]^EXP[i-8];
    for (let i=0; i<255; i++) LOG[EXP[i]] = i;
    function gexp(n){ while(n<0)n+=255; while(n>=255)n-=255; return EXP[n]; }
    function glog(n){ if(n<1) throw new Error('glog('+n+')'); return LOG[n]; }
    return { gexp, glog };
  })();

  function QRPolynomial(num, shift){
    let offset = 0; while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + (shift||0));
    for (let i=0; i<num.length - offset; i++) this.num[i] = num[i+offset];
  }
  QRPolynomial.prototype.get = function(i){ return this.num[i]; };
  QRPolynomial.prototype.getLength = function(){ return this.num.length; };
  QRPolynomial.prototype.multiply = function(e){
    const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
    for (let i=0;i<this.getLength();i++){
      for (let j=0;j<e.getLength();j++){
        num[i+j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
      }
    }
    return new QRPolynomial(num, 0);
  };
  QRPolynomial.prototype.mod = function(e){
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
    const num = this.num.slice();
    for (let i=0;i<e.getLength();i++){
      if (e.get(i)!==0) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
    }
    return new QRPolynomial(num, 0).mod(e);
  };

  /* ========== QR Utilities ========== */
  const QRMode = { NUM:1, ALNUM:2, BYTE:4 };
  const QRECLBits = { L:1, M:0, Q:3, H:2 }; // fürs Format (BCH)
  const QRMaskPattern = { P000:0,P001:1,P010:2,P011:3,P100:4,P101:5,P110:6,P111:7 };

  const QRUtil = (function(){
    // Position Adjustments (1..40) – wir brauchen <=10, trotzdem Tabelle fast komplett.
    const POS_TABLE = [
      [],[6,18],[6,22],[6,26],[6,30],[6,34],
      [6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],
      [6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],
      [6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],
      [6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],
      [6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],
      [6,30,54,78,102,126],[6,26,54,82,110,138],[6,30,56,82,108,134],
      [6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],
      [6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],
      [6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]
    ];

    function getBCHDigit(data){ let n=0; for(;data!==0; n++) data>>>=1; return n; }
    function getBCHTypeInfo(data){
      let d = data<<10, g = 0b10100110111;
      while (getBCHDigit(d) - getBCHDigit(g) >= 0) d ^= (g << (getBCHDigit(d) - getBCHDigit(g)));
      return ((data<<10)|d) ^ 0b101010000010010;
    }
    function getBCHTypeNumber(data){
      let d = data<<12, g = 0b1111100100101;
      while (getBCHDigit(d) - getBCHDigit(g) >= 0) d ^= (g << (getBCHDigit(d) - getBCHDigit(g)));
      return (data<<12)|d;
    }
    function getPatternPosition(type){ return POS_TABLE[type-1] || []; }
    function getMask(mask,i,j){
      switch(mask){
        case 0: return (i+j)%2===0;
        case 1: return i%2===0;
        case 2: return j%3===0;
        case 3: return (i+j)%3===0;
        case 4: return (Math.floor(i/2)+Math.floor(j/3))%2===0;
        case 5: return ((i*j)%2)+((i*j)%3)===0;
        case 6: return (((i*j)%3)+(i+j)%2)===0;
        case 7: return (((i+j)%3)+((i*j)%2))===0;
        default: return false;
      }
    }
    function getErrorCorrectPolynomial(ecLen){
      let a = new QRPolynomial([1],0);
      for(let i=0;i<ecLen;i++) a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)],0));
      return a;
    }
    function getLengthInBits(mode, type){
      if (mode === QRMode.NUM)   return type<10 ? 10 : type<27 ? 12 : 14;
      if (mode === QRMode.ALNUM) return type<10 ? 9  : type<27 ? 11 : 13;
      return type<10 ? 8 : 16; // BYTE
    }
    function getLostPoint(qr){
      const n = qr.getModuleCount();
      let lost = 0;
      // Adjacent modules
      for(let r=0;r<n;r++){
        for(let c=0;c<n;c++){
          const dark = qr.isDark(r,c);
          let cnt = 0;
          for(let dr=-1; dr<=1; dr++){
            for(let dc=-1; dc<=1; dc++){
              if (dr===0 && dc===0) continue;
              const rr=r+dr, cc=c+dc;
              if (rr<0||rr>=n||cc<0||cc>=n) continue;
              if (dark === qr.isDark(rr,cc)) cnt++;
            }
          }
          if (cnt>5) lost += 3 + cnt - 5;
        }
      }
      // Finder-like patterns in rows/cols
      function hasPattern(a,i){
        return i+6<a.length && (
          (a[i] && !a[i+1] && a[i+2] && a[i+3] && a[i+4] && !a[i+5] && a[i+6]) ||
          (!a[i] && a[i+1] && a[i+2] && a[i+3] && a[i+4] && !a[i+5] && a[i+6])
        );
      }
      for(let r=0;r<n;r++){
        const a=[]; for(let c=0;c<n;c++) a.push(qr.isDark(r,c));
        for(let i=0;i<n-6;i++) if (hasPattern(a,i)) lost += 40;
      }
      for(let c=0;c<n;c++){
        const a=[]; for(let r=0;r<n;r++) a.push(qr.isDark(r,c));
        for(let i=0;i<n-6;i++) if (hasPattern(a,i)) lost += 40;
      }
      // Dark ratio
      let dark=0; for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(qr.isDark(r,c)) dark++;
      const ratio = Math.abs( (100*dark/(n*n)) - 50 ) / 5;
      lost += ratio * 10;
      return lost;
    }
    return { getBCHTypeInfo, getBCHTypeNumber, getPatternPosition, getMask,
             getErrorCorrectPolynomial, getLengthInBits, getLostPoint };
  })();

  /* ========== RS Block Table (Typ 1..10) ==========
   * Format je Eintrag: [count, totalCodewords, dataCodewords, ...]
   * Reihenfolge: (L, M, Q, H)
   */
  const RS_BLOCK_TABLE = [
    // 1
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
  function ecIndexFor(ecl){ return ecl==='L'?0 : ecl==='M'?1 : ecl==='Q'?2 : 3; }

  const QRRSBlock = {
    getRSBlocks: function(typeNumber, eclLetter){
      const idx = (typeNumber - 1) * 4 + ecIndexFor(eclLetter);
      const entry = RS_BLOCK_TABLE[idx];
      if (!entry) throw new Error('No RS for type '+typeNumber+' ecl '+eclLetter);
      const list = [];
      for (let i=0; i<entry.length; i+=3){
        const count = entry[i], total = entry[i+1], data = entry[i+2];
        for (let c=0;c<count;c++) list.push({ totalCount: total, dataCount: data });
      }
      return list;
    }
  };

  function QRBitBuffer(){ this.buffer=[]; this.length=0; }
  QRBitBuffer.prototype.get = function(i){
    return ((this.buffer[Math.floor(i/8)] >>> (7 - i%8)) & 1) === 1;
  };
  QRBitBuffer.prototype.put = function(num, len){
    for (let i=0;i<len;i++) this.putBit(((num >>> (len-i-1)) & 1) === 1);
  };
  QRBitBuffer.prototype.putBit = function(bit){
    const idx = Math.floor(this.length/8);
    if (this.buffer.length <= idx) this.buffer.push(0);
    if (bit) this.buffer[idx] |= (0x80 >>> (this.length % 8));
    this.length++;
  };

  function QR8bitByte(bytes){ this.mode=QRMode.BYTE; this.data=bytes; }
  QR8bitByte.prototype.getLength = function(){ return this.data.length; };
  QR8bitByte.prototype.write = function(buf){ for(let i=0;i<this.data.length;i++) buf.put(this.data[i],8); };

  /* ========== QR Code Model ========== */
  function QRCodeModel(typeNumber, eclLetter){
    this.typeNumber = typeNumber;
    this.eclLetter  = eclLetter; // 'L'|'M'|'Q'|'H'
    this.modules = null;
    this.moduleCount = 0;
    this.dataList = [];
  }
  QRCodeModel.prototype.addData = function(bytes){
    this.dataList.push(new QR8bitByte(bytes));
  };
  QRCodeModel.prototype.isDark = function(r,c){ return this.modules[r][c]; };
  QRCodeModel.prototype.getModuleCount = function(){ return this.moduleCount; };

  QRCodeModel.prototype.make = function(){
    this._makeImpl(false, this._bestMask());
  };
  QRCodeModel.prototype._bestMask = function(){
    let min=0, pattern=0;
    for (let i=0;i<8;i++){
      this._makeImpl(true, i);
      const lost = QRUtil.getLostPoint(this);
      if (i===0 || lost<min){ min=lost; pattern=i; }
    }
    return pattern;
  };

  QRCodeModel.prototype._makeImpl = function(test, mask){
    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = new Array(this.moduleCount);
    for (let r=0;r<this.moduleCount;r++) this.modules[r] = new Array(this.moduleCount).fill(null);

    const mc = this.moduleCount, M=this.modules;

    function placeFinder(row,col){
      for (let r=-1;r<=7;r++){
        if (row+r<0 || row+r>=mc) continue;
        for (let c=-1;c<=7;c++){
          if (col+c<0 || col+c>=mc) continue;
          M[row+r][col+c] =
            (0<=r && r<=6 && (c===0||c===6)) ||
            (0<=c && c<=6 && (r===0||r===6)) ||
            (2<=r && r<=4 && 2<=c && c<=4);
        }
      }
    }
    function placeTiming(){
      for (let i=0;i<mc;i++){
        if (M[6][i]===null) M[6][i] = (i%2===0);
        if (M[i][6]===null) M[i][6] = (i%2===0);
      }
    }
    function placeAlignments(type){
      const pos = QRUtil.getPatternPosition(type);
      for (let i=0;i<pos.length;i++){
        for (let j=0;j<pos.length;j++){
          const r=pos[i], c=pos[j];
          if (M[r][c]!==null) continue;
          for (let dr=-2; dr<=2; dr++){
            for (let dc=-2; dc<=2; dc++){
              M[r+dr][c+dc] = (Math.max(Math.abs(dr),Math.abs(dc)) !== 1);
            }
          }
        }
      }
    }

    placeFinder(0,0);
    placeFinder(mc-7,0);
    placeFinder(0,mc-7);
    placeTiming();
    placeAlignments(this.typeNumber);

    // Data placement
    const data = this._createData();
    let inc = -1, row = mc-1, bitIdx=7, byteIdx=0;
    for (let col=mc-1; col>0; col-=2){
      if (col===6) col--;
      while(true){
        for (let c=0;c<2;c++){
          if (M[row][col-c]===null){
            let dark=false;
            if (byteIdx < data.length) dark = ((data[byteIdx] >>> bitIdx) & 1) === 1;
            const maskDark = QRUtil.getMask(mask, row, col-c);
            M[row][col-c] = maskDark ? !dark : dark;
            bitIdx--; if (bitIdx===-1){ byteIdx++; bitIdx=7; }
          }
        }
        row += inc;
        if (row<0 || row>=mc){ row -= inc; inc = -inc; break; }
      }
    }

    // Type/Format info
    const formatData = (QRECLBits[this.eclLetter] << 3) | mask;
    const formatBits = QRUtil.getBCHTypeInfo(formatData);
    for (let i=0;i<15;i++){
      const mod = ((formatBits>>i)&1)===1;
      // vertical
      if (i<6) M[i][8] = mod;
      else if (i<8) M[i+1][8] = mod;
      else M[mc-15+i][8] = mod;
      // horizontal
      if (i<8) M[8][mc-1-i] = mod;
      else if (i<9) M[8][15-i-1+1] = mod;
      else M[8][15-i-1] = mod;
    }
    M[mc-8][8] = true;

    if (this.typeNumber >= 7){
      const bits = QRUtil.getBCHTypeNumber(this.typeNumber);
      for (let i=0;i<18;i++){
        const mod = ((bits>>i)&1)===1;
        M[Math.floor(i/3)][i%3 + mc - 8 - 3] = mod;
        M[i%3 + mc - 8 - 3][Math.floor(i/3)] = mod;
      }
    }
  };

  QRCodeModel.prototype._createData = function(){
    // Build bit buffer
    const buffer = new QRBitBuffer();
    for (let i=0;i<this.dataList.length;i++){
      const d = this.dataList[i];
      buffer.put(QRMode.BYTE, 4);
      buffer.put(d.getLength(), QRUtil.getLengthInBits(QRMode.BYTE, this.typeNumber));
      d.write(buffer);
    }

    // Terminator + padding
    const rsBlocks = QRRSBlock.getRSBlocks(this.typeNumber, this.eclLetter);
    const totalDataCount = rsBlocks.reduce((s,b)=>s+b.dataCount,0);

    if (buffer.length + 4 <= totalDataCount*8) buffer.put(0,4);
    while (buffer.length % 8 !== 0) buffer.putBit(false);
    while (buffer.length/8 < totalDataCount){
      buffer.put(0xEC,8);
      if (buffer.length/8 < totalDataCount) buffer.put(0x11,8);
    }

    // Create RS bytes
    let offset = 0, maxDC=0, maxEC=0;
    const dcdata=[], ecdata=[];
    for (let r=0; r<rsBlocks.length; r++){
      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;
      maxDC = Math.max(maxDC, dcCount); maxEC = Math.max(maxEC, ecCount);

      dcdata[r] = new Array(dcCount);
      for (let i=0;i<dcCount;i++) dcdata[r][i] = buffer.buffer[i+offset] || 0;
      offset += dcCount;

      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
      const rawPoly = new QRPolynomial(dcdata[r], 0);
      const modPoly = rawPoly.mod(rsPoly);
      const modLen = modPoly.getLength();
      ecdata[r] = new Array(ecCount);
      for (let i=0;i<ecCount;i++){
        ecdata[r][i] = i < ecCount - modLen ? 0 : modPoly.get(i - (ecCount - modLen));
      }
    }

    const totalCodeCount = rsBlocks.reduce((s,b)=>s+b.totalCount,0);
    const data = new Array(totalCodeCount);
    let idx = 0;

    for (let i=0;i<maxDC;i++){
      for (let r=0;r<rsBlocks.length;r++){
        if (i < dcdata[r].length) data[idx++] = dcdata[r][i];
      }
    }
    for (let i=0;i<maxEC;i++){
      for (let r=0;r<rsBlocks.length;r++){
        if (i < ecdata[r].length) data[idx++] = ecdata[r][i];
      }
    }
    return data;
  };

  /* ========== Type-Auswahl (Bytes, 1..10 reicht für URLs) ========== */
  const CAP_BYTES = {
    1:{L:17,M:14,Q:11,H:7}, 2:{L:32,M:26,Q:20,H:14}, 3:{L:53,M:42,Q:32,H:24},
    4:{L:78,M:62,Q:46,H:34},5:{L:106,M:84,Q:60,H:44},6:{L:134,M:106,Q:74,H:58},
    7:{L:154,M:122,Q:86,H:64},8:{L:192,M:152,Q:108,H:84},9:{L:230,M:180,Q:130,H:98},
    10:{L:271,M:213,Q:151,H:119}
  };
  function chooseType(len, ecl){
    for (let t=1;t<=10;t++){ if (CAP_BYTES[t][ecl] && len <= CAP_BYTES[t][ecl]) return t; }
    return 10; // konservativ
  }

  /* ========== Public API ========== */
  function drawTo(canvas, text, opts){
    if (!canvas || !canvas.getContext) throw new Error('SimpleQR: canvas required');
    opts = opts || {};
    const size   = Math.max(48, Math.floor(opts.size||320));
    const margin = Math.max(0, Math.floor(opts.margin||4));
    const ecl    = String(opts.ecl||'M').toUpperCase().replace(/[^LMQH]/g,'M');

    // Inhalt
    const payload = String(text||'').trim();
    const data = toUTF8Bytes(payload);
    const type = chooseType(data.length, ecl);

    // QR bauen
    const qr = new QRCodeModel(type, ecl);
    qr.addData(data);
    qr.make();

    const count = qr.getModuleCount();
    const rawSize = count + margin*2; // 1px pro Modul
    const ctx = canvas.getContext('2d');

    // 1) Roh-Matrix + Rand zeichnen (weiß)
    canvas.width  = rawSize;
    canvas.height = rawSize;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,rawSize,rawSize);

    ctx.fillStyle = '#000000';
    for (let r=0;r<count;r++){
      for (let c=0;c<count;c++){
        if (qr.isDark(r,c)) ctx.fillRect(c+margin, r+margin, 1, 1);
      }
    }

    // 2) Auf Zielgröße ohne Smoothing skalieren
    if (size !== rawSize){
      const tmp = document.createElement('canvas');
      tmp.width=rawSize; tmp.height=rawSize;
      tmp.getContext('2d').drawImage(canvas,0,0);
      canvas.width=size; canvas.height=size;
      const ctx2 = canvas.getContext('2d');
      ctx2.imageSmoothingEnabled = false;
      ctx2.drawImage(tmp,0,0,size,size);
    }
  }

  global.SimpleQR = { drawTo };

})(window);
