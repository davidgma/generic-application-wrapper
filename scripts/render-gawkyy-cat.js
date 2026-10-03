import fs from 'fs';
import zlib from 'zlib';

// 1. Generate clean vector SVG
export const gawkyyCatSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%">
  <defs>
    <!-- Filter for subtle drop shadow if needed -->
  </defs>

  <!-- Left Outer Ear -->
  <path d="M 64 102 L 46 44 C 44 38 48 34 54 36 L 108 76 Z" 
        fill="#F4B366" stroke="#1F1B18" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
  <!-- Left Inner Ear Pink -->
  <path d="M 66 94 L 54 52 C 53 49 56 47 59 49 L 98 76 Z" 
        fill="#ED7486"/>

  <!-- Right Outer Ear -->
  <path d="M 192 102 L 210 44 C 212 38 208 34 202 36 L 148 76 Z" 
        fill="#F4B366" stroke="#1F1B18" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
  <!-- Right Inner Ear Pink -->
  <path d="M 190 94 L 202 52 C 203 49 200 47 197 49 L 158 76 Z" 
        fill="#ED7486"/>

  <!-- Main Head Shape -->
  <ellipse cx="128" cy="144" rx="90" ry="78" 
           fill="#F4B366" stroke="#1F1B18" stroke-width="7"/>

  <!-- Forehead Tabby Stripes -->
  <!-- Middle vertical stripe -->
  <path d="M 124 72 L 132 72 L 129 104 L 127 104 Z" fill="#4B3C33"/>
  <!-- Left angled stripe -->
  <path d="M 103 76 L 110 74 L 115 100 L 111 101 Z" fill="#4B3C33"/>
  <!-- Right angled stripe -->
  <path d="M 153 76 L 146 74 L 141 100 L 145 101 Z" fill="#4B3C33"/>

  <!-- Cheek Tabby Stripes (Left) -->
  <path d="M 40 128 L 62 133 L 42 138 Z" fill="#4B3C33"/>
  <path d="M 43 147 L 66 149 L 46 156 Z" fill="#4B3C33"/>

  <!-- Cheek Tabby Stripes (Right) -->
  <path d="M 216 128 L 194 133 L 214 138 Z" fill="#4B3C33"/>
  <path d="M 213 147 L 190 149 L 210 156 Z" fill="#4B3C33"/>

  <!-- Whiskers (Left) -->
  <path d="M 64 146 Q 36 145 14 148" fill="none" stroke="#1F1B18" stroke-width="5" stroke-linecap="round"/>
  <path d="M 66 158 Q 40 165 22 174" fill="none" stroke="#1F1B18" stroke-width="5" stroke-linecap="round"/>

  <!-- Whiskers (Right) -->
  <path d="M 192 146 Q 220 145 242 148" fill="none" stroke="#1F1B18" stroke-width="5" stroke-linecap="round"/>
  <path d="M 190 158 Q 216 165 234 174" fill="none" stroke="#1F1B18" stroke-width="5" stroke-linecap="round"/>

  <!-- Soft Cream Muzzle Patch -->
  <path d="M 88 170 C 88 142 110 138 128 138 C 146 138 168 142 168 170 C 168 194 146 208 128 208 C 110 208 88 194 88 170 Z" 
        fill="#F9E4CA"/>

  <!-- Big Adorable Eyes -->
  <!-- Left Eye -->
  <circle cx="92" cy="142" r="20" fill="#181516"/>
  <circle cx="98" cy="136" r="7.5" fill="#FFFFFF"/>
  <circle cx="85" cy="149" r="3.5" fill="#FFFFFF"/>

  <!-- Right Eye -->
  <circle cx="164" cy="142" r="20" fill="#181516"/>
  <circle cx="170" cy="136" r="7.5" fill="#FFFFFF"/>
  <circle cx="157" cy="149" r="3.5" fill="#FFFFFF"/>

  <!-- Cute Black Nose -->
  <path d="M 120 156 C 120 154 122 153 128 153 C 134 153 136 154 136 156 L 131 164 C 129 166 127 166 125 164 Z" 
        fill="#181516"/>

  <!-- Smiling Cat Mouth -->
  <path d="M 128 165 L 128 169 M 128 169 Q 120 178 111 172 Q 104 167 106 162" 
        fill="none" stroke="#181516" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 128 169 Q 136 178 145 172 Q 152 167 150 162" 
        fill="none" stroke="#181516" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Helper: Point in Triangle
