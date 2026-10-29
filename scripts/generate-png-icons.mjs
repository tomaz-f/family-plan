import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');
const ICONS_DIR = path.resolve(PUBLIC_DIR, 'icons');

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// CRC32 implementation
function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crcBuf = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcVal = crc32(crcBuf);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

function createPng(width, height, drawFn) {
  // 1 byte filter per line + width * 4 (RGBA)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData, { level: 9 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Non-interlaced

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Distance to rounded rectangle
function distToRoundRect(px, py, rx, ry, rw, rh, rad) {
  const cx = Math.max(rx + rad, Math.min(px, rx + rw - rad));
  const cy = Math.max(ry + rad, Math.min(py, ry + rh - rad));
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist - rad;
}

// Distance to line segment
function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return Math.hypot(px - projX, py - projY);
}

// Draw FamilyPlan Icon with Pure OLED Black Background (#000000)
function drawFamilyPlanIcon(x, y, w, h) {
  // Normalized coords [0, 1]
  const nx = x / w;
  const ny = y / h;

  // Background: Pure Black #000000
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 255;

  // Inner card (Graphite cockpit plate)
  const cardPad = 0.12;
  const cardRad = 0.16;
  const dCard = distToRoundRect(nx, ny, cardPad, cardPad, 1 - 2 * cardPad, 1 - 2 * cardPad, cardRad);

  if (dCard <= 0) {
    // Card background: #111215
    r = 17;
    g = 18;
    b = 21;

    // Card border: #282a32 (width ~0.015)
    if (dCard >= -0.018) {
      r = 40;
      g = 42;
      b = 50;
    }
  }

  // Baseline: Silver line from (0.28, 0.74) to (0.72, 0.74)
  const dBase = distToSegment(nx, ny, 0.28, 0.74, 0.72, 0.74);
  if (dBase < 0.022) {
    r = 120;
    g = 125;
    b = 138;
  }

  // Cyan circle node at (0.35, 0.35), radius 0.065
  const dNode = Math.hypot(nx - 0.35, ny - 0.35);
  if (dNode < 0.065) {
    r = 56;
    g = 189;
    b = 248; // #38bdf8
  }

  // Emerald Trending Arrow Path:
  // (0.28, 0.62) -> (0.42, 0.48) -> (0.54, 0.58) -> (0.74, 0.34)
  const s1 = distToSegment(nx, ny, 0.28, 0.62, 0.42, 0.48);
  const s2 = distToSegment(nx, ny, 0.42, 0.48, 0.54, 0.58);
  const s3 = distToSegment(nx, ny, 0.54, 0.58, 0.74, 0.34);
  // Arrow head top: (0.61, 0.34) -> (0.74, 0.34)
  const sHead1 = distToSegment(nx, ny, 0.61, 0.34, 0.74, 0.34);
  // Arrow head down: (0.74, 0.34) -> (0.74, 0.47)
  const sHead2 = distToSegment(nx, ny, 0.74, 0.34, 0.74, 0.47);

  const minPath = Math.min(s1, s2, s3, sHead1, sHead2);
  if (minPath < 0.035) {
    r = 16;
    g = 185;
    b = 129; // #10b981 Emerald
  }

  return [r, g, b, a];
}

console.log('Generating PWA Icons...');

// 1. icon-192x192.png
const png192 = createPng(192, 192, drawFamilyPlanIcon);
fs.writeFileSync(path.join(ICONS_DIR, 'icon-192x192.png'), png192);
console.log('✓ Created public/icons/icon-192x192.png (', png192.length, 'bytes)');

// 2. icon-512x512.png
const png512 = createPng(512, 512, drawFamilyPlanIcon);
fs.writeFileSync(path.join(ICONS_DIR, 'icon-512x512.png'), png512);
console.log('✓ Created public/icons/icon-512x512.png (', png512.length, 'bytes)');

// 3. apple-touch-icon.png (180x180)
const appleIcon = createPng(180, 180, drawFamilyPlanIcon);
fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), appleIcon);
console.log('✓ Created public/apple-touch-icon.png (', appleIcon.length, 'bytes)');

// 4. favicon-32x32.png
const fav32 = createPng(32, 32, drawFamilyPlanIcon);
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), fav32); // Modern browsers handle 32x32 PNG inside .ico or as ico fallback
console.log('✓ Created public/favicon.ico (', fav32.length, 'bytes)');

// 5. masked-icon.svg (monochrome safe SVG for Safari pinned tabs)
const maskedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <path d="M128 320L208 240L272 296L384 168" stroke="#000000" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M312 168H384V240" stroke="#000000" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="176" cy="176" r="36" fill="#000000"/>
  <path d="M128 384H384" stroke="#000000" stroke-width="28" stroke-linecap="round"/>
</svg>`;
fs.writeFileSync(path.join(PUBLIC_DIR, 'masked-icon.svg'), maskedSvg);
console.log('✓ Created public/masked-icon.svg');

// 6. Update public/icon.svg with pure OLED black #000000 background
const oledSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="112" fill="#000000"/>
  <rect x="32" y="32" width="448" height="448" rx="88" fill="#111215" stroke="#22242a" stroke-width="6"/>
  <path d="M128 320L208 240L272 296L384 168" stroke="#10b981" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M312 168H384V240" stroke="#10b981" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="176" cy="176" r="36" fill="#38bdf8"/>
  <path d="M128 384H384" stroke="#94a3b8" stroke-width="24" stroke-linecap="round"/>
</svg>`;
fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.svg'), oledSvg);
console.log('✓ Updated public/icon.svg with OLED pure black background');
