#!/usr/bin/env node
/**
 * Haal verse bedrijven op via n8n webhook en werk snapshots bij.
 * Gebruik na nieuwe rijen in Google Sheets (vóór lokale JSON-test).
 *
 *   node scripts/refresh-local-businesses-snapshot.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const WEBHOOK_URL = 'https://n8n.vanlaar.cloud/webhook/local-businesses';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  path.join(root, 'dev', 'local-businesses.json'),
  path.join(root, 'data', 'local-businesses.json'),
];

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.rows)) return payload.rows;
  if (payload && Array.isArray(payload.data)) return payload.data;
  throw new Error('Onverwacht webhook-formaat (geen array of rows[])');
}

const res = await fetch(WEBHOOK_URL, { headers: { Accept: 'application/json' } });
const text = await res.text();
if (!res.ok) {
  console.error('Webhook HTTP', res.status, text.slice(0, 500));
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(text.trim() || '[]');
} catch (e) {
  console.error('Geen geldige JSON van webhook:', e.message);
  process.exit(1);
}

const rows = normalizeRows(payload);
const json = JSON.stringify(rows, null, 0) + '\n';

for (const dest of targets) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, json, 'utf8');
  console.log('Written:', dest);
}

const other = rows.filter((b) => String(b.Category || '').toLowerCase() === 'other');
const makry = rows.find((b) => /makrygiannis/i.test(String(b.Name || '')));
console.log('Rows:', rows.length);
console.log('Other:', other.length, other.map((b) => b.Name).join(', ') || '(none)');
console.log('Makrygiannis:', makry ? `${makry.Name} (${makry.Status})` : 'NOT in webhook response');
console.log('Test: index.html?bizData=json');
