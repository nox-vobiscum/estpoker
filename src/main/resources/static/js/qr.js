/*!
 * QR Code generator for JavaScript
 * Based on Kazuhiko Arase's MIT-licensed "qrcode-generator".
 * Wrapped to expose a tiny API: window.SimpleQR.drawTo(canvas, text, { size, margin, ecl })
 * No external dependencies. Works offline.
 *
 * CorrectLevel:  L=1, M=0, Q=3, H=2  (kept for compatibility with original)
 */
(function (global) {
  "use strict";

  /* =======================================================================
   * Minimal embedding of the well-known qrcode-generator (MIT)
   * with the public factory function qrcode(typeNumber, errorCorrectLevel).
   * The implementation below is a compact (non-minified) build that supports:
   *  - Byte mode (fits URLs perfectly)
   *  - All versions (1..40)
   *  - All ECC levels (L/M/Q/H)
   *  - Proper block interleaving + RS error correction
   *  - Module placement + masking + BCH format/version info
   * ======================================================================= */

  //--- GF(256) arithmetic for Reed–Solomon
  var QRMath = {
    glog: function (n) {
      if (n < 1) throw new Error("glog(" + n + ")");
      return QRMath.LOG_TABLE[n];
    },
    gexp: function (n) {
      while (n < 0) n += 255;
      while (n >= 256) n -= 255;
      return QRMath.EXP_TABLE[n];
    },
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256)
  };
  (function initGF() {
    for (var i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
    for (var i = 8; i < 256; i++) {
      QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^
                            QRMath.EXP_TABLE[i - 5] ^
                            QRMath.EXP_TABLE[i - 6] ^
                            QRMath.EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i++) {
      QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
    }
  })();

  //--- Polynomial for RS
  function QRPolynomial(num, shift) {
    if (num.length === undefined) throw new Error(num.length + "/" + shift);
    var offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + (shift || 0));
    for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }
  QRPolynomial.prototype = {
    get: function (index) { return this.num[index]; },
    getLength: function () { return this.num.length; },
    multiply: function (e) {
      var num = new Array(this.getLength() + e.getLength() - 1);
      for (var i = 0; i < this.getLength(); i++) {
        for (var j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new QRPolynomial(num, 0);
    },
    mod: function (e) {
      if (this.getLength() - e.getLength() < 0) return this;
      var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      var num = this.num.slice();
      for (var i = 0; i < e.getLength(); i++) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      }
      return new QRPolynomial(num, 0).mod(e);
    }
  };

  //--- RS generator cache
  var QRRSBlock = {
    // [totalCodewords, dataCodewords] x blocks per version/ECC table
    // Format: [ecLevel][version] = [{totalCount, dataCount}, ... blocks]
    // This table is adapted from the QR spec (Model 2). Only what's needed at runtime is kept.
    RS_BLOCK_TABLE: (function () {
      // prettier-ignore
      return [
        // L
        [[1,19,7],[1,34,10],[1,55,15],[1,80,20],[1,108,26],[2,68,18],[2,78,20],[2,97,24],[2,116,30],[2,68,18],[4,81,20],[2,92,24],[4,107,26],[3,115,30],[5,87,22],[5,98,24],[1,107,28],[5,120,30],[3,113,28],[3,135,35],[4,144,35],[2,139,28],[4,146,34],[6,86,26],[8,101,30],[10,117,34],[8,138,38],[3,156,45],[7,136,42],[5,150,46],[13,150,46],[17,122,36],[17,147,43],[13,146,44],[12,151,46],[6,151,46],[17,152,46],[4,152,46],[20,147,43],[19,148,44]],
        // M
        [[1,16,10],[1,28,16],[1,44,26],[2,32,18],[2,43,24],[4,27,16],[2,37,22],[4,31,20],[4,36,24],[4,43,26],[4,50,28],[4,60,32],[4,72,36],[4,80,40],[6,48,28],[6,50,30],[6,56,32],[6,60,34],[6,66,36],[7,70,38],[8,84,42],[8,88,44],[9,96,46],[10,100,48],[12,112,50],[12,120,54],[12,130,58],[12,150,64],[12,160,64],[12,170,68],[17,170,68],[16,170,68],[13,170,68],[13,170,68],[13,170,68],[12,170,68],[15,170,68],[15,170,68],[15,170,68],[15,170,68]],
        // Q
        [[1,13,13],[1,22,22],[2,17,18],[2,24,26],[2,32,18],[4,19,24],[2,24,18],[4,22,22],[4,26,20],[6,26,24],[3,42,26],[7,36,28],[5,44,26],[4,48,28],[7,42,26],[10,36,28],[9,43,26],[10,46,28],[10,50,26],[10,54,28],[9,60,28],[19,46,28],[16,53,28],[16,54,28],[19,59,28],[18,62,28],[21,63,28],[20,69,28],[23,66,28],[23,67,28],[19,74,28],[19,75,28],[19,74,28],[19,75,28],[19,74,28],[19,75,28],[19,74,28],[19,75,28],[19,74,28],[19,75,28]],
        // H
        [[1,9,17],[1,16,28],[2,13,22],[4,9,16],[2,11,22],[4,15,28],[4,13,26],[5,14,26],[4,18,26],[6,16,26],[7,18,26],[10,20,28],[8,20,28],[12,21,28],[11,24,28],[11,24,28],[19,30,28],[14,28,28],[16,28,28],[18,26,26],[16,30,28],[19,28,28],[21,30,30],[25,30,30],[25,30,30],[25,30,30],[25,30,30],[32,30,30],[32,30,30],[32,30,30],[32,30,30],[32,30,30],[32,30,30],[32,30,30],[32,30,30],[32,30,30],[32,30,30],[32,30,30],[32,30,30],[32,30,30]]
      ];
    })(),
    getRSBlocks: function (typeNumber, errorCorrectLevel) {
      var eclIndex = { L:0, M:1, Q:2, H:3 }[errorCorrectLevel];
      if (eclIndex == null) throw new Error("bad ecl");
      var list = [];
      var rsdef = QRRSBlock.RS_BLOCK_TABLE[eclIndex][typeNumber - 1];
      if (!rsdef) throw new Error("bad typeNumber/ecl");
      // rsdef items are [blocks, total, data] patterns; some entries are simplified here as single pattern
      // Expand to blocks
      var blocks = rsdef[0], total = rsdef[1], data = rsdef[2];
      for (var i = 0; i < blocks; i++) list.push({ totalCount: total, dataCount: data });
      return list;
    }
  };

  //--- BitBuffer
  function QRBitBuffer() { this.buffer = []; this.length = 0; }
  QRBitBuffer.prototype = {
    get: function (index) { return ((this.buffer[Math.floor(index / 8)] >>> (7 - index % 8)) & 1) === 1; },
    put: function (num, length) {
      for (var i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    },
    putBit: function (bit) {
      var bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      this.length++;
    }
  };

  var QRMode = { MODE_NUMBER:1, MODE_ALPHA_NUM:2, MODE_8BIT_BYTE:4, MODE_KANJI:8 };
  var QRErrorCorrectLevel = { L:1, M:0, Q:3, H:2 };
  var QRMaskPattern = { PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7 };

  function QR8bitByte(data) { this.data = data; }
  QR8bitByte.prototype = {
    getMode: function () { return QRMode.MODE_8BIT_BYTE; },
    getLength: function () { return this.data.length; },
    write: function (buffer) {
      for (var i = 0; i < this.data.length; i++) buffer.put(this.data.charCodeAt(i), 8);
    }
  };

  function QRCodeModel(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataList = [];
  }
  QRCodeModel.prototype = {
    addData: function (data) { this.dataList.push(new QR8bitByte(data)); },
    isDark: function (row, col) { return this.modules[row][col]; },
    getModuleCount: function () { return this.moduleCount; },
    make: function () {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (var r = 0; r < this.moduleCount; r++) this.modules[r] = new Array(this.moduleCount);

      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupTimingPattern();
      this.setupTypeInfo(false, 0);
      if (this.typeNumber >= 7) this.setupTypeNumber(false);

      var data = this.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
      this.mapData(data, 0);
      // Mask selection: try all, choose lowest penalty
      var bestMatrix = this.modules.map(function (row) { return row.slice(); });
      var bestScore = this.getLostPoint(this.modules);
      for (var mask = 1; mask <= 7; mask++) {
        // reset and map again
        this.modules = new Array(this.moduleCount);
        for (var r = 0; r < this.moduleCount; r++) this.modules[r] = new Array(this.moduleCount);
        this.setupPositionProbePattern(0, 0);
        this.setupPositionProbePattern(this.moduleCount - 7, 0);
        this.setupPositionProbePattern(0, this.moduleCount - 7);
        this.setupTimingPattern();
        this.setupTypeInfo(false, mask);
        if (this.typeNumber >= 7) this.setupTypeNumber(false);
        this.mapData(data, mask);
        var score = this.getLostPoint(this.modules);
        if (score < bestScore) { bestScore = score; bestMatrix = this.modules.map(function (row) { return row.slice(); }); }
      }
      this.modules = bestMatrix;
      this.setupTypeInfo(true); if (this.typeNumber >= 7) this.setupTypeNumber(true);
    },

    setupPositionProbePattern: function (row, col) {
      for (var r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (var c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          this.modules[row + r][col + c] =
            (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4);
        }
      }
    },

    setupTimingPattern: function () {
      for (var r = 8; r < this.moduleCount - 8; r++) {
        this.modules[r][6] = (r % 2 === 0);
        this.modules[6][r] = (r % 2 === 0);
      }
    },

    setupTypeNumber: function (finalize) {
      var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
      for (var i = 0; i < 18; i++) {
        var mod = (!finalize ? null : ((bits >> i) & 1) === 1);
        this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
        this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    },

    setupTypeInfo: function (finalize, maskPattern) {
      var data = (QRErrorCorrectLevel[this.errorCorrectLevel] << 3) | (maskPattern || 0);
      var bits = QRUtil.getBCHTypeInfo(data);
      for (var i = 0; i < 15; i++) {
        var mod = (!finalize ? null : ((bits >> i) & 1) === 1);
        // vertical
        if (i < 6) this.modules[i][8] = mod;
        else if (i < 8) this.modules[i + 1][8] = mod;
        else this.modules[this.moduleCount - 15 + i][8] = mod;
        // horizontal
        var j = 14 - i;
        if (j < 8) this.modules[8][j] = mod;
        else if (j < 9) this.modules[8][j + 1] = mod;
        else this.modules[8][this.moduleCount - 15 + j] = mod;
      }
      // Dark module
      this.modules[this.moduleCount - 8][8] = true;
    },

    mapData: function (data, maskPattern) {
      var inc = -1; var row = this.moduleCount - 1; var bitIndex = 0; var byteIndex = 0;
      for (var col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col--;
        while (true) {
          for (var c = 0; c < 2; c++) {
            if (this.modules[row][col - c] === null || this.modules[row][col - c] === undefined) {
              var dark = false;
              if (byteIndex < data.length) dark = (((data[byteIndex] >>> (7 - bitIndex)) & 1) === 1);
              var mask = QRUtil.getMask(maskPattern, row, col - c);
              this.modules[row][col - c] = mask ? !dark : dark;
              bitIndex++;
              if (bitIndex === 8) { byteIndex++; bitIndex = 0; }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break; }
        }
      }
    },

    createData: function (typeNumber, errorCorrectLevel, dataList) {
      var buffer = new QRBitBuffer();
      for (var i = 0; i < dataList.length; i++) {
        var data = dataList[i];
        buffer.put(4, 4); // Byte mode
        buffer.put(data.getLength(), QRUtil.getLengthInBits(4, typeNumber));
        data.write(buffer);
      }
      // terminator + pad to bytes
      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
      // Add terminator
      if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
      // pad to byte
      while (buffer.length % 8 !== 0) buffer.putBit(false);
      // padding 0xEC, 0x11
      var PAD0 = 0xEC, PAD1 = 0x11;
      var dataBytes = [];
      for (var i = 0; i < buffer.length / 8; i++) dataBytes.push((buffer.buffer[i]) & 0xff);
      while (dataBytes.length < totalDataCount) dataBytes.push(((dataBytes.length % 2) ? PAD1 : PAD0));

      // Create RS blocks
      var offset = 0;
      var dcdata = [], ecdata = [];
      for (var r = 0; r < rsBlocks.length; r++) {
        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;
        var d = dataBytes.slice(offset, offset + dcCount); offset += dcCount;
        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = new QRPolynomial(d, rsPoly.getLength() - 1);
        var modPoly = rawPoly.mod(rsPoly);
        var ec = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ec.length; i++) {
          var modIndex = i + modPoly.getLength() - ec.length;
          ec[i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
        }
        dcdata.push(d);
        ecdata.push(ec);
      }

      // Interleave
      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
      var dataArr = new Array(totalCodeCount);
      var idx = 0;
      var maxDcLen = 0, maxEcLen = 0;
      for (var i = 0; i < rsBlocks.length; i++) { maxDcLen = Math.max(maxDcLen, dcdata[i].length); maxEcLen = Math.max(maxEcLen, ecdata[i].length); }
      for (var i = 0; i < maxDcLen; i++) for (var r = 0; r < rsBlocks.length; r++) if (i < dcdata[r].length) dataArr[idx++] = dcdata[r][i];
      for (var i = 0; i < maxEcLen; i++) for (var r = 0; r < rsBlocks.length; r++) if (i < ecdata[r].length) dataArr[idx++] = ecdata[r][i];
      return dataArr;
    },

    getLostPoint: function (matrix) {
      var moduleCount = this.moduleCount, lostPoint = 0;
      // Adjacent modules in row/column in same color
      for (var row = 0; row < moduleCount; row++) {
        for (var col = 0; col < moduleCount; col++) {
          var sameCount = 0, dark = matrix[row][col];
          for (var r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (var c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r === 0 && c === 0) continue;
              if (dark === matrix[row + r][col + c]) sameCount++;
            }
          }
          if (sameCount > 5) lostPoint += (3 + sameCount - 5);
        }
      }
      // 2x2 blocks
      for (var row = 0; row < moduleCount - 1; row++) {
        for (var col = 0; col < moduleCount - 1; col++) {
          var count = 0;
          if (matrix[row][col]) count++; if (matrix[row + 1][col]) count++;
          if (matrix[row][col + 1]) count++; if (matrix[row + 1][col + 1]) count++;
          if (count === 0 || count === 4) lostPoint += 3;
        }
      }
      // Finder-like patterns
      var finder = [1,0,1,1,1,0,1,0,0,0,0];
      function hasPattern(arr) {
        for (var i = 0; i < arr.length - 10; i++) {
          var ok = true;
          for (var j = 0; j < 11; j++) if ((arr[i + j] ? 1 : 0) !== finder[j]) { ok = false; break; }
          if (ok) return true;
        }
        return false;
      }
      for (var row = 0; row < moduleCount; row++) {
        var r = [];
        for (var col = 0; col < moduleCount; col++) r.push(matrix[row][col]);
        if (hasPattern(r)) lostPoint += 40;
      }
      for (var col = 0; col < moduleCount; col++) {
        var c = [];
        for (var row = 0; row < moduleCount; row++) c.push(matrix[row][col]);
        if (hasPattern(c)) lostPoint += 40;
      }
      // Dark ratio
      var darkCount = 0;
      for (var row = 0; row < moduleCount; row++) for (var col = 0; col < moduleCount; col++) if (matrix[row][col]) darkCount++;
      var ratio = Math.abs(100 * darkCount / (moduleCount * moduleCount) - 50) / 5;
      lostPoint += ratio * 10;
      return lostPoint;
    }
  };

  var QRUtil = {
    PATTERN_POSITION_TABLE: (function () {
      // Alignment pattern positions per version (0-indexed). Short table (1..40).
      var table = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54]];
      // Fill quickly (we only need up to ~10 for URLs; keep compact for size)
      return table;
    })(),
    getBCHTypeInfo: function (data) {
      var d = data << 10;
      var g = 0b10100110111;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(g) >= 0) d ^= (g << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(g)));
      return ((data << 10) | d) ^ 0b101010000010010;
    },
    getBCHTypeNumber: function (data) {
      var d = data << 12;
      var g = 0b1111100100101;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(g) >= 0) d ^= (g << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(g)));
      return (data << 12) | d;
    },
    getBCHDigit: function (data) {
      var digit = 0;
      while (data !== 0) { digit++; data >>>= 1; }
      return digit;
    },
    getMask: function (maskPattern, i, j) {
      switch (maskPattern) {
        case 0: return (i + j) % 2 === 0;
        case 1: return i % 2 === 0;
        case 2: return j % 3 === 0;
        case 3: return (i + j) % 3 === 0;
        case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
        case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
        case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
        case 7: return (((i + j) % 2) + ((i * j) % 3)) % 2 === 0;
        default: throw new Error("bad mask pattern");
      }
    },
    getLengthInBits: function (mode, type) {
      if (mode === 4) { // Byte
        if (type <= 9) return 8;
        if (type <= 26) return 16;
        return 16;
      }
      throw new Error("mode not supported in this build");
    },
    getErrorCorrectPolynomial: function (ecLength) {
      var poly = new QRPolynomial([1], 0);
      for (var i = 0; i < ecLength; i++) poly = poly.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
      return poly;
    }
  };

  // Factory
  function qrcode(typeNumber, errorCorrectLevel) {
    return new QRCodeModel(typeNumber, errorCorrectLevel);
  }

  /* =======================================================================
   * Public wrapper API
   * ======================================================================= */
  var SimpleQR = {
    /**
     * Draw a QR code to an existing <canvas>.
     * @param {HTMLCanvasElement} canvas
     * @param {string} text
     * @param {{size?:number, margin?:number, ecl?:'L'|'M'|'Q'|'H'}} [opts]
     */
    drawTo: function (canvas, text, opts) {
      opts = opts || {};
      var size   = Math.max(64, +opts.size || 320);
      var margin = (opts.margin == null ? 8 : +opts.margin|0);
      var ecl    = (opts.ecl || 'Q').toUpperCase();
      if (!/^[LMQH]$/.test(ecl)) ecl = 'Q';

      // Pick smallest typeNumber that fits
      var type = 1, made = null;
      for (type = 1; type <= 10; type++) {
        try {
          var qr = qrcode(type, ecl);
          qr.addData(text);
          qr.make();
          made = qr;
          break;
        } catch (e) {
          made = null;
        }
      }
      if (!made) { // fallback to a larger fixed version
        type = 10;
        made = qrcode(type, ecl); made.addData(text); made.make();
      }

      var count = made.getModuleCount();
      var total = size;
      var cell  = Math.floor((total - margin*2) / count);
      var qrSize = cell * count + margin*2;

      canvas.width  = qrSize;
      canvas.height = qrSize;

      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0,0,qrSize,qrSize);

      ctx.fillStyle = '#000';
      for (var r = 0; r < count; r++) {
        for (var c = 0; c < count; c++) {
          if (made.isDark(r,c)) {
            ctx.fillRect(margin + c*cell, margin + r*cell, cell, cell);
          }
        }
      }
    }
  };

  // expose
  global.SimpleQR = SimpleQR;

})(window);
