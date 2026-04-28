/**
 * n8n "Code"-node template: twee talen per zaak → business/{slug}.html & business/{slug}-el.html
 * - Domein: overal https://www.kalanera.gr
 * - OG + Twitter meta
 * - JSON-LD: BreadcrumbList + LocalBusiness-variant op basis van Category
 *
 * Kopieer de volledige inhoud naar je n8n workflow (geen import van dit bestand).
 */

const results = [];

const SITE_ORIGIN = 'https://www.kalanera.gr';

const dict = {
  Camp: 'Καμπινγκ',
  Drink: 'Ποτό',
  Eat: 'Φαγητό',
  Other: 'Άλλο',
  Rent: 'Ενοικιάσεις',
  Shop: 'Ψώνια',
  Sleep: 'Διαμονή',
  Travel: 'Ταξίδια',
  'Kala Nera': 'Καλά Νερά',
  'Kato Gatzea': 'Κάτω Γατζέα',
  'Ano Gatzea': 'Άνω Γατζέα',
  Koropi: 'Κορώπη',
  Milies: 'Μηλιές',
  Vizitsa: 'Βυζίτσα',
  Afissos: 'Αφήσσος',
};

const t = (text, isGreek) => {
  if (!isGreek) return text;
  return dict[text] ?? text;
};

/** Meer specifiek @type (alle subtype van LocalBusiness) */
const categoryToSchemaType = (categoryRaw) => {
  const c = String(categoryRaw ?? '').trim();
  const m = {
    Camp: 'Campground',
    Eat: 'Restaurant',
    Drink: 'BarOrPub',
    Sleep: 'LodgingBusiness',
    Shop: 'Store',
    Rent: 'LocalBusiness',
    Travel: 'TravelAgency',
    Other: 'LocalBusiness',
  };
  return m[c] || 'LocalBusiness';
};

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/** Veilig voor <script type="application/ld+json"> */
const jsonLdEmbed = (obj) =>
  JSON.stringify(obj).replace(/</g, '\\u003c');

/** Relatieve of kale bestandsnamen → absolute onder SITE_ORIGIN; externe http(s) elders ongewijzigd; kalanera(.gr) → SITE_ORIGIN */
const absoluteAssetUrl = (photoField) => {
  const fallback = `${SITE_ORIGIN}/pix/nophoto.jpg`;
  const raw = String(photoField ?? '').trim();
  if (!raw) return fallback;

  if (/^https?:\/\//i.test(raw)) {
    if (/^https?:\/\/(www\.)?kalanera\.gr\b/i.test(raw)) {
      return raw.replace(/^https?:\/\/(www\.)?kalanera\.gr\b/i, SITE_ORIGIN);
    }
    return raw;
  }

  let path = raw.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
  if (!path.startsWith('pix/')) {
    path = path.replace(/^pix\/?/, '');
    path = 'pix/' + path;
  }
  return `${SITE_ORIGIN}/${path}`;
};

const telForLd = (p) => {
  const s = String(p ?? '').trim();
  if (!s || s === '-') return '';
  return s;
};

