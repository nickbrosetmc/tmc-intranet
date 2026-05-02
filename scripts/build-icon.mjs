// Generates the PWA app icon set from a single SVG source.
// Run: node scripts/build-icon.mjs
//
// The icon design lives inline below — edit `svg` to tweak. Sharp renders
// it to PNG at the sizes Web/Apple need.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const ICONS_DIR = path.join(ROOT, "public", "icons");

// Brand: gold #CFB583, slate #404E5C, off-white #F1F1F0, dark #0E0F19.
// "TH" wordmark in gold on near-black, with gold rule above and below
// to evoke a "hub" / dashboard. Distinct from the marketing logo so
// users won't confuse the dock icon with the GoHighLevel app.
const svg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#1c1f2b"/>
      <stop offset="1" stop-color="#0E0F19"/>
    </linearGradient>
  </defs>

  <!-- Background (full bleed; OS rounds the corners) -->
  <rect width="1024" height="1024" fill="url(#bg)"/>

  <!-- Big bold "TMC" mark, vertically centered -->
  <text x="512" y="540"
        text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        font-weight="800"
        font-size="380"
        fill="#CFB583"
        letter-spacing="-12">TMC</text>

  <!-- Hairline gold rule between TMC and PORTAL -->
  <rect x="384" y="600" width="256" height="6" rx="3" fill="#CFB583" opacity="0.85"/>

  <!-- "PORTAL" caption below — readable at 192px, fades into a wash at dock size -->
  <text x="512" y="730"
        text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        font-weight="600"
        font-size="92"
        fill="#CFB583"
        letter-spacing="22">PORTAL</text>
</svg>
`;

const outputs = [
  { size: 192, file: "icon-192.png" },
  { size: 512, file: "icon-512.png" },
  { size: 180, file: "apple-touch-icon.png" },
];

const buffer = Buffer.from(svg);

for (const { size, file } of outputs) {
  const out = path.join(ICONS_DIR, file);
  await sharp(buffer)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ ${file} (${size}×${size})`);
}

// Also save the SVG itself so the manifest can offer it as a vector option
// for browsers that prefer it.
await writeFile(path.join(ICONS_DIR, "icon.svg"), svg.trim());
console.log("✓ icon.svg");
