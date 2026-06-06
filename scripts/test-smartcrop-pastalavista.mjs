/**
 * SmartCrop focus points for trial businesses.
 * Run: node scripts/test-smartcrop-pastalavista.mjs
 *      node scripts/test-smartcrop-pastalavista.mjs sikia.jpg
 */
import { createRequire } from 'node:module';
import { createCanvas, loadImage } from 'canvas';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const smartcrop = require('smartcrop');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || 'pastalavista.jpg';
const imagePath = path.join(__dirname, '..', 'pix', file);

/** Typical frames in the live site (width × height). */
const FRAMES = {
  'business-detail-mobile': { width: 390, height: 211 },
  'business-detail-desktop': { width: 720, height: 420 },
  'magazine-card-mobile': { width: 360, height: 118 },
  'magazine-card-desktop': { width: 320, height: 210 },
};

function cropToObjectPosition(crop, nw, nh) {
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  return {
    objectPosition: `${((cx / nw) * 100).toFixed(1)}% ${((cy / nh) * 100).toFixed(1)}%`,
    crop,
  };
}

const img = await loadImage(imagePath);
console.log(`Image: ${path.basename(imagePath)} — ${img.width}×${img.height}px (portrait)\n`);
console.log('Default CSS fallback: center 28%\n');

const cropOpts = {
  canvasFactory: (w, h) => createCanvas(w, h),
};

for (const [label, frame] of Object.entries(FRAMES)) {
  const result = await smartcrop.crop(img, { ...frame, ...cropOpts });
  const { objectPosition, crop } = cropToObjectPosition(result.topCrop, img.width, img.height);
  console.log(`${label} (frame ${frame.width}×${frame.height}):`);
  console.log(`  object-position: ${objectPosition}`);
  console.log(`  crop box: x=${crop.x} y=${crop.y} w=${crop.width} h=${crop.height}\n`);
}
