const tz = 'Europe/Athens';

const VALID_DIRS = [
  'volos', 'milies', 'argalasti', 'afissos',
  'vyzitsa', 'pinakates', 'siki', 'promiri', 'katigiorgis', 'milina', 'platanias', 'trikeri',
];

const BUS_DIR_LABELS = {
  volos: { en: 'Volos', el: 'Βόλος' },
  milies: { en: 'Milies', el: 'Μηλιές' },
  argalasti: { en: 'Argalasti', el: 'Αργαλαστή' },
  afissos: { en: 'Afissos', el: 'Άφησσος' },
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

function normSheetKey(k) {
  return String(k || '')
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/** Kolom vinden ongeacht casing, spaties rond header, BOM (Sheets / n8n-export). */
function sheetField(row, aliases) {
  if (!row || typeof row !== 'object') return undefined;
  const wanted = new Set(aliases.map((a) => normSheetKey(a)));
  for (const key of Object.keys(row)) {
    if (key === '_busQuery') continue;
    if (wanted.has(normSheetKey(key))) return row[key];
  }
  return undefined;
}

/** Query zit op elk item via Set-node `_busQuery` (geen $node in Function). */
function getQuery(items) {
  const j0 = items[0] && items[0].json;
  const q = (j0 && (j0._busQuery ?? j0.busQuery)) || {};
  const dirRaw = (q.dir || 'volos').toString().toLowerCase().trim();
  const dir = VALID_DIRS.includes(dirRaw) ? dirRaw : 'volos';
  return {
    from: (q.from || 'Kala Nera').toString(),
    dir,
    remaining: (q.remaining || '1').toString() !== '0',
    minutesEarly: Number(q.minutesEarly ?? 10) || 10,
    apiKey: (q.key || '').toString(),
  };
}

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

/** Curly quotes uit Sheets / copy-paste breken JSON.parse — eerst naar ASCII quotes. */
function normalizeJsonQuotes(s) {
  return String(s || '')
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'");
}

/** Sheet kan dirs_served als JSON-string in cel zetten: ["milies","vyzitsa","pinakates"] */
function parseRawToSlugs(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((t) => tokenToSlug(String(t))).filter(Boolean))];
  }
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(normalizeJsonQuotes(s));
      if (Array.isArray(arr)) {
        return [...new Set(arr.map((t) => tokenToSlug(String(t))).filter(Boolean))];
      }
    } catch (e) { /* val terug op CSV */ }
  }
  return [...new Set(s.split(/[,;|]/).map((p) => tokenToSlug(p.trim())).filter(Boolean))];
}

function parseDirsServed(row) {
  const slugCol = sheetField(row, ['dirs_served', 'Dirs_Served', 'dirsserved']) ?? row.dirs_served ?? row.Dirs_Served;
  const nameCol = sheetField(row, ['destinations_served', 'Destinations_Served']) ?? row.Destinations_Served ?? row.destinations_served;
  const slugStr = slugCol != null ? String(slugCol).trim() : '';
  const nameStr = nameCol != null ? String(nameCol).trim() : '';
  let slugs = slugStr ? parseRawToSlugs(slugCol) : [];
  if (!slugs.length && nameStr) slugs = parseRawToSlugs(nameCol);
  return slugs;
}

function rowMatchesDirLegacy(row, dir) {
  const d = String(
    sheetField(row, ['dir', 'direction', 'route']) ?? row.dir ?? row.Direction ?? row.Route ?? '',
  ).toLowerCase().trim();
  if (d && VALID_DIRS.includes(d)) return d === dir;
  const dest = String(sheetField(row, ['destination', 'Destination']) ?? row.destination ?? row.Destination ?? '').toLowerCase();
  const labels = BUS_DIR_LABELS[dir];
  if (!labels) return false;
  if (dest.includes(labels.en.toLowerCase())) return true;
  if (dest.includes(fold(labels.el))) return true;
  const fe = fold(labels.en);
  const fel = fold(labels.el);
  const routeName = fold(sheetField(row, ['route_name', 'Route_Name']) ?? row.Route_Name ?? row.route_name ?? '');
  if (routeName && (routeName.includes(fe) || routeName.includes(fel))) return true;
  const destServed = fold(sheetField(row, ['destinations_served']) ?? row.Destinations_Served ?? row.destinations_served ?? '');
  if (destServed && (destServed.includes(fe) || destServed.includes(fel))) return true;
  return false;
}

function rowMatchesDir(row, dir) {
  const slugs = parseDirsServed(row);
  if (slugs.length > 0) return slugs.includes(dir);
  return rowMatchesDirLegacy(row, dir);
}

function depTime(row) {
  return sheetField(row, ['time_kalanera', 'Time_KalaNera', 'departure', 'Departure', 'Time'])
    ?? row.Time_KalaNera ?? row.departure ?? row.Departure ?? row.Time ?? '';
}

function stripBusQuery(row) {
  const o = { ...row };
  delete o._busQuery;
  return o;
}

function athensNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);
  const map = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const wd = (map.weekday || '').toLowerCase();
  const wdMap = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
  return {
    ymd: `${map.year}-${map.month}-${map.day}`,
    hm: `${map.hour}:${map.minute}`,
    todayNum: wdMap[wd.slice(0, 3)] || null,
  };
}

function parseHHMMToMinutes(hhmm) {
  const m = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function matchesDays(daysValue, todayNum) {
  const raw = String(daysValue || '').trim();
  if (!raw) return true;
  if (!todayNum) return true;
  const days = raw.toLowerCase();
  // Sheet model (Engels): weekdays | daily | weekend
  if (days === 'daily') return true;
  if (days === 'weekdays') return todayNum >= 1 && todayNum <= 5;
  if (days === 'weekend') return todayNum === 6 || todayNum === 7;
  // Legacy numeriek
  if (days === '1-7') return true;
  if (days === '1-5') return todayNum <= 5;
  if (days === '1-6') return todayNum <= 6;
  if (days === '7') return todayNum === 7;
  if (/^[1-7]$/.test(days)) return Number(days) === todayNum;
  return true;
}

const q = getQuery(items);
const now = athensNowParts();
const nowMin = parseHHMMToMinutes(now.hm);
const cutoff = nowMin == null ? null : Math.max(0, nowMin - q.minutesEarly);

const rawRows = items.map((i) => stripBusQuery(i.json));

const filtered = rawRows
  .filter((raw) => {
    const daysVal = sheetField(raw, ['days', 'Days']) ?? raw.Days ?? raw.days;
    if (!matchesDays(daysVal, now.todayNum)) return false;
    if (!rowMatchesDir(raw, q.dir)) return false;
    if (q.remaining && cutoff != null) {
      const depMin = parseHHMMToMinutes(String(depTime(raw)).trim());
      if (depMin == null) return false;
      if (depMin < cutoff) return false;
    }
    return true;
  })
  .sort((a, b) => {
    const am = parseHHMMToMinutes(String(depTime(a)).trim());
    const bm = parseHHMMToMinutes(String(depTime(b)).trim());
    if (am == null && bm == null) return 0;
    if (am == null) return 1;
    if (bm == null) return -1;
    return am - bm;
  });

return [
  {
    json: {
      meta: {
        tz,
        now: { ymd: now.ymd, hm: now.hm, todayNum: now.todayNum },
        query: {
          from: q.from,
          dir: q.dir,
          remaining: q.remaining,
          minutesEarly: q.minutesEarly,
        },
        generatedAt: new Date().toISOString(),
      },
      items: filtered,
    },
  },
];
