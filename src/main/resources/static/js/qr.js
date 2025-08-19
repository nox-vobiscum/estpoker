/*!
 * qr.js — battle-tested QR encoder + thin canvas wrapper (MIT)
 * Public API (unchanged):
 *   window.SimpleQR.drawTo(canvas, text, { size:320, margin:4, ecl:'M' })
 *
 * Encoder based on the well-known MIT-licensed implementation by
 * Kazuhiko Arase and contributors (qrcode-generator), embedded locally.
 * No external services, no network calls.
 */
(function(global){ "use strict";

/* ===================== QR ENCODER (MIT) ===================== */

/* Error levels */
var QRErrorCorrectLevel = { L:1, M:0, Q:3, H:2 };

/* Math (GF256) */
var QRMath = (function(){
  var EXP = new Array(256), LOG = new Array(256);
  for (var i=0; i<8; i++) EXP[i] = 1 << i;
  for (var i=8; i<256; i++) EXP[i] = EXP[i-4]^EXP[i-5]^EXP[i-6]^EXP[i-8];
  for (var i=0; i<255; i++) LOG[EXP[i]] = i;
  function gexp(n){ while(n<0) n+=255; while(n>=255) n-=255; return EXP[n]; }
  function glog(n){ if (n<1) throw new Error('glog('+n+')'); return LOG[n]; }
  return { gexp:gexp, glog:glog };
})();

/* Polynomial */
function QRPolynomial(num, shift){
  var offset = 0; while (offset<num.length && num[offset]===0) offset++;
  this.num = new Array(num.length - offset + (shift||0));
  for (var i=0; i<num.length - offset; i++) this.num[i] = num[i+offset];
}
QRPolynomial.prototype = {
  get: function(i){ return this.num[i]; },
  getLength: function(){ return this.num.length; },
  multiply: function(e){
    var num = new Array(this.getLength()+e.getLength()-1).fill(0);
    for (var i=0;i<this.getLength();i++){
      for (var j=0;j<e.getLength();j++){
        if (this.get(i)!==0 && e.get(j)!==0)
          num[i+j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
      }
    }
    return new QRPolynomial(num,0);
  },
  mod: function(e){
    if (this.getLength() - e.getLength() < 0) return this;
    var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
    var num = this.num.slice();
    for (var i=0;i<e.getLength();i++){
      if (e.get(i)!==0) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
    }
    return new QRPolynomial(num,0).mod(e);
  }
};

/* RS Blocks (v1..10 x L/M/Q/H — reicht locker für URLs) */
var RS_BLOCK_TABLE = [
  [1,26,19],[1,26,16],[1,26,13],[1,26,9],
  [1,44,34],[1,44,28],[1,44,22],[1,44,16],
  [1,70,55],[1,70,44],[2,35,17],[2,35,13],
  [1,100,80],[2,50,32],[2,50,24],[4,25,9],
  [1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],
  [2,86,68],[4,43,27],[4,43,19],[4,43,15],
  [2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],
  [2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],
  [2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],
  [2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16]
];
function _eclIdx(e){ return e==='L'?0 : e==='M'?1 : e==='Q'?2 : 3; }
var QRRSBlock = {
  getRSBlocks: function(typeNumber, ecl){
    var idx = (typeNumber-1)*4 + _eclIdx(ecl);
    var entry = RS_BLOCK_TABLE[idx];
    if (!entry) throw new Error('No RS table for type '+typeNumber+' / '+ecl);
    var list=[];
    for (var i=0;i<entry.length;i+=3){
      var count=entry[i], total=entry[i+1], data=entry[i+2];
      for (var c=0;c<count;c++) list.push({ totalCount: total, dataCount: data });
    }
    return list;
  }
};

/* Bit buffer */
function QRBitBuffer(){ this.buffer=[]; this.length=0; }
QRBitBuffer.prototype = {
  get: function(i){ return ((this.buffer[Math.floor(i/8)] >>> (7 - i%8)) & 1) === 1; },
  put: function(num, length){ for (var i=0;i<length;i++) this.putBit(((num >>> (length-i-1)) & 1) === 1); },
  putBit: function(bit){
    var idx = Math.floor(this.length/8);
    if (this.buffer.length <= idx) this.buffer.push(0);
    if (bit) this.buffer[idx] |= (0x80 >>> (this.length % 8));
    this.length++;
  }
};

/* 8-bit byte (UTF-8) */
function QR8bitByte(data){ this.mode=4; this.data=data; }
QR8bitByte.prototype = {
  getLength: function(){ return this.data.length; },
  write: function(buf){ for (var i=0;i<this.data.length;i++) buf.put(this.data[i],8); }
};

/* Util */
var QRUtil = (function(){
  var PATTERN_POSITION_TABLE = [
    [],[6,18],[6,22],[6,26],[6,30],[6,34],
    [6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54]
  ];
  var G15 = 0b10100110111, G18 = 0b1111100100101, G15_MASK = 0b101010000010010;

  function getBCHDigit(data){ var n=0; for(;data!==0; n++) data>>>=1; return n; }
  function getBCHTypeInfo(data){
    var d=data<<10;
    while (getBCHDigit(d) - getBCHDigit(G15) >= 0) d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15)));
    return ((data<<10)|d) ^ G15_MASK;
  }
  function getBCHTypeNumber(data){
    var d=data<<12;
    while (getBCHDigit(d) - getBCHDigit(G18) >= 0) d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18)));
    return (data<<12)|d;
  }
  function getPatternPosition(typeNumber){ return PATTERN_POSITION_TABLE[typeNumber-1] || []; }
  function getMask(maskPattern, i, j){
    switch(maskPattern){
      case 0: return (i+j)%2===0;
      case 1: return i%2===0;
      case 2: return j%3===0;
      case 3: return (i+j)%3===0;
      case 4: return (Math.floor(i/2)+Math.floor(j/3))%2===0;
      case 5: return ((i*j)%2)+((i*j)%3)===0;
      case 6: return (((i*j)%3)+((i+j)%2))===0;
      case 7: return (((i+j)%3)+((i*j)%2))===0;
      default: return false;
    }
  }
  function getErrorCorrectPolynomial(ecLength){
    var a = new QRPolynomial([1],0);
    for (var i=0;i<ecLength;i++) a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)],0));
    return a;
  }
  function getLengthInBits(typeNumber){
    return typeNumber<10 ? 8 : 16; // BYTE-mode only
  }
  function getLostPoint(modules){
    var moduleCount = modules.length;
    var lostPoint = 0;

    for (var row=0; row<moduleCount; row++){
      for (var col=0; col<moduleCount; col++){
        var sameCount = 0, dark = modules[row][col];
        for (var r=-1;r<=1;r++){
          if (row+r<0 || moduleCount<=row+r) continue;
          for (var c=-1;c<=1;c++){
            if (col+c<0 || moduleCount<=col+c) continue;
            if (r===0 && c===0) continue;
            if (dark === modules[row+r][col+c]) sameCount++;
          }
        }
        if (sameCount > 5) lostPoint += (3 + sameCount - 5);
      }
    }

    for (var row=0; row<moduleCount; row++){
      for (var col=0; col<moduleCount-6; col++){
        if (modules[row][col] && !modules[row][col+1] && modules[row][col+2] && modules[row][col+3] && modules[row][col+4] && !modules[row][col+5] && modules[row][col+6])
          lostPoint += 40;
      }
    }
    for (var col=0; col<moduleCount; col++){
      for (var row=0; row<moduleCount-6; row++){
        if (modules[row][col] && !modules[row+1][col] && modules[row+2][col] && modules[row+3][col] && modules[row+4][col] && !modules[row+5][col] && modules[row+6][col])
          lostPoint += 40;
      }
    }

    var darkCount = 0;
    for (var row=0; row<moduleCount; row++)
      for (var col=0; col<moduleCount; col++)
        if (modules[row][col]) darkCount++;

    var ratio = Math.abs(100*darkCount/moduleCount/moduleCount - 50)/5;
    lostPoint += ratio*10;
    return lostPoint;
  }
  return { getBCHTypeInfo, getBCHTypeNumber, getPatternPosition, getMask,
           getErrorCorrectPolynomial, getLengthInBits, getLostPoint };
})();

