/*!
 * Preview Portal — shared core
 * Used by the portal (index.html) and by the Studio helper (tools/studio.html),
 * so both always compute exactly the same secret folder names.
 *
 * How the protection works:
 *   secret folder = <project-id> + "_" + first 16 hex chars of
 *                   SHA-256("preview-portal/v1|" + <project-id> + "|" + <normalized passcode>)
 * The portal never stores passcodes or a list of projects. A wrong passcode simply
 * points to a folder that does not exist.
 */
(function (global) {
  'use strict';

  var SCHEME = 'preview-portal/v1';
  var TOKEN_LENGTH = 16;
  // Unambiguous characters only (no 0/O, 1/I/L) so codes are easy to read and type.
  var CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  /* ---------- SHA-256 (pure JS, works without HTTPS and on file://) ---------- */

  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function ror(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  function sha256Hex(message) {
    var bytes = new TextEncoder().encode(String(message));
    var total = ((bytes.length + 9 + 63) >> 6) << 6;
    var buf = new Uint8Array(total);
    buf.set(bytes);
    buf[bytes.length] = 0x80;
    var bitLen = bytes.length * 8;
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen >>> 0;
    buf[total - 8] = hi >>> 24; buf[total - 7] = hi >>> 16; buf[total - 6] = hi >>> 8; buf[total - 5] = hi;
    buf[total - 4] = lo >>> 24; buf[total - 3] = lo >>> 16; buf[total - 2] = lo >>> 8; buf[total - 1] = lo;

    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var W = new Array(64);
    for (var off = 0; off < total; off += 64) {
      var i;
      for (i = 0; i < 16; i++) {
        var p = off + i * 4;
        W[i] = (buf[p] << 24) | (buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3];
      }
      for (i = 16; i < 64; i++) {
        var w15 = W[i - 15];
        var w2 = W[i - 2];
        var s0 = ror(w15, 7) ^ ror(w15, 18) ^ (w15 >>> 3);
        var s1 = ror(w2, 17) ^ ror(w2, 19) ^ (w2 >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + W[i]) | 0;
        var S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var hex = '';
    for (var j = 0; j < 8; j++) hex += ('00000000' + (H[j] >>> 0).toString(16)).slice(-8);
    return hex;
  }

  /* ---------- Project IDs and passcodes ---------- */

  var TRANSLITERATE = {
    'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'å': 'a', 'ł': 'l', 'đ': 'd', 'þ': 'th'
  };

  /** "Café Müller & Söhne" -> "cafe-mueller-soehne" */
  function slugify(input) {
    return String(input || '')
      .normalize('NFC')
      .toLowerCase()
      .replace(/[äöüßæœøåłđþ]/g, function (ch) { return TRANSLITERATE[ch]; })
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .replace(/-+$/g, '');
  }

  /** Case, spaces and dashes don't matter: "k7qm 4xtp" === "K7QM-4XTP". */
  function normalizeCode(code) {
    return String(code || '')
      .normalize('NFKC')
      .replace(/[\s\-‐-―−]+/g, '')
      .toUpperCase();
  }

  function deriveToken(projectId, code) {
    return sha256Hex(SCHEME + '|' + slugify(projectId) + '|' + normalizeCode(code)).slice(0, TOKEN_LENGTH);
  }

  /** The name the project folder must have inside /projects/ */
  function folderName(projectId, code) {
    return slugify(projectId) + '_' + deriveToken(projectId, code);
  }

  function randomIndex(max) {
    var cryptoObj = global.crypto || global.msCrypto;
    var limit = 256 - (256 % max);
    var buf = new Uint8Array(1);
    for (;;) {
      if (cryptoObj && cryptoObj.getRandomValues) cryptoObj.getRandomValues(buf);
      else buf[0] = Math.floor(Math.random() * 256);
      if (buf[0] < limit) return buf[0] % max;
    }
  }

  /** Friendly, strong passcode like "K7QM-4XTP" (≈ 40 bits of entropy). */
  function generateCode(groups, groupLength) {
    groups = groups || 2;
    groupLength = groupLength || 4;
    var parts = [];
    for (var g = 0; g < groups; g++) {
      var part = '';
      for (var i = 0; i < groupLength; i++) part += CODE_ALPHABET[randomIndex(CODE_ALPHABET.length)];
      parts.push(part);
    }
    return parts.join('-');
  }

  global.PreviewCore = {
    SCHEME: SCHEME,
    sha256Hex: sha256Hex,
    slugify: slugify,
    normalizeCode: normalizeCode,
    deriveToken: deriveToken,
    folderName: folderName,
    generateCode: generateCode
  };
})(typeof window !== 'undefined' ? window : globalThis);
