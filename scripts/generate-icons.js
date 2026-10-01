import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b, isMaskable = false) {
  // A simple PNG generator using standard Buffer and zlib
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw pixel data: each scanline starts with filter type 0
  const rowLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowLength);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * (isMaskable ? 0.35 : 0.42);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Database cylinder / app icon graphic
      let pr = 15;
      let pg = 23;
      let pb = 42; // Dark slate background #0f172a
      let pa = 255;

      if (dist < radius) {
        // Inner badge: Indigo / Purple gradient with database lines
        const factor = (y / height);
        pr = Math.floor(79 + factor * 50);
        pg = Math.floor(70 + factor * 20);
        pb = Math.floor(229 - factor * 30);

        // Cylinder stripes
        const relY = (y - cy) / radius;
        if (Math.abs(relY) < 0.6 && Math.abs(dx) < radius * 0.65) {
          if (Math.abs(relY - 0.25) < 0.05 || Math.abs(relY + 0.25) < 0.05 || Math.abs(relY) < 0.05) {
            pr = 255; pg = 255; pb = 255; // White rings
          }
        }
      }

      rawData[pxOffset] = pr;
      rawData[pxOffset + 1] = pg;
      rawData[pxOffset + 2] = pb;
      rawData[pxOffset + 3] = pa;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);

  const crc = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([len, body, crcBuf]);
}

// CRC-32 implementation
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

fs.writeFileSync('public/pwa-192x192.png', createPNG(192, 192, 79, 70, 229, false));
fs.writeFileSync('public/pwa-512x512.png', createPNG(512, 512, 79, 70, 229, false));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPNG(512, 512, 79, 70, 229, true));
fs.writeFileSync('public/apple-touch-icon.png', createPNG(180, 180, 79, 70, 229, false));
fs.writeFileSync('public/favicon.ico', createPNG(32, 32, 79, 70, 229, false));

// SVG icon
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="gawGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="#0f172a"/>
  <rect x="32" y="32" width="448" height="448" rx="88" fill="url(#gawGrad)"/>
  <!-- Database Stack & Plug Icon -->
  <g fill="none" stroke="#ffffff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">
    <!-- Top cylinder -->
    <ellipse cx="256" cy="140" rx="140" ry="46" fill="#4338ca"/>
    <ellipse cx="256" cy="140" rx="140" ry="46"/>
    <!-- Middle cylinder -->
    <path d="M116 140v90c0 25.4 62.7 46 140 46s140-20.6 140-46v-90" />
    <!-- Bottom cylinder -->
    <path d="M116 230v90c0 25.4 62.7 46 140 46s140-20.6 140-46v-90" />
    <path d="M116 320v50c0 25.4 62.7 46 140 46s140-20.6 140-46v-50" />
  </g>
  <!-- GAW Monogram -->
  <text x="256" y="275" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="4">GAW</text>
</svg>`;
fs.writeFileSync('public/icon.svg', svg);
console.log('Icons generated successfully!');