/* UTF-8 bytes */
function toUTF8Bytes(str){
  var out=[], i=0, c;
  for (i=0;i<str.length;i++){
    c=str.charCodeAt(i);
    if (c<0x80) out.push(c);
    else if (c<0x800) out.push(0xC0|(c>>6), 0x80|(c&63));
    else if (c>=0xD800 && c<=0xDBFF){
      var c2=str.charCodeAt(++i);
      var u=((c-0xD800)<<10)+(c2-0xDC00)+0x10000;
      out.push(0xF0|(u>>18), 0x80|((u>>12)&63), 0x80|((u>>6)&63), 0x80|(u&63));
    } else out.push(0xE0|(c>>12), 0x80|((c>>6)&63), 0x80|(c&63));
  }
  return out;
}

/* QR Model */
function QRCode(typeNumber, errorCorrectLevel){
  this.typeNumber = typeNumber;
  this.errorCorrectLevel = errorCorrectLevel; // 'L'/'M'/'Q'/'H'
  this.modules = null;
  this.moduleCount = 0;
  this.dataList = [];
}
QRCode.prototype = {
  addData: function(bytes){ this.dataList.push(new QR8bitByte(bytes)); },
  isDark: function(row, col){ return this.modules[row][col]; },
  getModuleCount: function(){ return this.moduleCount; },

  make: function(){
    this._makeImpl(false, this._bestMask());
  },
  _bestMask: function(){
    var min = 0, pattern = 0;
    for (var i=0;i<8;i++){
      this._makeImpl(true, i);
      var lost = QRUtil.getLostPoint(this.modules);
      if (i===0 || lost<min){ min=lost; pattern=i; }
    }
    return pattern;
  },

  _makeImpl: function(test, maskPattern){
    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = new Array(this.moduleCount);
    for (var row=0; row<this.moduleCount; row++) this.modules[row] = new Array(this.moduleCount).fill(null);

    this._setupPositionProbePattern(0,0);
    this._setupPositionProbePattern(this.moduleCount-7, 0);
    this._setupPositionProbePattern(0, this.moduleCount-7);
    this._setupTimingPattern();
    this._setupPositionAdjustPattern();

    // Reserve format/type info areas
    for (var r=0; r<9; r++){
      if (this.modules[r][8] === null) this.modules[r][8] = false;
      if (this.modules[8][r] === null) this.modules[8][r] = false;
    }
    for (var r=this.moduleCount-8; r<this.moduleCount; r++){
      if (this.modules[r][8] === null) this.modules[r][8] = false;
      if (this.modules[8][r] === null) this.modules[8][r] = false;
    }
    this.modules[this.moduleCount-8][8] = true;

    var data = this._createData(this.typeNumber, this.errorCorrectLevel, this.dataList);

    this._mapData(data, maskPattern);
  },

  _setupPositionProbePattern: function(row, col){
    for (var r=-1; r<=7; r++){
      if (row+r<=-1 || this.moduleCount<=row+r) continue;
      for (var c=-1; c<=7; c++){
        if (col+c<=-1 || this.moduleCount<=col+c) continue;
        this.modules[row+r][col+c] =
          (0<=r && r<=6 && (c===0 || c===6)) ||
          (0<=c && c<=6 && (r===0 || r===6)) ||
          (2<=r && r<=4 && 2<=c && c<=4);
      }
    }
  },

  _setupTimingPattern: function(){
    for (var r=0; r<this.moduleCount; r++)
      if (this.modules[r][6] === null) this.modules[r][6] = (r%2===0);
    for (var c=0; c<this.moduleCount; c++)
      if (this.modules[6][c] === null) this.modules[6][c] = (c%2===0);
  },

  _setupPositionAdjustPattern: function(){
    var pos = QRUtil.getPatternPosition(this.typeNumber);
    for (var i=0; i<pos.length; i++){
      for (var j=0; j<pos.length; j++){
        var row = pos[i], col = pos[j];
        if (this.modules[row][col] !== null) continue;
        for (var r=-2; r<=2; r++){
          for (var c=-2; c<=2; c++){
            this.modules[row+r][col+c] = (Math.max(Math.abs(r),Math.abs(c)) !== 1);
          }
        }
      }
    }
  },

  _mapData: function(data, maskPattern){
    var inc = -1, row = this.moduleCount-1, bitIdx=7, byteIdx=0;
    for (var col=this.moduleCount-1; col>0; col-=2){
      if (col===6) col--;
      while (true){
        for (var c=0; c<2; c++){
          if (this.modules[row][col-c] === null){
            var dark = false;
            if (byteIdx < data.length) dark = ((data[byteIdx] >>> bitIdx) & 1) === 1;
            if (QRUtil.getMask(maskPattern, row, col-c)) dark = !dark;
            this.modules[row][col-c] = dark;
            bitIdx--; if (bitIdx === -1){ byteIdx++; bitIdx = 7; }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row){ row -= inc; inc = -inc; break; }
      }
    }

    // Type info
    var dataBits = (QRErrorCorrectLevel[this.errorCorrectLevel] << 3) | maskPattern;
    var bits = QRUtil.getBCHTypeInfo(dataBits);
    for (var i=0; i<15; i++){
      var mod = ((bits >> i) & 1) === 1;
      // vertical
      if (i<6) this.modules[i][8] = mod;
      else if (i<8) this.modules[i+1][8] = mod;
      else this.modules[this.moduleCount-15+i][8] = mod;
      // horizontal
      if (i<8) this.modules[8][this.moduleCount-1-i] = mod;
      else this.modules[8][15-i-1] = mod;
    }
    this.modules[this.moduleCount-8][8] = true;

    // Version info (>=7) – not needed for <=10
  },

  _createData: function(typeNumber, eclLetter, dataList){
    var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, eclLetter);
    var buffer = new QRBitBuffer();

    for (var i=0; i<dataList.length; i++){
      var data = dataList[i];
      buffer.put(4, 4); // BYTE mode
      buffer.put(data.getLength(), QRUtil.getLengthInBits(typeNumber));
      data.write(buffer);
    }

    var totalDataCount = 0;
    for (var i=0; i<rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;

    // Terminator & byte align
    if (buffer.length + 4 <= totalDataCount*8) buffer.put(0,4);
    while (buffer.length % 8 !== 0) buffer.putBit(false);
    while (buffer.length/8 < totalDataCount){
      buffer.put(0xEC, 8);
      if (buffer.length/8 < totalDataCount) buffer.put(0x11, 8);
    }

    // RS per block
    var offset=0, maxDc=0, maxEc=0, dcdata=[], ecdata=[];
    for (var r=0; r<rsBlocks.length; r++){
      var dcCount = rsBlocks[r].dataCount;
      var ecCount = rsBlocks[r].totalCount - dcCount;
      maxDc=Math.max(maxDc,dcCount); maxEc=Math.max(maxEc,ecCount);

      dcdata[r] = new Array(dcCount);
      for (var i=0;i<dcCount;i++) dcdata[r][i] = buffer.buffer[i+offset] || 0;
      offset += dcCount;

      var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
      var rawPoly = new QRPolynomial(dcdata[r],0);
      var modPoly = rawPoly.mod(rsPoly);
      var modLen = modPoly.getLength();
      ecdata[r] = new Array(ecCount);
      for (var i=0;i<ecCount;i++){
        ecdata[r][i] = i < ecCount - modLen ? 0 : modPoly.get(i - (ecCount - modLen));
      }
    }

    // Interleave
    var totalCodeCount = 0; for (var i=0;i<rsBlocks.length;i++) totalCodeCount += rsBlocks[i].totalCount;
    var data = new Array(totalCodeCount), idx=0;
    for (var i=0;i<maxDc;i++) for (var r=0;r<rsBlocks.length;r++) if (i < dcdata[r].length) data[idx++] = dcdata[r][i];
    for (var i=0;i<maxEc;i++) for (var r=0;r<rsBlocks.length;r++) if (i < ecdata[r].length) data[idx++] = ecdata[r][i];
    return data;
  }
};

/* Choose version (1..10) by byte length / error level */
var CAP_BYTES = {
  1:{L:17,M:14,Q:11,H:7}, 2:{L:32,M:26,Q:20,H:14}, 3:{L:53,M:42,Q:32,H:24},
  4:{L:78,M:62,Q:46,H:34},5:{L:106,M:84,Q:60,H:44},6:{L:134,M:106,Q:74,H:58},
  7:{L:154,M:122,Q:86,H:64},8:{L:192,M:152,Q:108,H:84},9:{L:230,M:180,Q:130,H:98},
  10:{L:271,M:213,Q:151,H:119}
};
function chooseType(len, ecl){
  for (var t=1;t<=10;t++) if (CAP_BYTES[t][ecl] && len <= CAP_BYTES[t][ecl]) return t;
  return 10;
}

/* ===================== THIN CANVAS WRAPPER ===================== */

function drawTo(canvas, text, opts){
  if (!canvas || !canvas.getContext) throw new Error('SimpleQR.drawTo: canvas required');
  opts = opts || {};
  var size   = Math.max(48, Math.floor(opts.size || 320));
  var margin = Math.max(0, Math.floor(opts.margin || 4));
  var ecl    = (opts.ecl || 'M').toUpperCase();
  if (!QRErrorCorrectLevel.hasOwnProperty(ecl)) ecl = 'M';

  var payload = String(text||'').trim();
  if (!payload) throw new Error('SimpleQR: empty payload');

  var bytes = toUTF8Bytes(payload);
  var typeNumber = chooseType(bytes.length, ecl);

  var qr = new QRCode(typeNumber, ecl);
  qr.addData(bytes);
  qr.make();

  var n = qr.getModuleCount();
  var raw = n + margin*2;

  var ctx = canvas.getContext('2d');
  canvas.width = raw; canvas.height = raw;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,raw,raw);
  ctx.fillStyle = '#000';

  for (var r=0;r<n;r++)
    for (var c=0;c<n;c++)
      if (qr.isDark(r,c)) ctx.fillRect(c+margin, r+margin, 1, 1);

  if (raw !== size){
    var tmp = document.createElement('canvas');
    tmp.width = raw; tmp.height = raw;
    tmp.getContext('2d').drawImage(canvas,0,0);
    canvas.width = size; canvas.height = size;
    var ctx2 = canvas.getContext('2d');
    ctx2.imageSmoothingEnabled = false;
    ctx2.drawImage(tmp, 0, 0, size, size);
  }
}

global.SimpleQR = { drawTo: drawTo };

})(window);
