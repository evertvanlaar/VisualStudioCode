/**
 * One-off / repeatable patch for static business/*.html:
 * - Lite header (lang + weather + nav-container--detail-lite)
 * - manifest link
 * - app.js for weather
 * - Merge "Useful numbers" into first Pelion guide more-section (match n8n template)
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BUSINESS = path.join(ROOT, 'business');

const METEO =
  'https://www.meteoblue.com/en/weather/forecast/week/kal%c3%a1-ner%c3%a1_greece_261556';

function extractCssVersion(html) {
  const m = html.match(/style\.css\?v=([^"'>\s]+)/);
  return m ? m[1] : '2.1.166';
}

function buildHeader(isGreek, baseSlug) {
  const ix = isGreek ? 'index-el.html' : 'index.html';
  const ariaLabel = isGreek ? 'Οδηγός Καλών Νερών — αρχική' : 'Kala Nera Guide — home';
  const logoMain = isGreek ? 'Καλά <span>Νερά</span>' : 'Kala <span>Nera</span>';
  const altPath = isGreek
    ? `../business/${baseSlug}.html`
    : `../business/${baseSlug}-el.html`;
  const altLabel = isGreek ? 'English' : 'Ελληνικά';
  const flag = isGreek ? 'gb' : 'gr';

  return `  <header class="site-header">
    <nav class="main-nav">
      <div class="nav-container nav-container--detail-lite">
        <a href="../${ix}" class="logo logo--with-tag" aria-label="${ariaLabel}">
        <span class="logo-main">${logoMain}</span>
        <span class="logo-tag" aria-hidden="true">Guide</span>
      </a>

        <a href="${altPath}" class="lang-link-mobile" title="${altLabel}" aria-label="${altLabel}">
          <img src="../pix/flags/${flag}.svg" alt="${altLabel}">
        </a>

        <a href="${METEO}"
            target="_blank"
            rel="noopener"
            style="text-decoration: none; color: inherit;">
        <div class="weather-icon-container">
            <span id="weather-icon"></span>
            <span id="weather-temp">--°C</span>
        </div>
        </a>

        <a href="${altPath}" class="lang-link lang-link--detail-bar-desktop" title="${altLabel}" aria-label="${altLabel}">
          <img src="../pix/flags/${flag}.svg" alt="${altLabel}" style="width: 20px; vertical-align: middle;">
        </a>
      </div>
    </nav>
  </header>`;
}

const OLD_HEADER_RE =
  /<header class="site-header">[\s\S]*?<div class="nav-container" style="justify-content: center;">[\s\S]*?<\/div>[\s\S]*?<\/nav>[\s\S]*?<\/header>/;

const MERGE_MORE_EN_RE =
  /(<a href="https:\/\/walking-pelion\.blogspot\.com\/"[\s\S]*?<\/a>)(\s*\n\s*<\/div>\s*\n\s*<\/section>\s*\n\s*\n\s*<section class="more-section">\s*\n\s*<h3>Useful numbers<\/h3>\s*\n\s*<div class="more-links">\s*\n\s*<a href="\.\.\/useful-numbers\.html">[\s\S]*?<\/a>\s*\n\s*<\/div>\s*\n\s*<\/section>)/;

const MERGE_MORE_EL_RE =
  /(<a href="https:\/\/walking-pelion\.blogspot\.com\/"[\s\S]*?<\/a>)(\s*\n\s*<\/div>\s*\n\s*<\/section>\s*\n\s*\n\s*<section class="more-section">\s*\n\s*<h3>Χρήσιμα τηλέφωνα<\/h3>\s*\n\s*<div class="more-links">\s*\n\s*<a href="\.\.\/useful-numbers-el\.html">[\s\S]*?<\/a>\s*\n\s*<\/div>\s*\n\s*<\/section>)/;

const USEFUL_LINK_EN = `            <a href="../useful-numbers.html">
              <span class="more-link-leading"><i class="fa-solid fa-phone"></i><span class="more-link-label">Useful numbers</span></span>
              <small>Local &amp; emergency</small>
            </a>
          </div>
        </section>`;

const USEFUL_LINK_EL = `            <a href="../useful-numbers-el.html">
              <span class="more-link-leading"><i class="fa-solid fa-phone"></i><span class="more-link-label">Χρήσιμα τηλέφωνα</span></span>
              <small>Τοπικοί &amp; έκτακτοι</small>
            </a>
          </div>
        </section>`;

async function patchFile(filePath) {
  const base = path.basename(filePath, '.html');
  const isGreek = base.endsWith('-el');
  const baseSlug = isGreek ? base.slice(0, -3) : base;

  let html = await fs.readFile(filePath, 'utf8');
  let changed = false;

  if (OLD_HEADER_RE.test(html)) {
    html = html.replace(OLD_HEADER_RE, buildHeader(isGreek, baseSlug));
    changed = true;
  }

  if (!html.includes('rel="manifest"')) {
    html = html.replace(
      /(<link rel="stylesheet" href="\.\.\/style\.css\?v=[^"]+">)/,
      '$1\n  <link rel="manifest" href="/manifest.json">',
    );
    changed = true;
  }

  const ver = extractCssVersion(html);
  if (!html.includes('../app.js')) {
    html = html.replace(/<\/body>\s*\n<\/html>/i, `  <script src="../app.js?v=${ver}"></script>\n</body>\n</html>`);
    changed = true;
  }

  if (isGreek) {
    if (MERGE_MORE_EL_RE.test(html)) {
      html = html.replace(MERGE_MORE_EL_RE, `$1\n${USEFUL_LINK_EL}`);
      changed = true;
    }
  } else if (MERGE_MORE_EN_RE.test(html)) {
    html = html.replace(MERGE_MORE_EN_RE, `$1\n${USEFUL_LINK_EN}`);
    changed = true;
  }

  if (changed) await fs.writeFile(filePath, html, 'utf8');
  return changed;
}

const files = (await fs.readdir(BUSINESS)).filter((f) => f.endsWith('.html'));
let n = 0;
for (const f of files) {
  const fp = path.join(BUSINESS, f);
  if (await patchFile(fp)) n++;
}
console.log(`Patched ${n} / ${files.length} business HTML files.`);
