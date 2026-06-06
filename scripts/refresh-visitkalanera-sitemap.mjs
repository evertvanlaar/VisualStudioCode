#!/usr/bin/env node
/**
 * Haal page-sitemap.xml van visitkalanera.gr op en schrijf een lokale snapshot.
 * Bedoeld voor GitHub Actions (neutraal IP) — NIET vanaf n8n.vanlaar.cloud.
 *
 *   node scripts/refresh-visitkalanera-sitemap.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SITEMAP_URL = 'https://visitkalanera.gr/page-sitemap.xml';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'visitkalanera-sitemap.json');

const CATEGORY_HUBS = new Set([
  'tavernes', 'hotels', 'cafe', 'market', 'farmakeia', 'taxidiotika-grafeia',
  'enikiazomena-diamerismata', 'koureia', 'gymnatiria', 'periptera', 'genikes-epixeiriseis',
  'rentals', 'water-sports',
]);

const SKIP_SLUGS = new Set([
  ...CATEGORY_HUBS,
  'about-us', 'contact', 'gallery', 'member', 'useful-links', 'blogs', 'blog',
  'cart', 'checkout', 'shop', 'my-account', 'tours', 'tours-grid', 'tours-list', 'destination',
  'home-layout-1', 'home-layout-2', 'home-layout-3', 'home-layout-4', 'sample-page', 'sample-page-2',
  'anamnistika-dwra', 'en',
]);

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0370-\u03ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugFromUrl(url) {
  const pathPart = new URL(url).pathname.replace(/^\/|\/$/g, '');
  if (!pathPart) return '';
  return pathPart.includes('/') ? pathPart.split('/').pop() : pathPart;
}

function slugToTitle(slug) {
  try {
    return decodeURIComponent(slug).replace(/[-_]+/g, ' ').trim();
  } catch {
    return slug.replace(/[-_]+/g, ' ').trim();
  }
}

const res = await fetch(SITEMAP_URL, {
  headers: {
    Accept: 'text/xml, application/xml, */*',
    'User-Agent': 'Mozilla/5.0 (compatible; SitemapReader/1.0)',
  },
});

if (!res.ok) {
  console.error('HTTP', res.status, SITEMAP_URL);
  process.exit(1);
}

const xml = await res.text();
const lastmodMatch = xml.match(/<lastmod>([^<]+)<\/lastmod>/i);
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());

const pages = [];
const seen = new Set();
for (const url of urls) {
  if (!url.includes('visitkalanera.gr') || url.includes('/en/')) continue;
  const slug = slugFromUrl(url);
  if (!slug || SKIP_SLUGS.has(slug)) continue;
  const title = slugToTitle(slug);
  if (!title || seen.has(url)) continue;
  seen.add(url);
  pages.push({ title, url, slug, normTitle: norm(title) });
}

const payload = {
  generatedAt: new Date().toISOString(),
  sitemapLastmod: lastmodMatch?.[1] ?? null,
  urlCount: pages.length,
  pages,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`OK ${OUT} — ${pages.length} pagina-URL's`);