for (const item of $input.all()) {
  const biz = item.json;
  const slug = biz.Name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const generateHTML = (name, isGreek) => {
    const lang = isGreek ? 'el' : 'en';
    const backText = isGreek ? '← Πίσω στην επισκόπηση' : '← Back to overview';
    const visitBtn = isGreek ? 'Επισκεφθείτε την ιστοσελίδα' : 'Visit Website';
    /** Zelfde GA4-webstream als homepage (zie Admin → Web stream → Measurement ID). */
    const gtagId = 'G-12LDX13JG6';

    const summary = isGreek ? biz.Summary_el_imp : biz.Summary_en_imp;

    const footerAboutTitle = isGreek ? 'Σχετικά με εμάς' : 'About us';
    const footerAboutText = isGreek
      ? 'Βοηθάμε τους ταξιδιώτες να ανακαλύψουν τα καλύτερα μέρη, από αυθεντικές ταβέρνες μέχρι τις καλύτερες διαμονές στα Καλά Νερά και την ευρύτερη περιοχή.'
      : 'We help travelers discover the best places from authentic taverns to the finest accommodations in Kala Nera and the surrounding area.';
    const footerFollowTitle = isGreek ? 'Ακολουθήστε μας' : 'Follow Us';
    const footerContactTitle = isGreek ? 'Επικοινωνία' : 'Contact';
    const footerCopyright = isGreek
      ? '© 2026 Κατάλογος Επιχειρήσεων Καλά Νερά. E-Project όλα τα δικαιώματα διατηρούνται.'
      : '© 2026 Kala Nera Business Directory. E-Project all rights reserved.';

    const cat = t(biz.Category, isGreek);
    const loc = t(biz.Location, isGreek);
    const locEn = t(biz.Location, false);

    const tabHome = isGreek ? 'Αρχική' : 'Home';
    const tabFav = isGreek ? 'Αγαπημένα' : 'Favorites';
    const tabAdd = isGreek ? 'Προσθήκη' : 'Add';
    const tabMore = isGreek ? 'Περισσότερα' : 'More';

    const moreUseful = isGreek ? 'Χρήσιμα τηλέφωνα' : 'Useful numbers';
    const moreInstallTitle = isGreek ? 'Εγκατάσταση εφαρμογής' : 'Install App';
    const moreInstallBtn = isGreek ? 'Εγκατάσταση' : 'Install';
    const moreAbout = isGreek ? 'Σχετικά με εμάς' : 'About us';
    const moreFollow = isGreek ? 'Ακολουθήστε μας' : 'Follow us';
    const moreContact = isGreek ? 'Επικοινωνία' : 'Contact';
    const moreStats = isGreek ? 'Στατιστικά' : 'Statistics';
    const poweredBy = isGreek ? 'Με την υποστήριξη' : 'Powered by';

    const appVersion = '1.0.75';

    const formattedCopyright = (() => {
      const raw = footerCopyright || '';
      const withoutLeading = raw.replace(/^\s*©+\s*/g, '').trim();
      return escapeHtml(withoutLeading).replace(/\sE-Project\b/g, '<br>E-Project');
    })();

    const safeWebsite = (biz.Website || '').trim();
    const websiteHref =
      safeWebsite && !safeWebsite.startsWith('http') ? `https://${safeWebsite}` : safeWebsite;

    const imgSrc = absoluteAssetUrl(
      biz.PhotoURL && String(biz.PhotoURL).trim() !== ''
        ? String(biz.PhotoURL).trim()
        : '../pix/nophoto.jpg',
    );

    const ix = `${isGreek ? 'index-el' : 'index'}.html`;

    const pageUrl = `${SITE_ORIGIN}/business/${slug}${isGreek ? '-el' : ''}.html`;
    const alternateEn = `${SITE_ORIGIN}/business/${slug}.html`;
    const alternateEl = `${SITE_ORIGIN}/business/${slug}-el.html`;
    const xDefault = alternateEn;

    const metaDescPlain = `${isGreek ? 'Ανακαλύψτε το ' + name : 'Discover ' + name} - ${cat} in ${loc}.`;
    const ogTitle = `${name} — Kala Nera Guide`;

    const otherNameRaw = isGreek
      ? (biz.Name && String(biz.Name).trim() && String(biz.Name).trim() !== String(name).trim()
          ? String(biz.Name).trim()
          : '')
      : (biz.Name_EL && String(biz.Name_EL).trim() && String(biz.Name_EL).trim() !== String(name).trim()
          ? String(biz.Name_EL).trim()
          : '');

    const schemaType = categoryToSchemaType(biz.Category);
    const tel = telForLd(biz.Phone);

    const breadcrumbLd = {
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: isGreek ? 'Αρχική' : 'Home',
          item: `${SITE_ORIGIN}/${ix}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name,
          item: pageUrl,
        },
      ],
    };

    const businessLd = {
      '@type': schemaType,
      '@id': `${pageUrl}#business`,
      name,
      ...(otherNameRaw ? { alternateName: otherNameRaw } : {}),
      image: imgSrc,
      url: pageUrl,
      description: metaDescPlain,
      address: {
        '@type': 'PostalAddress',
        addressLocality: locEn,
        addressRegion: 'Pelion',
        postalCode: '37010',
        addressCountry: 'GR',
      },
      ...(tel ? { telephone: tel } : {}),
      ...(websiteHref ? { sameAs: websiteHref } : {}),
    };

    /** Eén script: graph met twee nodes */
    const ldGraph = {
      '@context': 'https://schema.org',
      '@graph': [breadcrumbLd, businessLd],
    };

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <script async src="https://www.googletagmanager.com/gtag/js?id=${gtagId}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${gtagId}');
  </script>

  <title>${escapeHtml(name)} - ${escapeHtml(loc)} | Kala Nera Guide</title>
  <meta name="description" content="${escapeHtml(metaDescPlain)}">

  <link rel="canonical" href="${pageUrl}">
  <link rel="alternate" hreflang="en" href="${alternateEn}" />
  <link rel="alternate" hreflang="el" href="${alternateEl}" />
  <link rel="alternate" hreflang="x-default" href="${xDefault}" />

  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(metaDescPlain)}">
  <meta property="og:image" content="${escapeHtml(imgSrc)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Kala Nera Guide">
  <meta property="og:locale" content="${isGreek ? 'el_GR' : 'en_GB'}">
  <meta property="og:locale:alternate" content="${isGreek ? 'en_GB' : 'el_GR'}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(metaDescPlain)}">
  <meta name="twitter:image" content="${escapeHtml(imgSrc)}">

  <script type="application/ld+json">${jsonLdEmbed(ldGraph)}</script>

  <link rel="icon" type="image/png" href="../favicon.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
  <link rel="stylesheet" href="../style.css?v=${appVersion}">
</head>

<body class="detail-body">

  <header class="site-header">
    <nav class="main-nav">
      <div class="nav-container" style="justify-content: center;">
        <a href="../${escapeHtml(ix)}" class="logo">Kala <span>Nera</span></a>
      </div>
    </nav>
  </header>

  <div class="detail-container">
    <nav class="back-nav">
      <a href="../${escapeHtml(ix)}" class="back-button-glossy">${escapeHtml(backText)}</a>
    </nav>

    <main class="biz-card-detail">
      <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(name)}" class="detail-header-image">
      <div class="detail-content">
        <div class="detail-meta-container">
          <span class="detail-pill"><i class="fa fa-tag"></i> ${escapeHtml(cat)}</span>
          <span class="detail-pill" style="background:rgba(139,69,19,0.1); color:#8b4513;"><i class="fa fa-map-marker-alt"></i> ${escapeHtml(loc)}</span>
        </div>

        <h1 class="detail-title">${escapeHtml(name)}</h1>

        ${
          summary && summary.trim() !== '' && summary !== '-'
            ? `<div class="detail-description" style="margin-bottom: 20px; line-height: 1.6; color: #555; font-size: 1.05rem;">${summary}</div>`
            : ''
        }

        <div class="detail-contact-box">
          ${
            biz.Phone && String(biz.Phone).trim() !== '' && biz.Phone !== '-'
              ? `<p><i class="fa fa-phone"></i> <a href="tel:${escapeHtml(String(biz.Phone).trim())}">${escapeHtml(String(biz.Phone).trim())}</a></p>`
              : ''
          }
          ${
            biz.Email && String(biz.Email).trim() !== '' && biz.Email !== '-'
              ? `<p><i class="fa fa-envelope"></i> <a href="mailto:${escapeHtml(String(biz.Email).trim())}">${escapeHtml(String(biz.Email).trim())}</a></p>`
              : ''
          }
        </div>

        ${
          websiteHref
            ? `<a href="${escapeHtml(websiteHref)}" target="_blank" rel="noopener" class="btn-visit-glossy">
                 <i class="fa fa-external-link-alt"></i> ${escapeHtml(visitBtn)}
               </a>`
            : ''
        }
      </div>
    </main>
  </div>

  <footer class="site-footer">
    <div class="footer-container">
      <div class="footer-column">
        <h3>${escapeHtml(footerAboutTitle)}</h3>
        <p>${escapeHtml(footerAboutText)}</p>
      </div>

      <div class="footer-column">
        <h3>${escapeHtml(footerContactTitle)}</h3>
        <ul>
          <li><a href="mailto:info@spiti.tech"><i class="fa fa-envelope"></i> ${escapeHtml(footerContactTitle)}</a></li>
        </ul>
      </div>

      <div class="footer-column">
        <h3>${escapeHtml(footerFollowTitle)}</h3>
        <div class="social-icons">
          <a href="https://www.facebook.com/kalanera.info" target="_blank" rel="noopener" class="social-icon" aria-label="Facebook">
            <i class="fab fa-facebook-f"></i>
          </a>
        </div>
      </div>
    </div>

    <div style="margin-top: 15px; opacity: 0.6;">
      <a href="http://www.goatcounter.com" target="_blank" rel="noopener"
         style="text-decoration: none; color: inherit; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <img src="https://static.zgo.at/favicon/favicon-32x32.png" alt="GoatCounter" style="width: 16px; height: 16px;">
        <span style="font-size: 12px; font-family: sans-serif;">${escapeHtml(moreStats)}</span>
      </a>
    </div>

    <div class="footer-bottom">
      <p>${escapeHtml(footerCopyright)}</p>
    </div>
  </footer>

  <script data-goatcounter="https://evertvanlaar.cloud/count" async src="//gc.zgo.at/count.js"></script>

  <nav class="bottom-nav" aria-label="Primary">
    <div class="bottom-nav-inner">
      <a href="../${escapeHtml(ix)}"><i class="fa-solid fa-house"></i><span>${escapeHtml(tabHome)}</span></a>
      <a href="../wishlist${isGreek ? '-el' : ''}.html"><i class="fa-solid fa-heart"></i><span>${escapeHtml(tabFav)}</span></a>
      <a href="../t-form${isGreek ? '-el' : ''}.html"><i class="fa-solid fa-circle-plus"></i><span>${escapeHtml(tabAdd)}</span></a>
      <a href="#" data-more><i class="fa-solid fa-ellipsis"></i><span>${escapeHtml(tabMore)}</span></a>
    </div>
  </nav>

  <script>
    (function(){
      const moreBtn = document.querySelector('.bottom-nav a[data-more]');
      if (!moreBtn) return;

      const html = \`
        <section class="more-section">
          <h3>${escapeHtml(moreUseful)}</h3>
          <div class="more-links">
            <a href="tel:+302423086222"><span><i class="fa-solid fa-shield"></i> ${escapeHtml(isGreek ? 'Αστυνομία Μηλιές' : 'Police Office Milies')}</span><small>+30 24230 86222</small></a>
            <a href="tel:+302423022385"><span><i class="fa-solid fa-pills"></i> ${escapeHtml(isGreek ? 'Φαρμακείο Καλά Νερά' : 'Pharmacy Kala Nera')}</span><small>+30 24230 22385</small></a>
            <a href="tel:+302423022160"><span><i class="fa-solid fa-pills"></i> ${escapeHtml(isGreek ? 'Φαρμακείο Κάτω Γατζέα' : 'Pharmacy Kato Gatzea')}</span><small>+30 24230 22160</small></a>
            <a href="tel:+302423086666"><span><i class="fa-solid fa-user-doctor"></i> ${escapeHtml(isGreek ? 'Ιατρός Καλά Νερά' : 'Doctor Kala Nera')}</span><small>+30 24230 86666</small></a>
          </div>
        </section>

        <section class="more-section">
          <h3>${escapeHtml(moreInstallTitle)}</h3>
          <div class="more-links">
            <a href="../${escapeHtml(ix)}">
              <span><i class="fa fa-download"></i> ${escapeHtml(moreInstallBtn)}</span>
              <small>PWA</small>
            </a>
          </div>
        </section>

        <section class="more-section more-about">
          <h3>${escapeHtml(moreAbout)}</h3>
          <p>${escapeHtml(footerAboutText)}</p>
          <div class="more-links" style="margin-top:10px;">
            <a href="https://www.facebook.com/kalanera.info" target="_blank" rel="noopener">
              <span><i class="fab fa-facebook-f"></i> ${escapeHtml(moreFollow)}</span>
              <small>Facebook</small>
            </a>
            <a href="mailto:info@spiti.tech?">
              <span><i class="fa-solid fa-envelope"></i> ${escapeHtml(moreContact)}</span>
              <small>info@spiti.tech</small>
            </a>
            <a href="http://www.goatcounter.com" target="_blank" rel="noopener">
              <span><i class="fa-solid fa-chart-line"></i> ${escapeHtml(moreStats)}</span>
              <small>GoatCounter</small>
            </a>
          </div>

          <div class="more-links" style="margin-top:10px;">
            <div class="more-card is-meta">
              <div class="meta-row">
                <span>${escapeHtml(poweredBy)}: Kanteklik</span>
                <div class="meta-right">
                  <div class="meta-version"><code>v${escapeHtml(appVersion)}</code></div>
                </div>
              </div>
              <div class="copyright-row">
                <span class="copyright-text">© ${formattedCopyright}</span>
                <img class="meta-logo" src="../logo-72x72.png" alt="Kanteklik" width="28" height="28" loading="lazy">
              </div>
            </div>
          </div>
        </section>
      \`;

      function ensure() {
        let backdrop = document.getElementById('more-sheet-backdrop');
        let sheet = document.getElementById('more-sheet');

        if (!backdrop) {
          backdrop = document.createElement('div');
          backdrop.id = 'more-sheet-backdrop';
          backdrop.className = 'more-sheet-backdrop';
          backdrop.hidden = true;
          document.body.appendChild(backdrop);
        }

        if (!sheet) {
          sheet = document.createElement('section');
          sheet.id = 'more-sheet';
          sheet.className = 'more-sheet';
          sheet.hidden = true;
          sheet.setAttribute('role','dialog');
          sheet.setAttribute('aria-modal','true');
          sheet.innerHTML = \`
            <div class="more-sheet-handle" aria-hidden="true"></div>
            <header class="more-sheet-header">
              <div class="more-sheet-title"><i class="fa-solid fa-ellipsis"></i> ${escapeHtml(tabMore)}</div>
              <button type="button" class="more-sheet-close" id="more-sheet-close" aria-label="Close">✕</button>
            </header>
            <div class="more-sheet-content" id="more-sheet-content"></div>
          \`;
          document.body.appendChild(sheet);
        }

        return {backdrop, sheet};
      }

      function open() {
        if (window.innerWidth >= 992) return;
        const {backdrop, sheet} = ensure();
        const content = document.getElementById('more-sheet-content');
        if (content) content.innerHTML = html;

        backdrop.hidden = false;
        sheet.hidden = false;

        const close = () => {
          backdrop.hidden = true;
          sheet.hidden = true;
        };
        backdrop.onclick = close;
        const btn = document.getElementById('more-sheet-close');
        if (btn) btn.onclick = close;

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') close();
        }, { once:true });
      }

      moreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        open();
      });
    })();
  </script>

</body>
</html>`;
  };

  results.push({ json: { fileName: `business/${slug}.html`, htmlContent: generateHTML(biz.Name, false) } });
  results.push({
    json: {
      fileName: `business/${slug}-el.html`,
      htmlContent: generateHTML(biz.Name_EL || biz.Name, true),
    },
  });
}

return results;
