/**
 * n8n — Code node (JavaScript): filter bus sheet rows for Kala Nera site
 *
 * Workflow (voorbeeld):
 *   1. Webhook (GET) — path bv. /webhook/bus-schedule
 *   2. Google Sheets — Read rows (alle kolommen doorgeven)
 *   3. Deze Code node — input = output van Sheets
 *
 * Pas de node-naam aan als jouw Webhook anders heet:
 *   const query = $('Webhook').first().json.query || {};
 *
 * Webhook query params (zoals frontend):
 *   - dir     — verplicht door browser; slug: volos|milies|argalasti|afissos|vyzitsa|pinakates|siki|promiri|katigiorgis|milina|platanias|trikeri
 *   - from    — optioneel (browser stuurt "Kala Nera")
 *   - remaining — "1" = alleen rijen met tijd >= nu vandaag (Europe/Athens); "0" of leeg = volledige lijst voor die dir
 *
 * Days-kolom (sheet): weekdays | daily | weekend (ook legacy 1-5, 1-6, 1-7, 7).
 * Time_KalaNera = verwachte tijd op de halte hoofdweg Kala Nera.
 *
 * Response: array items { json: row } — zelfde velden als sheet + doorrekenen voor debug optioneel.
 */

const WEBHOOK_NODE_NAME = 'Webhook';

// Zelfde bestemmingen als app.js BUS_VALID_DIRS
const VALID_DIRS = [
  'volos', 'milies', 'argalasti', 'afissos',
  'vyzitsa', 'pinakates', 'siki', 'promiri', 'katigiorgis', 'milina', 'platanias', 'trikeri',
];

const BUS_DIR_LABELS = {
  volos: { en: 'Volos', el: 'Βόλος' },
  milies: { en: 'Milies', el: 'Μηλιές' },
  argalasti: { en: 'Argalasti', el: 'Αργαλαστή' },
  afissos: { en: 'Afissos', el: 'Αφήσσος' },
  vyzitsa: { en: 'Vyzitsa', el: 'Βυζίτσα' },
  pinakates: { en: 'Pinakates', el: 'Πινακάτες' },
  siki: { en: 'Siki', el: 'Σήκι' },
  promiri: { en: 'Promiri', el: 'Προμήρι' },
  katigiorgis: { en: 'Katigiorgis', el: 'Κατηγιώργης' },
  milina: { en: 'Milina', el: 'Μηλίνα' },
  platanias: { en: 'Platanias', el: 'Πλατανιάς' },
  trikeri: { en: 'Trikeri', el: 'Τρίκερι' },
};

const TYPO = { vizitsa: 'vyzitsa', pinakes: 'pinakates' };

function fold(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenToSlug(token) {
  const raw = String(token || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (VALID_DIRS.includes(lower)) return lower;
  const f = fold(raw);
  if (TYPO[f] && VALID_DIRS.includes(TYPO[f])) return TYPO[f];
  for (const slug of VALID_DIRS) {
    if (fold(slug) === f) return slug;
    const row = BUS_DIR_LABELS[slug];
    if (row && (fold(row.en) === f || fold(row.el) === f)) return slug;
  }
  return '';
}

function parseRawToSlugs(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((t) => tokenToSlug(String(t))).filter(Boolean))];
  }
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        return [...new Set(arr.map((t) => tokenToSlug(String(t))).filter(Boolean))];
      }
    } catch (e) { /* CSV */ }
  }
  return [...new Set(s.split(/[,;|]/).map((p) => tokenToSlug(p.trim())).filter(Boolean))];
}

function parseDirsServed(row) {
  const slugCol = row.dirs_served ?? row.Dirs_Served;
  const nameCol = row.Destinations_Served ?? row.destinations_served;
  const slugStr = slugCol != null ? String(slugCol).trim() : '';
  const nameStr = nameCol != null ? String(nameCol).trim() : '';
  const raw = slugStr ? slugCol : (nameStr ? nameCol : null);
  return parseRawToSlugs(raw);
}

function parseTimeToMinutes(hhmm) {
  const m = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function athensTodayNum() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Athens',
    weekday: 'short',
  }).formatToParts(new Date());
  const wd = (parts.find((p) => p.type === 'weekday')?.value || '').toLowerCase();
  const wdMap = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
  return wdMap[wd.slice(0, 3)] || null;
}

function matchesDays(daysValue, todayNum) {
  const raw = String(daysValue || '').trim();
  if (!raw) return true;
  if (!todayNum) return true;
  const days = raw.toLowerCase();
  if (days === 'daily') return true;
  if (days === 'weekdays') return todayNum >= 1 && todayNum <= 5;
  if (days === 'weekend') return todayNum === 6 || todayNum === 7;
  if (days === '1-7') return true;
  if (days === '1-5') return todayNum <= 5;
  if (days === '1-6') return todayNum <= 6;
  if (days === '7') return todayNum === 7;
  if (/^[1-7]$/.test(days)) return Number(days) === todayNum;
  return true;
}

function nowAthensMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Athens',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const map = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') map[p.type] = p.value;
  });
  return parseTimeToMinutes(`${map.hour}:${map.minute}`);
}

// --- n8n entry ---
let query = {};
try {
  query = $(WEBHOOK_NODE_NAME).first().json.query || {};
} catch (e) {
  query = {};
}

let requestedDir = String(query.dir || 'volos').toLowerCase().trim();
if (!VALID_DIRS.includes(requestedDir)) {
  requestedDir = 'volos';
}

const remaining = String(query.remaining || '0') === '1';
const nowMin = nowAthensMinutes();
const todayNum = athensTodayNum();

const items = $input.all();
const out = [];

for (const item of items) {
  const row = item.json || {};
  if (!matchesDays(row.Days ?? row.days, todayNum)) continue;
  const slugs = parseDirsServed(row);

  // Geconsolideerde rij: dir moet in lijst zitten
  if (slugs.length > 0) {
    if (!slugs.includes(requestedDir)) continue;
  } else {
    // Legacy: enkele dir op de rij
    const rowDir = String(row.dir || row.Direction || row.Route || '').toLowerCase().trim();
    if (rowDir && VALID_DIRS.includes(rowDir)) {
      if (rowDir !== requestedDir) continue;
    } else {
      // Geen dir en geen lijst — overslaan of doorlaten: veiliger overslaan
      continue;
    }
  }

  const depRaw = row.Time_KalaNera || row.departure || row.Departure || row.Time || '';
  if (remaining) {
    const depMin = parseTimeToMinutes(String(depRaw).trim());
    if (depMin == null || nowMin == null) continue;
    if (depMin < nowMin) continue;
  }

  // Doorgeven: platte velden zoals sheet / frontend verwacht
  out.push({
    json: {
      ...row,
      // expliciet (handig als Sheets andere casing heeft)
      Time_KalaNera: row.Time_KalaNera ?? depRaw,
      Destinations_Served: row.Destinations_Served,
      dirs_served: row.dirs_served,
      Route_Name: row.Route_Name,
      Category: row.Category,
      Days: row.Days,
      Note_EN: row.Note_EN,
      Note_GR: row.Note_GR,
      Trip_ID: row.Trip_ID,
      ID: row.ID,
    },
  });
}

return out;
