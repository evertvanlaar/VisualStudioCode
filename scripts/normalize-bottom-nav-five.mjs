/**
 * Root (and any) HTML with exactly 4 bottom-nav links: expand to
 * Home | Bus | Favorites | Guide | More (EN) or Greek equivalents.
 * Business pages already have 5 links — skipped.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walk(p, acc);
    } else if (ent.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const blockRe = /<div class="bottom-nav-inner">[\s\S]*?<\/div>\s*<\/nav>/;

function buildBlock(relPosix, basename) {
  const inBiz = relPosix.startsWith('business/');
  const prefix = inBiz ? '../' : '';
  const isEl = /^[^/]+-el\.html$/i.test(basename) || basename.endsWith('-el.html');

  const home = isEl ? 'index-el.html' : 'index.html';
  const bus = isEl ? 'bus-el.html' : 'bus.html';
  const wish = isEl ? 'wishlist-el.html' : 'wishlist.html';
  const info = isEl ? 'info-el.html' : 'info.html';

  const L = isEl
    ? { home: 'Αρχική', bus: 'Λεωφορείο', fav: 'Αγαπημένα', guide: 'Οδηγός', more: 'Περισσότερα' }
    : { home: 'Home', bus: 'Bus', fav: 'Favorites', guide: 'Guide', more: 'More' };

  const b = basename.toLowerCase();
  let cur = null;
  if (b === 'index.html' || b === 'index-el.html') cur = 'home';
  else if (b === 'bus.html' || b === 'bus-el.html') cur = 'bus';
  else if (b === 'wishlist.html' || b === 'wishlist-el.html') cur = 'fav';
  else if (b === 'info.html' || b === 'info-el.html') cur = 'guide';

  const ac = (k) => (cur === k ? ' aria-current="page"' : '');

  const ind = '        ';
  return (
    `    <div class="bottom-nav-inner">\n` +
    `${ind}<a href="${prefix}${home}"${ac('home')}><i class="fa-solid fa-house"></i><span>${L.home}</span></a>\n` +
    `${ind}<a href="${prefix}${bus}"${ac('bus')}><i class="fa-solid fa-bus"></i><span>${L.bus}</span></a>\n` +
    `${ind}<a href="${prefix}${wish}"${ac('fav')}><i class="fa-solid fa-heart"></i><span>${L.fav}</span></a>\n` +
    `${ind}<a href="${prefix}${info}"${ac('guide')}><i class="fa-solid fa-compass"></i><span>${L.guide}</span></a>\n` +
    `${ind}<a href="#" data-more><i class="fa-solid fa-ellipsis"></i><span>${L.more}</span></a>\n` +
    `    </div>\n</nav>`
  );
}

let updated = 0;
for (const filePath of walk(root)) {
  let s = fs.readFileSync(filePath, 'utf8');
  const m = s.match(blockRe);
  if (!m) continue;
  const inner = m[0].slice(0, m[0].indexOf('</nav>'));
  const linkCount = (inner.match(/<a\s/g) || []).length;
  if (linkCount !== 4) continue;

  const relPosix = path.relative(root, filePath).split(path.sep).join('/');
  const basename = path.basename(filePath);
  const replacement = buildBlock(relPosix, basename);
  const ns = s.replace(blockRe, replacement);
  if (ns !== s) {
    fs.writeFileSync(filePath, ns, 'utf8');
    updated++;
    console.log(relPosix);
  }
}
console.log('updated', updated, 'files');
