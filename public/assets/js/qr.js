/*!
 * Tiny QR code generator (byte mode) that renders crisp SVG.
 * Follows the structure of Project Nayuki's "QR Code generator" (MIT License).
 * Usage: PreviewQR.svg('https://example.com', { ecl: 'M', margin: 2 })
 */
(function (global) {
  'use strict';

  // [table index, format bits]
  var ECL = { L: [0, 1], M: [1, 0], Q: [2, 3], H: [3, 2] };

  var ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];

  var NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];

  function getBit(x, i) {
    return ((x >>> i) & 1) !== 0;
  }

  function getNumRawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  function getNumDataCodewords(ver, ecl) {
    return Math.floor(getNumRawDataModules(ver) / 8) -
      ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
  }

  /* ---------- Reed–Solomon over GF(2^8 / 0x11D) ---------- */

  function rsMultiply(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsComputeDivisor(degree) {
    var result = [];
    for (var i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (var k = 0; k < degree; k++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = rsMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = rsMultiply(root, 0x02);
    }
    return result;
  }

  function rsComputeRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) {
        result[i] ^= rsMultiply(coef, factor);
      });
    });
    return result;
  }

  /* ---------- Symbol construction ---------- */

  function QrSymbol(ver, eclIdx, eclFormat, dataCodewords, mask) {
    var size = ver * 4 + 17;
    var modules = [];
    var isFunction = [];
    for (var r = 0; r < size; r++) {
      modules.push(new Array(size).fill(false));
      isFunction.push(new Array(size).fill(false));
    }

    function setFunctionModule(x, y, dark) {
      modules[y][x] = dark;
      isFunction[y][x] = true;
    }

    function alignmentPositions() {
      if (ver === 1) return [];
      var numAlign = Math.floor(ver / 7) + 2;
      var step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
      var result = [6];
      for (var pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
      return result;
    }

    function drawFinder(x, y) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy));
          var xx = x + dx;
          var yy = y + dy;
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }

    function drawAlignment(x, y) {
      for (var dy = -2; dy <= 2; dy++) {
        for (var dx = -2; dx <= 2; dx++) setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }

    function drawFormatBits(m) {
      var data = (eclFormat << 3) | m;
      var rem = data;
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412;
      for (i = 0; i <= 5; i++) setFunctionModule(8, i, getBit(bits, i));
      setFunctionModule(8, 7, getBit(bits, 6));
      setFunctionModule(8, 8, getBit(bits, 7));
      setFunctionModule(7, 8, getBit(bits, 8));
      for (i = 9; i < 15; i++) setFunctionModule(14 - i, 8, getBit(bits, i));
      for (i = 0; i < 8; i++) setFunctionModule(size - 1 - i, 8, getBit(bits, i));
      for (i = 8; i < 15; i++) setFunctionModule(8, size - 15 + i, getBit(bits, i));
      setFunctionModule(8, size - 8, true);
    }

    function drawVersion() {
      if (ver < 7) return;
      var rem = ver;
      for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var bits = (ver << 12) | rem;
      for (i = 0; i < 18; i++) {
        var dark = getBit(bits, i);
        var a = size - 11 + (i % 3);
        var b = Math.floor(i / 3);
        setFunctionModule(a, b, dark);
        setFunctionModule(b, a, dark);
      }
    }

    function drawFunctionPatterns() {
      for (var i = 0; i < size; i++) {
        setFunctionModule(6, i, i % 2 === 0);
        setFunctionModule(i, 6, i % 2 === 0);
      }
      drawFinder(3, 3);
      drawFinder(size - 4, 3);
      drawFinder(3, size - 4);
      var pos = alignmentPositions();
      var n = pos.length;
      for (i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
          if (!((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))) drawAlignment(pos[i], pos[j]);
        }
      }
      drawFormatBits(0);
      drawVersion();
    }

    function addEccAndInterleave(data) {
      var numBlocks = NUM_ERROR_CORRECTION_BLOCKS[eclIdx][ver];
      var blockEccLen = ECC_CODEWORDS_PER_BLOCK[eclIdx][ver];
      var rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
      var numShortBlocks = numBlocks - (rawCodewords % numBlocks);
      var shortBlockLen = Math.floor(rawCodewords / numBlocks);
      var divisor = rsComputeDivisor(blockEccLen);
      var blocks = [];
      for (var i = 0, k = 0; i < numBlocks; i++) {
        var dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
        k += dat.length;
        var ecc = rsComputeRemainder(dat, divisor);
        if (i < numShortBlocks) dat.push(0);
        blocks.push(dat.concat(ecc));
      }
      var result = [];
      for (i = 0; i < blocks[0].length; i++) {
        for (var j = 0; j < blocks.length; j++) {
          if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(blocks[j][i]);
        }
      }
      return result;
    }

    function drawCodewords(data) {
      var i = 0;
      for (var right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (var vert = 0; vert < size; vert++) {
          for (var j = 0; j < 2; j++) {
            var x = right - j;
            var upward = ((right + 1) & 2) === 0;
            var y = upward ? size - 1 - vert : vert;
            if (!isFunction[y][x] && i < data.length * 8) {
              modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
              i++;
            }
          }
        }
      }
    }

    function applyMask(m) {
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          if (isFunction[y][x]) continue;
          var invert;
          switch (m) {
            case 0: invert = (x + y) % 2 === 0; break;
            case 1: invert = y % 2 === 0; break;
            case 2: invert = x % 3 === 0; break;
            case 3: invert = (x + y) % 3 === 0; break;
            case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
            case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
            case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
            default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          }
          if (invert) modules[y][x] = !modules[y][x];
        }
      }
    }

    function addHistory(run, history) {
      if (history[0] === 0) run += size;
      history.pop();
      history.unshift(run);
    }

    function countFinderLike(history) {
      var n = history[1];
      var core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
      return (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) +
        (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0);
    }

    function terminateAndCount(runColor, run, history) {
      if (runColor) {
        addHistory(run, history);
        run = 0;
      }
      run += size;
      addHistory(run, history);
      return countFinderLike(history);
    }

    function penalty() {
      var result = 0;
      var x, y, runColor, run, history;
      for (y = 0; y < size; y++) {
        runColor = false; run = 0; history = [0, 0, 0, 0, 0, 0, 0];
        for (x = 0; x < size; x++) {
          if (modules[y][x] === runColor) {
            run++;
            if (run === 5) result += 3;
            else if (run > 5) result++;
          } else {
            addHistory(run, history);
            if (!runColor) result += countFinderLike(history) * 40;
            runColor = modules[y][x];
            run = 1;
          }
        }
        result += terminateAndCount(runColor, run, history) * 40;
      }
      for (x = 0; x < size; x++) {
        runColor = false; run = 0; history = [0, 0, 0, 0, 0, 0, 0];
        for (y = 0; y < size; y++) {
          if (modules[y][x] === runColor) {
            run++;
            if (run === 5) result += 3;
            else if (run > 5) result++;
          } else {
            addHistory(run, history);
            if (!runColor) result += countFinderLike(history) * 40;
            runColor = modules[y][x];
            run = 1;
          }
        }
        result += terminateAndCount(runColor, run, history) * 40;
      }
      for (y = 0; y < size - 1; y++) {
        for (x = 0; x < size - 1; x++) {
          var c = modules[y][x];
          if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += 3;
        }
      }
      var dark = 0;
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (modules[y][x]) dark++;
      var total = size * size;
      result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return result;
    }

    drawFunctionPatterns();
    drawCodewords(addEccAndInterleave(dataCodewords));

    if (mask < 0) {
      var best = Infinity;
      for (var m = 0; m < 8; m++) {
        applyMask(m);
        drawFormatBits(m);
        var score = penalty();
        if (score < best) {
          best = score;
          mask = m;
        }
        applyMask(m);
      }
    }
    applyMask(mask);
    drawFormatBits(mask);

    this.version = ver;
    this.size = size;
    this.mask = mask;
    this.modules = modules;
  }

  /* ---------- Public API ---------- */

  function encode(text, options) {
    options = options || {};
    var eclName = (options.ecl || 'M').toUpperCase();
    var ecl = ECL[eclName] || ECL.M;
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(String(text)));
    var minVer = options.minVersion || 1;
    var maxVer = options.maxVersion || 40;
    var ver, capacityBits, usedBits;
    for (ver = minVer; ; ver++) {
      capacityBits = getNumDataCodewords(ver, ecl[0]) * 8;
      usedBits = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
      if (usedBits <= capacityBits) break;
      if (ver >= maxVer) throw new RangeError('QR: data too long');
    }
    // Use a stronger error correction level if it fits in the same version.
    if (options.boostEcl !== false) {
      ['M', 'Q', 'H'].forEach(function (name) {
        if (ECL[name][0] > ecl[0] && usedBits <= getNumDataCodewords(ver, ECL[name][0]) * 8) ecl = ECL[name];
      });
    }

    var bits = [];
    function append(val, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    }
    append(0x4, 4);
    append(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { append(b, 8); });
    capacityBits = getNumDataCodewords(ver, ecl[0]) * 8;
    append(0, Math.min(4, capacityBits - bits.length));
    append(0, (8 - (bits.length % 8)) % 8);
    for (var pad = 0xEC; bits.length < capacityBits; pad ^= 0xEC ^ 0x11) append(pad, 8);

    var codewords = new Array(bits.length / 8).fill(0);
    bits.forEach(function (bit, i) {
      codewords[i >>> 3] |= bit << (7 - (i & 7));
    });

    var mask = typeof options.mask === 'number' ? options.mask : -1;
    return new QrSymbol(ver, ecl[0], ecl[1], codewords, mask);
  }

  function svg(text, options) {
    options = options || {};
    var qr = encode(text, options);
    var margin = options.margin == null ? 2 : options.margin;
    var dim = qr.size + margin * 2;
    var d = '';
    for (var y = 0; y < qr.size; y++) {
      var x = 0;
      while (x < qr.size) {
        if (!qr.modules[y][x]) { x++; continue; }
        var start = x;
        while (x < qr.size && qr.modules[y][x]) x++;
        d += 'M' + (start + margin) + ' ' + (y + margin) + 'h' + (x - start) + 'v1h-' + (x - start) + 'z';
      }
    }
    var fg = options.color || '#0b0b12';
    var bg = options.background || 'transparent';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges"' +
      (options.title ? ' role="img" aria-label="' + String(options.title).replace(/"/g, '&quot;') + '"' : ' aria-hidden="true"') + '>' +
      (bg !== 'transparent' ? '<rect width="100%" height="100%" fill="' + bg + '"/>' : '') +
      '<path d="' + d + '" fill="' + fg + '"/></svg>';
  }

  global.PreviewQR = { encode: encode, svg: svg };
})(typeof window !== 'undefined' ? window : globalThis);
