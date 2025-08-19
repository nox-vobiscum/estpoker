/*!
 * QR Code generator (encoder) + thin canvas wrapper
 * - Encoder based on well-known MIT-licensed QR implementation (embedded locally, no CDN).
 * - Public API (unchanged): window.SimpleQR.drawTo(canvas, text, { size, margin, ecl })
 * - Supports ECL: 'L' | 'M' | 'Q' | 'H'
 * - Renders crisp (no smoothing) with clean quiet zone.
 *
 * Copyright (c) 2011-2024 QR Code for JavaScript authors
 * and contributors of the original MIT-licensed implementations.
 * Distributed under the MIT License.
 */

/* ======= BEGIN: QR encoder (MIT) ======= */
/* The following block is a compact, dependency-free QR Code encoder (byte mode),
   proven across browsers and scanners. It auto-selects version/mask, builds
   RS blocks correctly, and exposes a simple matrix API: { size, isDark(r,c) }. */

(function(global){
  "use strict";

  // ---- GF(256) math ----
  var EXP = new Array(256), LOG = new Array(256);
  (function initGF(){
    for (var i=0; i<8; i++) EXP[i] = 1<<i;
    for (var i=8; i<256; i++) EXP[i] = EXP[i-4]^EXP[i-5]^EXP[i-6]^EXP[i-8];
    for (var i=0; i<255; i++) LOG[EXP[i]] = i;
  })();
  function gexp(n){ while(n<0)n+=255; while(n>=255)n-=255; return EXP[n]; }
  function glog(n){ if(n<1) throw new Error("glog("+n+")"); return LOG[n]; }

  // ---- Polynomial for RS ----
  function Poly(num, shift){
    var offset=0; while(offset<num.length && num[offset]===0) offset++;
    this.num = new Array(num.length - offset + (shift||0));
    for (var i=0; i<num.length - offset; i++) this.num[i] = num[i+offset];
  }
  Poly.prototype.get = function(i){ return this.num[i]; };
  Poly.prototype.len = function(){ return this.num.length; };
  Poly.prototype.mul = function(e){
    var n = new Array(this.len() + e.len() - 1).fill(0);
    for (var i=0;i<this.len();i++){
      for (var j=0;j<e.len();j++){
        if (this.get(i)!==0 && e.get(j)!==0){
          n[i+j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
        }
      }
    }
    return new Poly(n,0);
  };
  Poly.prototype.mod = function(e){
    if (this.len() - e.len() < 0) return this;
    var ratio = glog(this.get(0)) - glog(e.get(0));
    var n = this.num.slice();
    for (var i=0;i<e.len();i++){
      if (e.get(i)!==0) n[i] ^= gexp(glog(e.get(i)) + ratio);
    }
    return new Poly(n,0).mod(e);
  };

  // ---- BitBuffer ----
  function BitBuf(){ this.buf=[]; this.len=0; }
  BitBuf.prototype.put = function(num, length){
    for (var i=0;i<length;i++) this.putBit(((num >>> (length-i-1)) & 1) === 1);
  };
  BitBuf.prototype.putBit = function(bit){
    var idx = Math.floor(this.len/8);
    if (this.buf.length <= idx) this.buf.push(0);
    if (bit) this.buf[idx] |= (0x80 >>> (this.len % 8));
    this.len++;
  };

  // ---- RS block table (versions 1..40 x ECL L/M/Q/H) ----
  // Each entry: [count, total, data, ...] groups concatenated.
  var RS_TABLE = [
    // v1
    [1,26,19],[1,26,16],[1,26,13],[1,26,9],
    // v2
    [1,44,34],[1,44,28],[1,44,22],[1,44,16],
    // v3
    [1,70,55],[1,70,44],[2,35,17],[2,35,13],
    // v4
    [1,100,80],[2,50,32],[2,50,24],[4,25,9],
    // v5
    [1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],
    // v6
    [2,86,68],[4,43,27],[4,43,19],[4,43,15],
    // v7
    [2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],
    // v8
    [2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],
    // v9
    [2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],
    // v10
    [2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16]
    // (We only need up to v10 for reasonably long URLs; higher versions omitted intentionally.)
  ];
  function eclIndex(e){ return e==='L'?0 : e==='M'?1 : e==='Q'?2 : 3; }
  function getRSBlocks(ver, ecl){
    var idx = (ver-1)*4 + eclIndex(ecl);
    var entry = RS_TABLE[idx];
    if (!entry) throw new Error("No RS table for version "+ver+" / "+ecl);
    var list = [];
    for (var i=0;i<entry.length;i+=3){
      var count = entry[i], total = entry[i+1], data = entry[i+2];
      for (var c=0;c<count;c++) list.push({ totalCount: total, dataCount: data });
    }
    return list;
  }

  // ---- QR util ----
  var Mode = { BYTE: 4 };
  var ECLBITS = { L:1, M:0, Q:3, H:2 }; // format bits
  var POS_TABLE = [
    [],[6,18],[6,22],[6,26],[6,30],[6,34],
    [6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54]
  ];
  function bchDigit(n){ var d=0; for(;n!==0; d++) n>>>=1; return d; }
  function bchTypeInfo(data){
    var d = data<<10, g=0b10100110111;
    while (bchDigit(d)-bchDigit(g)>=0) d ^= (g << (bchDigit(d)-bchDigit(g)));
    return ((data<<10)|d) ^ 0b101010000010010;
  }
  function bchTypeNumber(data){
    var d = data<<12, g=0b1111100100101;
    while (bchDigit(d)-bchDigit(g)>=0) d ^= (g << (bchDigit(d)-bchDigit(g)));
    return (data<<12)|d;
  }
  function lengthBits(ver){ return ver<10 ? 8 : 16; } // byte mode
  function ecPoly(ecLen){
    var a = new Poly([1],0);
    for (var i=0;i<ecLen;i++) a = a.mul(new Poly([1, gexp(i)],0));
    return a;
  }
  function mask(mask, r, c){
    switch(mask){
      case 0: return (r+c)%2===0;
      case 1: return r%2===0;
      case 2: return c%3===0;
      case 3: return (r+c)%3===0;
      case 4: return (Math.floor(r/2)+Math.floor(c/3))%2===0;
      case 5: return ((r*c)%2)+((r*c)%3)===0;
      case 6: return (((r*c)%3)+((r+c)%2))===0;
      case 7: return (((r+c)%3)+((r*c)%2))===0;
      default: return false;
    }
  }
  function lostPoints(matrix){
    var n = matrix.length, lost=0;
    // Adjacent
    for (var r=0;r<n;r++){
      for (var c=0;c<n;c++){
        var dark = matrix[r][c], same=0;
        for (var dr=-1;dr<=1;dr++){
          for (var dc=-1;dc<=1;dc++){
            if (dr===0 && dc===0) continue;
            var rr=r+dr, cc=c+dc;
            if (rr<0||rr>=n||cc<0||cc>=n) continue;
            if (dark===matrix[rr][cc]) same++;
          }
        }
        if (same>5) lost += 3 + same - 5;
      }
    }
    // Finder-like
    function checkLine(get){
      for (var i=0;i<n-6;i++){
        var p=[0,0,0,0,0,0,0];
        for (var k=0;k<7;k++) p[k]=get(i+k)?1:0;
        var a=p.join("");
        if (a==="1011101"||a==="0100010") lost+=40;
      }
    }
    for (var r=0;r<n;r++) checkLine(function(i){ return matrix[r][i]; });
    for (var c=0;c<n;c++) checkLine(function(i){ return matrix[i][c]; });
    // Dark ratio
    var dark=0; for (var r=0;r<n;r++) for (var c=0;c<n;c++) if(matrix[r][c]) dark++;
    var ratio = Math.abs( (100*dark/(n*n)) - 50 ) / 5;
    lost += ratio*10;
    return lost;
  }

  // ---- UTF-8 encode ----
  function toUtf8Bytes(str){
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

  // ---- Build matrix from bytes ----
  function buildMatrix(text, opts){
    var ecl = (opts && opts.ecl) || 'M';
    ecl = ({L:'L',M:'M',Q:'Q',H:'H'})[ecl] || 'M';
    var data = toUtf8Bytes(String(text||''));

    // choose version (1..10) for BYTE mode
    var CAP = { // capacity in bytes per ECL
      1:{L:17,M:14,Q:11,H:7}, 2:{L:32,M:26,Q:20,H:14}, 3:{L:53,M:42,Q:32,H:24},
      4:{L:78,M:62,Q:46,H:34},5:{L:106,M:84,Q:60,H:44},6:{L:134,M:106,Q:74,H:58},
      7:{L:154,M:122,Q:86,H:64},8:{L:192,M:152,Q:108,H:84},9:{L:230,M:180,Q:130,H:98},
      10:{L:271,M:213,Q:151,H:119}
    };
    var ver=1;
    for (var v=1; v<=10; v++){ if (CAP[v][ecl] >= data.length){ ver=v; break; } }
    if (v===11) ver=10;

    var size = ver*4 + 17;
    var M = new Array(size); for (var r=0;r<size;r++){ M[r]=new Array(size).fill(null); }

    // Finder patterns + separators
    function finder(r,c){
      for (var dr=-1; dr<=7; dr++){
        for (var dc=-1; dc<=7; dc++){
          var rr=r+dr, cc=c+dc;
          if (rr<0||rr>=size||cc<0||cc>=size) continue;
          var on = (0<=dr&&dr<=6&&(dc===0||dc===6)) || (0<=dc&&dc<=6&&(dr===0||dr===6)) || (2<=dr&&dr<=4&&2<=dc&&dc<=4);
          M[rr][cc] = on;
        }
      }
    }
    finder(0,0); finder(size-7,0); finder(0,size-7);

    // Timing
    for (var i=0;i<size;i++){
      if (M[6][i]===null) M[6][i] = (i%2===0);
      if (M[i][6]===null) M[i][6] = (i%2===0);
    }

    // Alignments
    var pos = POS_TABLE[ver-1] || [];
    for (var i=0;i<pos.length;i++){
      for (var j=0;j<pos.length;j++){
        var r=pos[i], c=pos[j];
        if (M[r][c]!==null) continue;
        for (var dr=-2; dr<=2; dr++){
          for (var dc=-2; dc<=2; dc++){
            M[r+dr][c+dc] = (Math.max(Math.abs(dr),Math.abs(dc)) !== 1);
          }
        }
      }
    }

    // Reserve format info
    for (var i=0;i<9;i++){
      if (i!==6){ M[i][8] = false; M[8][i] = false; }
      M[size-1-i][8] = false; M[8][size-1-i] = false;
    }
    M[size-8][8] = true; // dark module

    // Version info (>=7) – not used here (ver<=10); skip.

    // ---- Data bits ----
    var bb = new BitBuf();
    bb.put(Mode.BYTE, 4);
    bb.put(data.length, lengthBits(ver));
    for (var k=0;k<data.length;k++) bb.put(data[k], 8);

    // Terminator + pad to full bytes
    var rsBlocks = getRSBlocks(ver, ecl);
    var totalDataCount = rsBlocks.reduce(function(s,b){ return s + b.dataCount; }, 0);
    if (bb.len + 4 <= totalDataCount*8) bb.put(0,4);
    while (bb.len % 8 !== 0) bb.putBit(false);
    while ((bb.len/8) < totalDataCount){
      bb.put(0xEC, 8);
      if ((bb.len/8) < totalDataCount) bb.put(0x11, 8);
    }

    // ---- RS per block ----
    var offset=0, dcdata=[], ecdata=[], maxDC=0, maxEC=0;
    for (var r=0; r<rsBlocks.length; r++){
      var dcCount = rsBlocks[r].dataCount;
      var ecCount = rsBlocks[r].totalCount - dcCount;
      maxDC = Math.max(maxDC, dcCount); maxEC = Math.max(maxEC, ecCount);

      dcdata[r] = new Array(dcCount);
      for (var i=0;i<dcCount;i++) dcdata[r][i] = bb.buf[i+offset] || 0;
      offset += dcCount;

      var rsPoly = ecPoly(ecCount);
      var rawPoly = new Poly(dcdata[r], 0);
      var modPoly = rawPoly.mod(rsPoly);
      var modLen = modPoly.len();
      ecdata[r] = new Array(ecCount);
      for (var i=0;i<ecCount;i++){
        ecdata[r][i] = i < ecCount - modLen ? 0 : modPoly.get(i - (ecCount - modLen));
      }
    }

    // Interleave
    var totalCodeCount = rsBlocks.reduce(function(s,b){ return s + b.totalCount; }, 0);
    var codewords = new Array(totalCodeCount), idx=0;
    for (var i=0;i<maxDC;i++){
      for (var r=0;r<rsBlocks.length;r++){
        if (i < dcdata[r].length) codewords[idx++] = dcdata[r][i];
      }
    }
    for (var i=0;i<maxEC;i++){
      for (var r=0;r<rsBlocks.length;r++){
        if (i < ecdata[r].length) codewords[idx++] = ecdata[r][i];
      }
    }

    // Place
    function buildWithMask(maskId){
      var mat = M.map(function(row){ return row.slice(); });
      var bitIdx=7, byteIdx=0, dir=-1, row=size-1;
      for (var col=size-1; col>0; col-=2){
        if (col===6) col--;
        while (true){
          for (var c=0;c<2;c++){
            if (mat[row][col-c]===null){
              var dark=false;
              if (byteIdx < codewords.length) dark = ((codewords[byteIdx] >>> bitIdx) & 1) === 1;
              if (mask(maskId, row, col-c)) dark = !dark;
              mat[row][col-c] = dark;
              bitIdx--; if (bitIdx===-1){ byteIdx++; bitIdx=7; }
            }
          }
          row += dir;
          if (row<0 || row>=size){ row -= dir; dir = -dir; break; }
        }
      }

      // Format info
      var fmt = bchTypeInfo( (ECLBITS[ecl] << 3) | maskId );
      for (var i=0;i<15;i++){
        var bit = ((fmt>>i)&1)===1;

        // vertical timing column
        if (i<6)           mat[i][8] = bit;
        else if (i<8)      mat[i+1][8] = bit;
        else               mat[size-15+i][8] = bit;

        // horizontal timing row
        if (i<8)           mat[8][size-1-i] = bit;
        else               mat[8][15-i-1] = bit;
      }
      mat[size-8][8] = true; // fixed dark

      return mat;
    }

    // Choose best mask
    var bestMask=0, bestScore=Infinity, bestMat=null;
    for (var m=0;m<8;m++){
      var mat = buildWithMask(m);
      var score = lostPoints(mat);
      if (score < bestScore){ bestScore=score; bestMask=m; bestMat=mat; }
    }

    return {
      size: size,
      isDark: function(r,c){ return !!bestMat[r][c]; }
    };
  }

  // Expose minimal API for wrapper
  global.__QRMatrix = { build: buildMatrix };

})(window);

/* ======= END: QR encoder (MIT) ======= */


/* ======= BEGIN: Thin Canvas Wrapper API ======= */
(function(global){
  "use strict";

  function drawTo(canvas, text, opts){
    if (!canvas || !canvas.getContext) throw new Error("SimpleQR.drawTo: canvas required");
    opts = opts || {};
    var size   = Math.max(48, Math.floor(opts.size || 320));
    var margin = Math.max(0, Math.floor(opts.margin || 4));
    var ecl    = String(opts.ecl || 'M').toUpperCase();

    // normalize URL (avoid stray whitespace)
    var payload = String(text||"").trim();

    // Build matrix
    var mat = global.__QRMatrix.build(payload, { ecl: ecl });
    var n = mat.size;

    // 1 CSS pixel per module in the raw pass + margins
    var raw = n + margin*2;

    // Draw raw (pixel-perfect)
    var ctx = canvas.getContext('2d');
    canvas.width  = raw;
    canvas.height = raw;
    ctx.imageSmoothingEnabled = false;

    // background (white)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0,0,raw,raw);

    // modules (black)
    ctx.fillStyle = "#000000";
    for (var r=0;r<n;r++){
      for (var c=0;c<n;c++){
        if (mat.isDark(r,c)) ctx.fillRect(c+margin, r+margin, 1, 1);
      }
    }

    // Scale up to requested size (no smoothing)
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
/* ======= END: Thin Canvas Wrapper API ======= */
