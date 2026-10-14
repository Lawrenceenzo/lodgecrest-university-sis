const zlib = require('zlib');

// Makes a small, valid PNG that looks like a receipt (header band, grey text lines, the amount in big digits),
// with no image library. Used only by the seed, so the demo has proofs of payment to look at.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(4 + body.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 4 + body.length);
  return out;
};

// 5x7 glyphs for the amount ("3,000.00")
const GLYPHS = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
};

function receiptPng(amountText, accent = [15, 32, 75]) {
  const W = 320;
  const H = 440;
  const px = new Uint8Array(W * H * 3).fill(255);
  const rect = (x, y, w, h, [r, g, b]) => {
    for (let j = y; j < y + h && j < H; j += 1) for (let i = x; i < x + w && i < W; i += 1) px.set([r, g, b], (j * W + i) * 3);
  };
  rect(0, 0, W, 56, accent); // header band
  rect(24, 20, 120, 16, [255, 255, 255]);
  for (let i = 0; i < 4; i += 1) rect(24, 84 + i * 22, 150 + ((i * 53) % 90), 9, [208, 212, 222]); // "text" lines
  // the amount, drawn 6 pixels per glyph pixel
  const scale = 6;
  let x = 24;
  for (const ch of amountText) {
    const g = GLYPHS[ch];
    if (!g) {
      x += 3 * scale;
      continue;
    }
    g.forEach((row, ry) => [...row].forEach((bit, rx) => bit === '1' && rect(x + rx * scale, 196 + ry * scale, scale, scale, accent)));
    x += (ch === '.' || ch === ',' ? 4 : 6) * scale;
  }
  for (let i = 0; i < 5; i += 1) rect(24, 280 + i * 22, 120 + ((i * 71) % 150), 9, [225, 228, 236]);
  rect(24, 400, 272, 3, accent);

  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y += 1) {
    raw[y * (W * 3 + 1)] = 0; // no filter
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(W, 0);
  header.writeUInt32BE(H, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

module.exports = { receiptPng };
