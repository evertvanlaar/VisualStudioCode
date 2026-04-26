/**
 * Sync static asset query strings + SW/app version from repo root asset-version.txt
 *
 * Usage (from repo root):
 *   node scripts/sync-asset-version.mjs
 *
 * Workflow:
 *   1. Edit asset-version.txt (single line, e.g. 1.0.79)
 *   2. Run this script
 *   3. git diff → commit & push
 *
 * Also updates the first-line banner in style.css to match the same semver (for your own reference;
 * real cache-bust for CSS remains the ?v= query on link hrefs in HTML).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** Root-level HTML only; business/* is maintained via n8n. */
const ROOT_HTML_FILES = [
  'index.html',
  'index-el.html',
  'bus.html',
  'bus-el.html',
  'wishlist.html',
  'wishlist-el.html',
  't-form.html',
  't-form-el.html',
];

function readVersion() {
  const p = path.join(root, 'asset-version.txt');
  if (!fs.existsSync(p)) {
    throw new Error(`Missing ${path.relative(process.cwd(), p)} (create it in repo root)`);
  }
  const raw = fs.readFileSync(p, 'utf8').trim();
  if (!raw || raw.includes('\n')) {
    throw new Error('asset-version.txt must be exactly one non-empty line');
  }
  if (!/^[\w.-]+$/.test(raw)) {
    throw new Error(`asset-version.txt: unsupported value "${raw}" (use letters, digits, dots, hyphen, underscore)`);
  }
  return raw;
}

function writeIfChanged(file, content) {
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (prev !== content) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('updated', path.relative(root, file));
  }
}

const v = readVersion();

const appPath = path.join(root, 'app.js');
let app = fs.readFileSync(appPath, 'utf8');
if (!/const APP_VERSION = '[^']*';/.test(app)) {
  throw new Error('app.js: expected line const APP_VERSION = \'...\';');
}
app = app.replace(/const APP_VERSION = '[^']*';/, `const APP_VERSION = '${v}';`);
writeIfChanged(appPath, app);

const swPath = path.join(root, 'service-worker.js');
let sw = fs.readFileSync(swPath, 'utf8');
if (!/const VERSION = '[^']*';/.test(sw)) {
  throw new Error('service-worker.js: expected const VERSION = \'...\';');
}
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${v}';`);
sw = sw.replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = 'kalanera-cache-v${v}';`);
sw = sw.replace(/const IMAGE_CACHE = '[^']*';/, `const IMAGE_CACHE = 'kalanera-images-v${v}';`);
writeIfChanged(swPath, sw);

const cssPath = path.join(root, 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');
const cssBanner = `/* version ${v} */\n`;
if (/^\s*\/\* version[^*]*\*\/\s*\r?\n/.test(css)) {
  css = css.replace(/^\s*\/\* version[^*]*\*\/\s*\r?\n/, cssBanner);
} else if (/^\s*\/\* version[^*]*\*\/\s*$/.test(css.split(/\r?\n/, 1)[0] || '')) {
  css = css.replace(/^\s*\/\* version[^*]*\*\/\s*\r?\n?/, cssBanner);
} else {
  css = cssBanner + css;
}
writeIfChanged(cssPath, css);

for (const name of ROOT_HTML_FILES) {
  const fp = path.join(root, name);
  if (!fs.existsSync(fp)) {
    throw new Error(`Missing root HTML: ${name}`);
  }
  let html = fs.readFileSync(fp, 'utf8');
  if (!/href="style\.css\?v=[^"]*"/.test(html)) {
    throw new Error(`${name}: expected link href="style.css?v=..."`);
  }
  if (!/<script src="app\.js(\?v=[^"]*)?"><\/script>/.test(html)) {
    throw new Error(`${name}: expected <script src="app.js"></script> or with ?v=`);
  }
  const next = html
    .replace(/href="style\.css\?v=[^"]*"/g, `href="style.css?v=${v}"`)
    .replace(/<script src="app\.js(\?v=[^"]*)?"><\/script>/g, `<script src="app.js?v=${v}"></script>`);
  writeIfChanged(fp, next);
}

console.log('sync-asset-version: OK →', v);
