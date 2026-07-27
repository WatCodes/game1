// Generate app icons + a splash source as PNGs with no image dependencies —
// a minimal PNG encoder over node:zlib.
//
// The mark: a cat-head silhouette in voltage amber with the lightning bolt
// punched through it in cyan. Two shapes only, both brand colours, so it still
// reads at 32px where anything fussier turns to mush.
//
//   npm run icons
//
// icon-1024.png / splash-2732.png are the sources @capacitor/assets expands
// into every native size — see docs/NATIVE.md.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel((x + 0.5) / size, (y + 0.5) / size);
      raw.set([r, g, b, a], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Even-odd point-in-polygon. */
function inPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// --- the mark, in unit coordinates -----------------------------------------
const HEAD = { cx: 0.5, cy: 0.6, r: 0.28 };
// Ear bases overlap the skull so the three shapes merge into one silhouette.
// Kept short and near-upright: taller, more outward-leaning triangles read as
// fox or devil horns rather than cat, and they push the mark out of the
// maskable safe zone.
// Both base corners must sit INSIDE the skull circle or they poke out as
// little burrs at large sizes. At y=0.42 the circle spans x 0.286..0.714.
const EAR_L = [[0.315, 0.42], [0.345, 0.17], [0.55, 0.45]];
const EAR_R = [[0.685, 0.42], [0.655, 0.17], [0.45, 0.45]];
// The original bolt, rescaled to sit inside the head.
const BOLT = [
  [0.539, 0.44], [0.36, 0.64], [0.472, 0.64], [0.438, 0.8], [0.64, 0.587], [0.517, 0.587],
];

// Marble & Gold. These were the pre-redesign dark values (navy #0a101c, neon
// amber #fbbf24, electric cyan #22d3ee) — a dark tile with a neon cat opening
// into a warm parchment game.
//
// Composition note: the bolt is punched OUT of the fur, so its contrast is
// against FUR, not BG. A gold bolt on gold fur would vanish at 40px, which is
// why the cat is the courtyard's dark tabby and the bolt is the lit pale gold.
// A light tile also stands out on a home screen where nearly every other game
// icon is dark.
const BG = [243, 234, 212, 255]; // --bg, parchment
const FUR = [84, 73, 61, 255]; // the courtyard tabby (DEFAULT_CATS[0].body)
const BOLT_COLOR = [244, 201, 93, 255]; // lit gold, between --amber and --gold-lit

function inHead(x, y) {
  const dx = x - HEAD.cx;
  const dy = y - HEAD.cy;
  return dx * dx + dy * dy <= HEAD.r * HEAD.r || inPoly(EAR_L, x, y) || inPoly(EAR_R, x, y);
}

/** Colour at unit coords, or null where the mark isn't drawn. */
function mark(x, y) {
  if (!inHead(x, y)) return null;
  return inPoly(BOLT, x, y) ? BOLT_COLOR : FUR;
}

// public/ is served and precached by the service worker, so only the sizes the
// PWA actually uses go there. The big native sources live in assets/, which is
// both out of the web bundle and where @capacitor/assets looks by convention.
const web = new URL('../public/', import.meta.url);
const native = new URL('../assets/', import.meta.url);
mkdirSync(web, { recursive: true });
mkdirSync(native, { recursive: true });

const icon = (size) => png(size, (x, y) => mark(x, y) ?? BG);

for (const size of [192, 512]) {
  const buf = icon(size);
  writeFileSync(new URL(`icon-${size}.png`, web), buf);
  console.log(`public/icon-${size}.png (${buf.length} bytes)`);
}

// Native sources: @capacitor/assets expands these into every platform size.
const icon1024 = icon(1024);
writeFileSync(new URL('icon.png', native), icon1024);
console.log(`assets/icon.png (${icon1024.length} bytes)`);

// Splash: same mark, small and centred on the app background.
const SPLASH_SCALE = 0.26;
const splash = png(2732, (x, y) => {
  const u = (x - 0.5) / SPLASH_SCALE + 0.5;
  const v = (y - 0.5) / SPLASH_SCALE + 0.5;
  if (u < 0 || u > 1 || v < 0 || v > 1) return BG;
  return mark(u, v) ?? BG;
});
writeFileSync(new URL('splash.png', native), splash);
console.log(`assets/splash.png (${splash.length} bytes)`);
