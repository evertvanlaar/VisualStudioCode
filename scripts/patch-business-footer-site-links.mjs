/**
 * Adds "Useful numbers" to the Site column in business/*.html when missing,
 * and adds the Mobile App tag in footer-bottom-row to match root pages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const businessDir = path.join(__dirname, '..', 'business');

function patchEnSiteColumn(s) {
  if (s.includes('<li><a href="../useful-numbers.html"')) return s;
  return s.replace(
    /<li><a href="\.\.\/info\.html"><i class="fa-solid fa-compass" aria-hidden="true"><\/i> Pelion guide<\/a><\/li>\r?\n\s*<\/ul>/,
    `<li><a href="../info.html"><i class="fa-solid fa-compass" aria-hidden="true"></i> Pelion guide</a></li>
            <li><a href="../useful-numbers.html"><i class="fa-solid fa-phone" aria-hidden="true"></i> Useful numbers</a></li>
          </ul>`,
  );
}

function patchElSiteColumn(s) {
  if (s.includes('<li><a href="../useful-numbers-el.html"')) return s;
  return s.replace(
    /<li><a href="\.\.\/info-el\.html"><i class="fa-solid fa-compass" aria-hidden="true"><\/i> Οδηγός Πηλίου<\/a><\/li>\r?\n\s*<\/ul>/,
    `<li><a href="../info-el.html"><i class="fa-solid fa-compass" aria-hidden="true"></i> Οδηγός Πηλίου</a></li>
            <li><a href="../useful-numbers-el.html"><i class="fa-solid fa-phone" aria-hidden="true"></i> Χρήσιμα τηλέφωνα</a></li>
          </ul>`,
  );
}

const appTagEn = `
            <div class="app-version-tag"><i class="fa fa-th-large" aria-hidden="true"></i> Mobile App</div>`;
const appTagEl = `
            <div class="app-version-tag"><i class="fa fa-th-large" aria-hidden="true"></i> Εφαρμογή Κινητού</div>`;

function addMobileAppTag(html, file) {
  if (html.includes('app-version-tag')) return html;
  const isEl = file.endsWith('-el.html');
  const tag = isEl ? appTagEl : appTagEn;
  return html.replace(
    /(<div class="footer-bottom-row">\s*\r?\n\s*<p>[\s\S]*?<\/p>)(\s*\r?\n\s*<\/div>)/,
    `$1${tag}$2`,
  );
}

let changed = 0;
for (const name of fs.readdirSync(businessDir)) {
  if (!name.endsWith('.html')) continue;
  const fp = path.join(businessDir, name);
  let html = fs.readFileSync(fp, 'utf8');
  const before = html;
  html = name.endsWith('-el.html') ? patchElSiteColumn(html) : patchEnSiteColumn(html);
  html = addMobileAppTag(html, name);
  if (html !== before) {
    fs.writeFileSync(fp, html, 'utf8');
    changed++;
  }
}
console.log(`Updated ${changed} business HTML file(s).`);
