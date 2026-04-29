/**
 * n8n Code node: "Generate index SEO blocks" (één output-item met alle blokken)
 *
 * Invoer: zelfde rijen als je business-generator (Google Sheet / Merge), velden o.a.:
 *   Name, Name_EL, Category, Location, Phone, PhotoURL
 *
 * Uitvoer (json):
 *   schemaScript     — plakken tussen <!-- N8N_SCHEMA_START --> en <!-- N8N_SCHEMA_END --> in index.html / index-el.html (beide indexen delen dezelfde ItemList; één keer genereren)
 *   htmlSectionEN    — plakken tussen <!-- N8N_SEO_START --> en <!-- N8N_SEO_END --> in index.html
 *   htmlSectionEL    — idem in index-el.html
 *
 * Aliassen voor Sheet-kolommen: schema_ready, seo_list_en, seo_list_el (identiek)
 *
 * Kopieer de volledige inhoud naar je n8n workflow (geen import van dit bestand).
 */

const SITE_ORIGIN = 'https://www.kalanera.gr';

const LOC_DICT = {
  'Kala Nera': 'Καλά Νερά',
  'Kato Gatzea': 'Κάτω Γατζέα',
  'Ano Gatzea': 'Άνω Γατζέα',
  Koropi: 'Κορώπη',
  Milies: 'Μηλιές',
  Vizitsa: 'Βυζίτσα',
  Afissos: 'Αφήσσος',
};

const categoryLabelEN = {
  Camp: 'Camping & Caravan site',
  Drink: 'Bar & Café',
  Eat: 'Restaurant & Taverna',
  Other: 'Local Business',
  Rent: 'Rental Service',
  Shop: 'Local Shop & Boutique',
  Sleep: 'Hotel & Accommodation',
  Travel: 'Travel Agency & Tours',
};

const categoryLabelEL = {
  Camp: 'Κάμπινγκ',
  Drink: 'Μπαρ & Καφετέρια',
  Eat: 'Εστιατόριο & Ταβέρνα',
  Other: 'Τοπική Επιχείρηση',
  Rent: 'Υπηρεσία Ενοικίασης',
  Shop: 'Τοπικό Κατάστημα',
  Sleep: 'Ξενοδοχείο & Διαμονή',
  Travel: 'Ταξιδιωτικό Γραφείο',
};

const jsonLdEmbed = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/** Zelfde logica als app.js / n8n-business-page-template voor business-links */
const slugFromName = (name) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** Relatief pad → absolute onder SITE_ORIGIN (zoals template) */
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
    path = `pix/${path}`;
  }
  return `${SITE_ORIGIN}/${path}`;
};

const telForLd = (p) => {
  const s = String(p ?? '').trim();
  if (!s || s === '-') return '';
  return s;
};

const locEn = (locRaw) => String(locRaw ?? 'Kala Nera').trim() || 'Kala Nera';
const locEl = (locRaw) => LOC_DICT[locEn(locRaw)] ?? locEn(locRaw);

const rows = $input.all().map((i) => i.json).filter(Boolean);

const itemListElement = [];

const liFragmentsEN = [];
const liFragmentsEL = [];

let position = 0;
for (const biz of rows) {
  position += 1;
  const nameEN = String(biz.Name ?? '').trim();
  if (!nameEN) continue;

  const nameELDisplay = String(biz.Name_EL ?? biz.Name_el ?? '').trim() || nameEN;
  const slug = slugFromName(biz.Name);
  if (!slug) continue;

  const catKey = String(biz.Category ?? 'Other').trim() || 'Other';
  const fullCatEN = categoryLabelEN[catKey] ?? categoryLabelEN.Other;
  const fullCatEL = categoryLabelEL[catKey] ?? categoryLabelEL.Other;

  const locationEN = locEn(biz.Location);
  const locationEL = locEl(biz.Location);

  const tel = telForLd(biz.Phone);
  const pageEN = `${SITE_ORIGIN}/business/${slug}.html`;
  const pageEL = `${SITE_ORIGIN}/business/${slug}-el.html`;

  const lb = {
    '@type': 'LocalBusiness',
    name: nameEN,
    url: pageEN,
    image: absoluteAssetUrl(biz.PhotoURL),
    address: {
      '@type': 'PostalAddress',
      addressLocality: locationEN,
      addressRegion: 'Pelion',
      postalCode: '37010',
      addressCountry: 'GR',
    },
  };

  const altEl = String(biz.AlternateName_el ?? biz.AlternateName ?? '').trim();
  const useAlt =
    altEl && altEl !== nameEN ? altEl : nameELDisplay !== nameEN ? nameELDisplay : '';
  if (useAlt) lb.alternateName = useAlt;
  if (tel) lb.telephone = tel;

  itemListElement.push({
    '@type': 'ListItem',
    position,
    item: lb,
  });

  const phraseEN = `${escapeHtml(nameEN)} — ${fullCatEN} in ${escapeHtml(locationEN)}, Pelion.`;
  const phraseEL = `«${escapeHtml(nameELDisplay)}» · ${escapeHtml(fullCatEL)} · ${escapeHtml(locationEL)}, Πήλιο.`;

  /* Eén regel per <li>: geen echte newlines in de string — voorkomt verwarring met JSON-weergave \\n in n8n. */
  liFragmentsEN.push(
    `<li><h3 style="display:inline; font-size:inherit; margin:0;"><a href="${escapeHtml(pageEN)}">${escapeHtml(nameEN)}</a></h3><span> - ${phraseEN}</span></li>`,
  );

  liFragmentsEL.push(
    `<li><h3 style="display:inline; font-size:inherit; margin:0;"><a href="${escapeHtml(pageEL)}">${escapeHtml(nameELDisplay)}</a></h3><span> — ${phraseEL}</span></li>`,
  );
}

const itemListLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement,
};

/** Zonder voorloop-newlines — plak tussen N8N_SCHEMA markers; inhoud is geldige HTML/JSON. */
const schemaScript = `<script type="application/ld+json">${jsonLdEmbed(itemListLd)}</script>`;

const htmlSectionEN = `<section id="seo-directory" style="display:none;" aria-hidden="true"><h2>Local Businesses in Kala Nera</h2><ul>${liFragmentsEN.join('')}</ul></section>`;

const htmlSectionEL = `<section id="seo-directory" style="display:none;" aria-hidden="true"><h2>Επιχειρήσεις στα Καλά Νερά</h2><ul>${liFragmentsEL.join('')}</ul></section>`;

return [
  {
    json: {
      schemaScript,
      htmlSectionEN,
      htmlSectionEL,
      schema_ready: schemaScript,
      seo_list_en: htmlSectionEN,
      seo_list_el: htmlSectionEL,
    },
  },
];
