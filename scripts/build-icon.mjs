// Generates the PWA app icon set.
// Run: node scripts/build-icon.mjs (or `npm run icons:build`)
//
// Reuses the TMC marketing logo's Spartan helmet:
//  1. Crop the helmet portion of src/assets/tmc-logo.png
//  2. Make the white background transparent (per-pixel luminance threshold)
//  3. Composite onto a dark gradient + add a "TMC" caption below
//  4. Export at the sizes Web/Apple need

import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const ICONS_DIR = path.join(ROOT, "public", "icons");
const SOURCE_LOGO = path.join(ROOT, "src", "assets", "tmc-logo.png");

// Tweak these if the cropped helmet shifts around.
const HELMET_CROP = { left: 280, top: 110, width: 520, height: 520 };
// White-pixel threshold — pixels this bright (avg of RGB) become transparent.
const WHITE_THRESHOLD = 230;

// Background + caption layer. The helmet is composited on top by sharp.
const bgSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#1c1f2b"/>
      <stop offset="1" stop-color="#0E0F19"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect x="384" y="800" width="256" height="6" rx="3" fill="#CFB583" opacity="0.7"/>
  <text x="512" y="900"
        text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        font-weight="700"
        font-size="92"
        fill="#CFB583"
        letter-spacing="22">TMC</text>
</svg>
`;

/**
 * Crop the helmet from the marketing logo and make its white background
 * transparent so it can be composited on the dark icon background.
 */
async function buildHelmetLayer() {
  const cropped = await sharp(SOURCE_LOGO)
    .extract(HELMET_CROP)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = cropped;
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = brightness >= WHITE_THRESHOLD ? 0 : data[i + 3];
  }

  // Resize the helmet to ~720px (about 70% of the icon, leaves room for
  // the TMC caption underneath).
  return sharp(out, { raw: info })
    .resize(720, 720, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

const outputs = [
  { size: 192, file: "icon-192.png" },
  { size: 512, file: "icon-512.png" },
  { size: 180, file: "apple-touch-icon.png" },
];

const helmet = await buildHelmetLayer();

// Build the master 1024 icon (bg + caption + helmet), then resize down
// for each output. Doing it once at high res avoids per-size resizing
// of the SVG text which softens edges.
const master = await sharp(Buffer.from(bgSvg))
  .composite([
    {
      input: helmet,
      // Center horizontally; top portion of canvas (helmet at y=80–800).
      top: 80,
      left: Math.floor((1024 - 720) / 2),
    },
  ])
  .png()
  .toBuffer();

for (const { size, file } of outputs) {
  const out = path.join(ICONS_DIR, file);
  await sharp(master)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ ${file} (${size}×${size})`);
}
