/**
 * Roll out hub footer (install strip, footer-aside, footer-legal) site-wide.
 * Preserves footer-lead/tagline and aria-current on nav links when present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULTS = {
  en: {
    tagline: 'Kala Nera · Pelion, Greece',
    lead: 'We help travelers discover the best places—from authentic taverns to wonderful stays—in Kala Nera and the wider Pelion area.',
    legal:
      '© 2026 Kala Nera Guide. E-Project all rights reserved. · <span class="footer-powered-inline">Powered by <a href="mailto:info@spiti.tech">KanteKlik</a></span>',
    siteTitle: 'Site',
    socialTitle: 'Social',
    infoTitle: 'Info',
    fbAria: 'Kala Nera on Facebook',
    installAria: 'Install Kala Nera Guide on your phone',
    installTitle: 'Install on your phone',
    installNote: 'Free · Browser install · Not in App Store or Google Play',
    qrAlt: 'QR: install Kala Nera Guide at kalanera.gr/install.html',
    qrLabel: 'Scan',
    links: {
      bus: { href: 'bus.html', icon: 'fa-bus', label: 'Bus (Kala Nera)' },
      wishlist: { href: 'wishlist.html', icon: 'fa-heart', label: 'Favorites' },
      tform: { href: 't-form.html', icon: 'fa-circle-plus', label: 'Add your Business' },
      info: { href: 'info.html', icon: 'fa-compass', label: 'Pelion guide' },
      useful: { href: 'useful-numbers.html', icon: 'fa-phone', label: 'Useful numbers' },
      contact: { href: 'mailto:info@spiti.tech', icon: 'fa-envelope', label: 'Contact', mail: true },
      privacy: { href: 'privacy.html', icon: 'fa-user-shield', label: 'Privacy policy' },
    },
    index: 'index.html',
    install: 'install.html',
    qr: 'pix/install-qr-en.png',
    wordmark: 'Kala <span>Nera</span>',
    logoAlt: 'Kala Nera',
  },
  el: {
    tagline: 'Καλά Νερά · Πήλιο, Ελλάδα',
    lead: 'Βοηθάμε τους επισκέπτες να ανακαλύψουν τα καλύτερα σημεία—από αυθεντικές ταβέρνες μέχρι όμορφες διαμονές—στα Καλά Νερά και το ευρύτερο Πήλιο.',
    legal:
      '© 2026 Οδηγός Καλών Νερών. E-Project όλα τα δικαιώματα διατηρούνται. · <span class="footer-powered-inline">Με την υποστήριξη <a href="mailto:info@spiti.tech">KanteKlik</a></span>',
    siteTitle: 'Ιστότοπος',
    socialTitle: 'Κοινωνικά',
    infoTitle: 'Πληροφορίες',
    fbAria: 'Καλά Νερά στο Facebook',
    installAria: 'Εγκατάσταση Καλά Νερά Guide στο κινητό',
    installTitle: 'Εγκατάσταση στο κινητό',
    installNote: 'Δωρεάν · Μέσω browser · Όχι App Store ή Google Play',
    qrAlt: 'QR εγκατάστασης: kalanera.gr/install-el.html',
    qrLabel: 'Σάρωση',
    links: {
      bus: { href: 'bus-el.html', icon: 'fa-bus', label: 'Λεωφορείο (Καλά Νερά)' },
      wishlist: { href: 'wishlist-el.html', icon: 'fa-heart', label: 'Αγαπημένα' },
      tform: { href: 't-form-el.html', icon: 'fa-circle-plus', label: 'Προσθέστε Επιχείρηση' },
      info: { href: 'info-el.html', icon: 'fa-compass', label: 'Οδηγός Πηλίου' },
      useful: { href: 'useful-numbers-el.html', icon: 'fa-phone', label: 'Χρήσιμα τηλέφωνα' },
      contact: { href: 'mailto:info@spiti.tech', icon: 'fa-envelope', label: 'Επικοινωνία', mail: true },
      privacy: { href: 'privacy-el.html', icon: 'fa-user-shield', label: 'Πολιτική απορρήτου' },
    },
    index: 'index-el.html',
    install: 'install-el.html',
    qr: 'pix/install-qr-el.png',
    wordmark: 'Καλά <span>Νερά</span>',
    logoAlt: 'Καλά Νερά',
  },
};

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'");
}

function extractText(html, className) {
  const re = new RegExp(`<p class="${className}">([\\s\\S]*?)</p>`, 'i');
  const m = html.match(re);
  return m ? decodeHtml(m[1].replace(/<[^>]+>/g, '').trim()) : '';
}

function extractAriaMap(footerHtml) {
  const map = {};
  for (const m of footerHtml.matchAll(/<a\s+([^>]*?)href="([^"]+)"([^>]*)>/gi)) {
    const attrs = `${m[1]}${m[3]}`;
    const ac = attrs.match(/aria-current="([^"]+)"/);
    if (ac) map[m[2]] = ac[1];
  }
  return map;
}

function extractLegal(footerHtml, fallback) {
  const m =
    footerHtml.match(/<p class="footer-legal">([\s\S]*?)<\/p>/i) ||
    footerHtml.match(/<div class="footer-bottom-row">\s*<p>([\s\S]*?)<\/p>/i) ||
    footerHtml.match(/footer-bottom-row"><p>([^<]+)</i);
  if (!m) return fallback;
  let text = m[1].trim();
  if (!text.includes('footer-powered-inline') && !text.includes('KanteKlik')) {
    const powered = fallback.includes('Με την υποστήριξη')
      ? ' · <span class="footer-powered-inline">Με την υποστήριξη <a href="mailto:info@spiti.tech">KanteKlik</a></span>'
      : ' · <span class="footer-powered-inline">Powered by <a href="mailto:info@spiti.tech">KanteKlik</a></span>';
    text += powered;
  }
  return text;
}

function ariaAttr(href, ariaMap, prefix) {
  const keys = [href, `${prefix}${href}`, href.replace(/^\.\.\//, '')];
  for (const k of keys) {
    if (ariaMap[k]) return ` aria-current="${ariaMap[k]}"`;
  }
  return '';
}

function navLi(prefix, item, ariaMap) {
  const href = item.mail ? item.href : `${prefix}${item.href}`;
  const ac = item.mail ? '' : ariaAttr(item.href, ariaMap, prefix);
  const iconClass = item.icon.startsWith('fa-') ? `fa-solid ${item.icon}` : item.icon;
  return `                            <li><a href="${href}"${ac}><i class="${iconClass}" aria-hidden="true"></i> ${item.label}</a></li>`;
}

function buildHubFooter({ isEl, prefix, tagline, lead, legal, ariaMap, compact }) {
  const L = isEl ? DEFAULTS.el : DEFAULTS.en;
  const ix = `${prefix}${L.index}`;
  const logo = `${prefix}logo.png`;
  const installHref = `${prefix}${L.install}`;
  const qrSrc = `${prefix}${L.qr}`;
  const nl = compact ? '\n' : '\n';
  const ind = compact ? '  ' : '    ';
  const ind2 = ind + ind;
  const ind3 = ind2 + ind;

  const siteLinks = ['bus', 'wishlist', 'tform', 'info', 'useful']
    .map((k) => navLi(prefix, L.links[k], ariaMap))
    .join(nl);
  const infoLinks = ['contact', 'privacy']
    .map((k) => navLi(prefix, L.links[k], ariaMap))
    .join(nl);

  if (compact) {
    return `<footer class="site-footer">${nl}${ind}<div class="footer-container footer-container--hub">${nl}${ind2}<div class="footer-column footer-column--brand">${nl}${ind3}<a href="${ix}" class="footer-brand-lockup"><img src="${logo}" alt="${L.logoAlt}" width="52" height="52" class="footer-brand-logo" loading="lazy"><span class="footer-lockup-wordmark logo">${L.wordmark}</span></a>${nl}${ind3}<p class="footer-tagline">${tagline}</p><p class="footer-lead">${lead}</p>${nl}${ind3}<div class="footer-install-strip">${nl}${ind3}  <a href="${installHref}" class="install-badge install-badge--footer" aria-label="${L.installAria}"><span class="install-badge__icon" aria-hidden="true"><i class="fa-solid fa-mobile-screen-button"></i></span><span class="install-badge__text"><span class="install-badge__title">${L.installTitle}</span><span class="install-badge__note">${L.installNote}</span></span><i class="fa-solid fa-chevron-right install-badge__chevron" aria-hidden="true"></i></a>${nl}${ind3}  <div class="footer-install-qr"><img src="${qrSrc}" width="72" height="72" alt="${L.qrAlt}" loading="lazy"><span class="footer-install-qr__label">${L.qrLabel}</span></div>${nl}${ind3}</div>${nl}${ind2}</div>${nl}${ind2}<div class="footer-aside">${nl}${ind3}<div class="footer-aside-cols">${nl}${ind3}  <div class="footer-column footer-column--site"><div class="footer-nav-section"><h3>${L.siteTitle}</h3><ul>${nl}${siteLinks.split(nl).map((l) => ind3 + '    ' + l.trim()).join(nl)}${nl}${ind3}    </ul></div></div>${nl}${ind3}  <div class="footer-column footer-column--social"><h3>${L.socialTitle}</h3><div class="social-icons"><a href="https://www.facebook.com/kalanera.info" target="_blank" rel="noopener noreferrer" class="social-icon" aria-label="${L.fbAria}"><i class="fab fa-facebook-f" aria-hidden="true"></i></a></div><div class="footer-nav-section footer-nav-section--under-social"><h3>${L.infoTitle}</h3><ul>${nl}${infoLinks.split(nl).map((l) => ind3 + '      ' + l.trim()).join(nl)}${nl}${ind3}    </ul></div></div>${nl}${ind3}</div>${nl}${ind3}<p class="footer-legal">${legal}</p>${nl}${ind2}</div>${nl}${ind}</div>${nl}</footer>`;
  }

  return `<footer class="site-footer">
${ind}<div class="footer-container footer-container--hub">
${ind2}<div class="footer-column footer-column--brand">
${ind3}<a href="${ix}" class="footer-brand-lockup">
${ind3}    <img src="${logo}" alt="${L.logoAlt}" width="52" height="52" class="footer-brand-logo" loading="lazy">
${ind3}    <span class="footer-lockup-wordmark logo">${L.wordmark}</span>
${ind3}</a>
${ind3}<p class="footer-tagline">${tagline}</p>
${ind3}<p class="footer-lead">${lead}</p>
${ind3}<div class="footer-install-strip">
${ind3}    <a href="${installHref}" class="install-badge install-badge--footer" aria-label="${L.installAria}">
${ind3}        <span class="install-badge__icon" aria-hidden="true"><i class="fa-solid fa-mobile-screen-button"></i></span>
${ind3}        <span class="install-badge__text">
${ind3}            <span class="install-badge__title">${L.installTitle}</span>
${ind3}            <span class="install-badge__note">${L.installNote}</span>
${ind3}        </span>
${ind3}        <i class="fa-solid fa-chevron-right install-badge__chevron" aria-hidden="true"></i>
${ind3}    </a>
${ind3}    <div class="footer-install-qr">
${ind3}        <img src="${qrSrc}" width="72" height="72" alt="${L.qrAlt}" loading="lazy">
${ind3}        <span class="footer-install-qr__label">${L.qrLabel}</span>
${ind3}    </div>
${ind3}</div>
${ind2}</div>

${ind2}<div class="footer-aside">
${ind3}<div class="footer-aside-cols">
${ind3}    <div class="footer-column footer-column--site">
${ind3}        <div class="footer-nav-section">
${ind3}            <h3>${L.siteTitle}</h3>
${ind3}            <ul>
${siteLinks}
${ind3}            </ul>
${ind3}        </div>
${ind3}    </div>

${ind3}    <div class="footer-column footer-column--social">
${ind3}        <h3>${L.socialTitle}</h3>
${ind3}        <div class="social-icons">
${ind3}            <a href="https://www.facebook.com/kalanera.info" target="_blank" rel="noopener noreferrer" class="social-icon" aria-label="${L.fbAria}">
${ind3}                <i class="fab fa-facebook-f" aria-hidden="true"></i>
${ind3}            </a>
${ind3}        </div>
${ind3}        <div class="footer-nav-section footer-nav-section--under-social">
${ind3}            <h3>${L.infoTitle}</h3>
${ind3}            <ul>
${infoLinks}
${ind3}            </ul>
${ind3}        </div>
${ind3}    </div>
${ind3}</div>
${ind3}<p class="footer-legal">${legal}</p>
${ind2}</div>
${ind}</div>

</footer>`;
}

function patchFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  if (!html.includes('class="site-footer"') && !html.includes("class='site-footer'")) return false;
  if (html.includes('footer-container--hub')) return false;

  const footerRe = /<footer class="site-footer">[\s\S]*?<\/footer>/i;
  const m = html.match(footerRe);
  if (!m) return false;

  const oldFooter = m[0];
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  const isBusiness = rel.startsWith('business/');
  const isEl =
    rel.endsWith('-el.html') ||
    /<html[^>]*\slang=["']el["']/i.test(html) ||
    oldFooter.includes('Ιστότοπος') ||
    oldFooter.includes('Κοινωνικά');
  const prefix = isBusiness || oldFooter.includes('href="../index') ? '../' : '';
  const L = isEl ? DEFAULTS.el : DEFAULTS.en;
  const compact = isBusiness || oldFooter.length < 1200;

  const tagline = extractText(oldFooter, 'footer-tagline') || L.tagline;
  const lead = extractText(oldFooter, 'footer-lead') || L.lead;
  const ariaMap = extractAriaMap(oldFooter);
  const legal = extractLegal(oldFooter, L.legal);

  const newFooter = buildHubFooter({
    isEl,
    prefix,
    tagline,
    lead,
    legal,
    ariaMap,
    compact,
  });

  html = html.replace(footerRe, newFooter);
  fs.writeFileSync(filePath, html, 'utf8');
  return true;
}

function patchN8nTemplate() {
  const fp = path.join(root, 'n8n', 'n8n-business-page-template.js');
  let js = fs.readFileSync(fp, 'utf8');
  if (js.includes('footer-container--hub')) {
    console.log('n8n template already has hub footer.');
    return false;
  }

  const oldBlock =
    /  <footer class="site-footer"><div class="footer-container">[\s\S]*?<\/footer>\n  <nav class="bottom-nav"/;

  const replacement = `  <footer class="site-footer"><div class="footer-container footer-container--hub"><div class="footer-column footer-column--brand">
        <a href="../\${escapeHtml(ix)}" class="footer-brand-lockup"><img src="../logo.png" alt="\${escapeHtml(isGreek ? 'Καλά Νερά' : 'Kala Nera')}" width="52" height="52" class="footer-brand-logo" loading="lazy"><span class="footer-lockup-wordmark logo">\${isGreek ? 'Καλά <span>Νερά</span>' : 'Kala <span>Nera</span>'}</span></a>
        <p class="footer-tagline">\${escapeHtml(footerTagline)}</p><p class="footer-lead">\${escapeHtml(footerAboutText)}</p>
        <div class="footer-install-strip">
          <a href="../\${isGreek ? 'install-el.html' : 'install.html'}" class="install-badge install-badge--footer" aria-label="\${escapeHtml(isGreek ? 'Εγκατάσταση Καλά Νερά Guide στο κινητό' : 'Install Kala Nera Guide on your phone')}"><span class="install-badge__icon" aria-hidden="true"><i class="fa-solid fa-mobile-screen-button"></i></span><span class="install-badge__text"><span class="install-badge__title">\${escapeHtml(isGreek ? 'Εγκατάσταση στο κινητό' : 'Install on your phone')}</span><span class="install-badge__note">\${escapeHtml(isGreek ? 'Δωρεάν · Μέσω browser · Όχι App Store ή Google Play' : 'Free · Browser install · Not in App Store or Google Play')}</span></span><i class="fa-solid fa-chevron-right install-badge__chevron" aria-hidden="true"></i></a>
          <div class="footer-install-qr"><img src="../\${isGreek ? 'pix/install-qr-el.png' : 'pix/install-qr-en.png'}" width="72" height="72" alt="\${escapeHtml(isGreek ? 'QR εγκατάστασης: kalanera.gr/install-el.html' : 'QR: install Kala Nera Guide at kalanera.gr/install.html')}" loading="lazy"><span class="footer-install-qr__label">\${escapeHtml(isGreek ? 'Σάρωση' : 'Scan')}</span></div>
        </div></div>
      <div class="footer-aside"><div class="footer-aside-cols">
        <div class="footer-column footer-column--site"><div class="footer-nav-section"><h3>\${escapeHtml(footerSiteTitle)}</h3><ul>
            <li><a href="../bus\${isGreek ? '-el' : ''}.html"><i class="fa-solid fa-bus" aria-hidden="true"></i> \${escapeHtml(footerBusLabel)}</a></li>
            <li><a href="../wishlist\${isGreek ? '-el' : ''}.html"><i class="fa-solid fa-heart" aria-hidden="true"></i> \${escapeHtml(footerFavoritesLabel)}</a></li>
            <li><a href="../t-form\${isGreek ? '-el' : ''}.html"><i class="fa-solid fa-circle-plus" aria-hidden="true"></i> \${escapeHtml(footerAddBizLabel)}</a></li>
            <li><a href="../info\${isGreek ? '-el' : ''}.html"><i class="fa-solid fa-compass" aria-hidden="true"></i> \${escapeHtml(footerTravelLabel)}</a></li>
            <li><a href="../useful-numbers\${isGreek ? '-el' : ''}.html"><i class="fa-solid fa-phone" aria-hidden="true"></i> \${escapeHtml(moreTravelNumbers)}</a></li>
          </ul></div></div>
        <div class="footer-column footer-column--social"><h3>\${escapeHtml(footerSocialTitle)}</h3><div class="social-icons"><a href="https://www.facebook.com/kalanera.info" target="_blank" rel="noopener noreferrer" class="social-icon" aria-label="Facebook"><i class="fab fa-facebook-f" aria-hidden="true"></i></a></div>
          <div class="footer-nav-section footer-nav-section--under-social"><h3>\${escapeHtml(footerInfoTitle)}</h3><ul>
            <li><a href="mailto:info@spiti.tech"><i class="fa fa-envelope" aria-hidden="true"></i> \${escapeHtml(footerContactTitle)}</a></li>
            <li><a href="../privacy\${isGreek ? '-el' : ''}.html"><i class="fa-solid fa-user-shield" aria-hidden="true"></i> \${escapeHtml(footerPrivacyLabel)}</a></li>
          </ul></div></div></div>
        <p class="footer-legal">\${escapeHtml(footerCopyright)} · <span class="footer-powered-inline">\${escapeHtml(footerPoweredLabel)} <a href="mailto:info@spiti.tech">KanteKlik</a></span></p>
      </div></div>
  </footer>
  <nav class="bottom-nav"`;

  if (!oldBlock.test(js)) {
    console.warn('n8n template footer block not found — update manually.');
    return false;
  }
  js = js.replace(oldBlock, replacement);
  fs.writeFileSync(fp, js, 'utf8');
  return true;
}

function collectHtmlFiles(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      collectHtmlFiles(fp, acc);
    } else if (name.endsWith('.html')) {
      acc.push(fp);
    }
  }
  return acc;
}

let changed = 0;
let skipped = 0;
for (const fp of collectHtmlFiles(root)) {
  const rel = path.relative(root, fp).replace(/\\/g, '/');
  if (rel.startsWith('dev/') || rel.startsWith('n8n/')) continue;
  const before = fs.readFileSync(fp, 'utf8');
  if (before.includes('footer-container--hub')) {
    skipped++;
    continue;
  }
  if (patchFile(fp)) {
    changed++;
    console.log('patched:', rel);
  }
}

if (patchN8nTemplate()) console.log('patched: n8n/n8n-business-page-template.js');
console.log(`Done. ${changed} file(s) updated, ${skipped} already had hub footer.`);