function ptInTriangle(p, a, b, c) {
  const v0 = [c[0] - a[0], c[1] - a[1]];
  const v1 = [b[0] - a[0], b[1] - a[1]];
  const v2 = [p[0] - a[0], p[1] - a[1]];

  const dot00 = v0[0] * v0[0] + v0[1] * v0[1];
  const dot01 = v0[0] * v1[0] + v0[1] * v1[1];
  const dot02 = v0[0] * v2[0] + v0[1] * v2[1];
  const dot11 = v1[0] * v1[0] + v1[1] * v1[1];
  const dot12 = v1[0] * v2[0] + v1[1] * v2[1];

  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

  return (u >= 0) && (v >= 0) && (u + v <= 1);
}

// Helper: Distance from point to line segment
function distToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// 2. High-precision 4x Super-Sampled Rasterizer for pristine PNG icons
export function renderGawkyyCatPNG(size) {
  const rowLength = 1 + size * 4;
  const rawData = Buffer.alloc(size * rowLength);

  // 4 sub-pixel samples per pixel (2x2 grid) for anti-aliasing
  const subOffsets = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75]
  ];

  // Palette RGBA
  const cOutline = [31, 27, 24, 255];
  const cFur = [244, 179, 102, 255];
  const cInnerEar = [237, 116, 134, 255];
  const cStripes = [75, 60, 51, 255];
  const cMuzzle = [249, 228, 202, 255];
  const cEye = [24, 21, 22, 255];
  const cWhite = [255, 255, 255, 255];

  // Ear geometry in 256x256 coords
  const lEarOuter = [[64, 102], [46, 42], [108, 76]];
  const lEarInner = [[66, 94], [54, 52], [98, 76]];
  const rEarOuter = [[192, 102], [210, 42], [148, 76]];
  const rEarInner = [[190, 94], [202, 52], [158, 76]];

  // Forehead stripes
  const midStripe = [[124, 72], [132, 72], [128, 105]];
  const leftStripe = [[103, 76], [111, 74], [113, 101]];
  const rightStripe = [[153, 76], [145, 74], [143, 101]];

  // Cheek stripes
  const lCheek1 = [[38, 126], [63, 133], [40, 139]];
  const lCheek2 = [[41, 145], [67, 149], [44, 157]];
  const rCheek1 = [[218, 126], [193, 133], [216, 139]];
  const rCheek2 = [[215, 145], [189, 149], [212, 157]];

  // Nose
  const noseTri = [[120, 154], [136, 154], [128, 166]];

  // Whiskers segments: [[x1, y1], [x2, y2]]
  const whiskers = [
    // Left upper
    [[64, 146], [40, 145]], [[40, 145], [14, 148]],
    // Left lower
    [[66, 158], [42, 166]], [[42, 166], [22, 174]],
    // Right upper
    [[192, 146], [216, 145]], [[216, 145], [242, 148]],
    // Right lower
    [[190, 158], [214, 166]], [[214, 166], [234, 174]],
  ];

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < size; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

      for (const [sx, sy] of subOffsets) {
        // Map to 256x256 coordinate space
        const px = ((x + sx) / size) * 256;
        const py = ((y + sy) / size) * 256;

        let col = null;

        // 1. Whiskers stroke
        for (const [w1, w2] of whiskers) {
          if (distToSegment([px, py], w1, w2) <= 2.8) {
            col = cOutline;
            break;
          }
        }

        // 2. Ears
        if (!col) {
          // Inner ears
          if (ptInTriangle([px, py], lEarInner[0], lEarInner[1], lEarInner[2]) ||
              ptInTriangle([px, py], rEarInner[0], rEarInner[1], rEarInner[2])) {
            col = cInnerEar;
          } else if (ptInTriangle([px, py], lEarOuter[0], lEarOuter[1], lEarOuter[2]) ||
                     ptInTriangle([px, py], rEarOuter[0], rEarOuter[1], rEarOuter[2])) {
            // Ear borders vs fill
            const d1 = Math.min(
              distToSegment([px, py], lEarOuter[0], lEarOuter[1]),
              distToSegment([px, py], lEarOuter[1], lEarOuter[2]),
              distToSegment([px, py], rEarOuter[0], rEarOuter[1]),
              distToSegment([px, py], rEarOuter[1], rEarOuter[2])
            );
            col = d1 <= 4.0 ? cOutline : cFur;
          }
        }

        // 3. Head ellipse
        const hdx = (px - 128) / 90;
        const hdy = (py - 144) / 78;
        const hdistSq = hdx * hdx + hdy * hdy;

        if (hdistSq <= 1.0) {
          // If close to head perimeter, outline
          if (hdistSq >= 0.88) {
            col = cOutline;
          } else {
            // Inside head!
            let insideCol = cFur;

            // Cheek stripes
            if (ptInTriangle([px, py], lCheek1[0], lCheek1[1], lCheek1[2]) ||
                ptInTriangle([px, py], lCheek2[0], lCheek2[1], lCheek2[2]) ||
                ptInTriangle([px, py], rCheek1[0], rCheek1[1], rCheek1[2]) ||
                ptInTriangle([px, py], rCheek2[0], rCheek2[1], rCheek2[2])) {
              insideCol = cStripes;
            }

            // Forehead stripes
            if (ptInTriangle([px, py], midStripe[0], midStripe[1], midStripe[2]) ||
                ptInTriangle([px, py], leftStripe[0], leftStripe[1], leftStripe[2]) ||
                ptInTriangle([px, py], rightStripe[0], rightStripe[1], rightStripe[2])) {
              insideCol = cStripes;
            }

            // Muzzle
            const mdx = (px - 128) / 40;
            const mdy = (py - 174) / 32;
            if (mdx * mdx + mdy * mdy <= 1.0) {
              insideCol = cMuzzle;
            }

            // Nose
            if (ptInTriangle([px, py], noseTri[0], noseTri[1], noseTri[2]) || Math.hypot(px - 128, py - 156) < 6) {
              insideCol = cEye;
            }

            // Mouth line
            const mthLeftDist = distToSegment([px, py], [128, 166], [112, 174]);
            const mthRightDist = distToSegment([px, py], [128, 166], [144, 174]);
            if (mthLeftDist < 2.5 || mthRightDist < 2.5) {
              insideCol = cOutline;
            }

            // Left Eye
            const lEyeDist = Math.hypot(px - 92, py - 142);
            if (lEyeDist <= 19) {
              // Highlights
              if (Math.hypot(px - 98, py - 136) <= 7.0 || Math.hypot(px - 85, py - 149) <= 3.2) {
                insideCol = cWhite;
              } else {
                insideCol = cEye;
              }
            }

            // Right Eye
            const rEyeDist = Math.hypot(px - 164, py - 142);
            if (rEyeDist <= 19) {
              // Highlights
              if (Math.hypot(px - 170, py - 136) <= 7.0 || Math.hypot(px - 157, py - 149) <= 3.2) {
                insideCol = cWhite;
              } else {
                insideCol = cEye;
              }
            }

            col = insideCol;
          }
        }

        if (col) {
          rSum += col[0];
          gSum += col[1];
          bSum += col[2];
          aSum += col[3];
        }
      }

      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = Math.round(rSum / 4);
      rawData[pxOffset + 1] = Math.round(gSum / 4);
      rawData[pxOffset + 2] = Math.round(bSum / 4);
      rawData[pxOffset + 3] = Math.round(aSum / 4);
    }
  }

  // PNG framing
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = makeChunk('IHDR', ihdr);
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

// Generate all target files
console.log('Writing public/icon.svg...');
fs.writeFileSync('public/icon.svg', gawkyyCatSvg);

console.log('Generating gawkyy-cat-64x64.png...');
const png64 = renderGawkyyCatPNG(64);
fs.writeFileSync('public/gawkyy-cat-64x64.png', png64);

console.log('Generating gawkyy-cat-256x256.png...');
const png256 = renderGawkyyCatPNG(256);
fs.writeFileSync('public/gawkyy-cat-256x256.png', png256);

console.log('Generating PWA & favicon icons...');
fs.writeFileSync('public/pwa-192x192.png', renderGawkyyCatPNG(192));
fs.writeFileSync('public/pwa-512x512.png', renderGawkyyCatPNG(512));
fs.writeFileSync('public/pwa-maskable-512x512.png', renderGawkyyCatPNG(512));
fs.writeFileSync('public/apple-touch-icon.png', renderGawkyyCatPNG(180));
fs.writeFileSync('public/favicon.ico', renderGawkyyCatPNG(32));

console.log('All Gawkyy cat mascot icons generated successfully!');
