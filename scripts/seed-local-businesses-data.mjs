#!/usr/bin/env node
/**
 * Kopieer dev/local-businesses.json → data/local-businesses.json
 * voor lokaal testen van ?bizData=json.
 *
 * Let op: dev/ kan verouderd zijn. Verse Sheet-data:
 *   node scripts/refresh-local-businesses-snapshot.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'dev', 'local-businesses.json');
const dest = path.join(root, 'data', 'local-businesses.json');

if (!fs.existsSync(src)) {
  console.error('Bron ontbreekt:', src);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
const stat = fs.statSync(dest);
console.log('OK:', dest);
console.log('Bytes:', stat.size);
console.log('Test: open index.html?bizData=json op je local server.');
