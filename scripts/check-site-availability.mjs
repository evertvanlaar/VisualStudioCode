#!/usr/bin/env node
/**
 * Run the same availability checks as external uptime monitors (see monitoring/monitors.json).
 *
 *   node scripts/check-site-availability.mjs
 *   node scripts/check-site-availability.mjs --json
 *   node scripts/check-site-availability.mjs --id business-json
 *
 * Exit 0 = all OK, 1 = at least one failure (suitable for CI or manual smoke test).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'monitoring', 'monitors.json');

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const onlyId = (() => {
  const i = args.indexOf('--id');
  return i >= 0 ? args[i + 1] : null;
})();

function loadConfig() {
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

function normalizeBusinessRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.rows)) return payload.rows;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return null;
}

function parseGeneratedAt(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const g = payload.generatedAt;
  if (!g) return null;
  const d = new Date(g);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ageHours(date) {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

async function runMonitor(monitor) {
  const started = Date.now();
  const result = {
    id: monitor.id,
    name: monitor.name,
    url: monitor.url,
    ok: true,
    errors: [],
    warnings: [],
    status: null,
    responseMs: null,
    rowCount: null,
    generatedAt: null,
    ageHours: null
  };

  const checks = monitor.checks || {};
  let body = '';
  let contentType = '';

  try {
    const res = await fetch(monitor.url, {
      headers: { Accept: 'application/json, text/html, */*' },
      signal: AbortSignal.timeout((checks.timeoutSeconds || 30) * 1000)
    });
    result.status = res.status;
    result.responseMs = Date.now() - started;
    contentType = res.headers.get('content-type') || '';
    body = await res.text();

    if (checks.status != null && res.status !== checks.status) {
      result.errors.push(`HTTP ${res.status} (verwacht ${checks.status})`);
    }
    if (checks.maxResponseMs != null && result.responseMs > checks.maxResponseMs) {
      result.warnings.push(`Traag: ${result.responseMs}ms (drempel ${checks.maxResponseMs}ms)`);
    }
    if (checks.contentTypeIncludes && !contentType.toLowerCase().includes(checks.contentTypeIncludes)) {
      result.warnings.push(`Content-Type mist "${checks.contentTypeIncludes}" (was: ${contentType || '(leeg)'})`);
    }
    if (Array.isArray(checks.bodyContains)) {
      for (const needle of checks.bodyContains) {
        if (!body.includes(needle)) {
          result.errors.push(`Body mist verwachte tekst: ${needle}`);
        }
      }
    }

    if (checks.json) {
      let payload;
      try {
        payload = JSON.parse(body.trim() || 'null');
      } catch (e) {
        result.errors.push(`Geen geldige JSON: ${e.message}`);
        payload = null;
      }
      if (payload != null) {
        const rows = normalizeBusinessRows(payload);
        if (rows) {
          result.rowCount = rows.length;
          if (checks.json.minRowCount != null && rows.length < checks.json.minRowCount) {
            result.errors.push(`Te weinig rijen: ${rows.length} (min ${checks.json.minRowCount})`);
          }
        } else if (checks.json.minRowCount != null) {
          result.errors.push('JSON heeft geen array of rows[]');
        }

        const gen = parseGeneratedAt(payload);
        if (gen) {
          result.generatedAt = gen.toISOString();
          result.ageHours = Math.round(ageHours(gen) * 10) / 10;
          if (checks.json.maxAgeHours != null && result.ageHours > checks.json.maxAgeHours) {
            result.errors.push(
              `JSON verouderd: ${result.ageHours}u geleden (max ${checks.json.maxAgeHours}u)`
            );
          }
        } else if (checks.json.maxAgeHours != null && payload && typeof payload === 'object') {
          result.warnings.push('generatedAt ontbreekt — versheid niet te controleren');
        }
      }
    }
  } catch (e) {
    result.responseMs = Date.now() - started;
    result.errors.push(e?.name === 'TimeoutError' ? 'Timeout' : (e?.message || String(e)));
  }

  result.ok = result.errors.length === 0;
  return result;
}

const config = loadConfig();
let monitors = config.monitors || [];
if (onlyId) {
  monitors = monitors.filter((m) => m.id === onlyId);
  if (!monitors.length) {
    console.error(`Onbekende monitor id: ${onlyId}`);
    process.exit(1);
  }
}

const results = [];
for (const monitor of monitors) {
  results.push(await runMonitor(monitor));
}

const failed = results.filter((r) => !r.ok);
const warned = results.filter((r) => r.ok && r.warnings.length > 0);

if (jsonOut) {
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    summary: { total: results.length, failed: failed.length, warned: warned.length },
    results
  }, null, 2));
} else {
  console.log(`Kalanera availability — ${results.length} monitor(s)\n`);
  for (const r of results) {
    const icon = r.ok ? (r.warnings.length ? '⚠' : '✓') : '✗';
    const bits = [`${icon} ${r.name}`, r.status != null ? `HTTP ${r.status}` : 'geen response'];
    if (r.responseMs != null) bits.push(`${r.responseMs}ms`);
    if (r.rowCount != null) bits.push(`${r.rowCount} rijen`);
    if (r.ageHours != null) bits.push(`${r.ageHours}u oud`);
    console.log(bits.join(' · '));
    for (const err of r.errors) console.log(`    ERROR: ${err}`);
    for (const w of r.warnings) console.log(`    WARN:  ${w}`);
  }
  console.log('');
  if (failed.length) {
    console.log(`FAILED: ${failed.length}/${results.length}`);
  } else if (warned.length) {
    console.log(`OK met waarschuwingen: ${warned.length}/${results.length}`);
  } else {
    console.log('ALL OK');
  }
  console.log(`\nConfig: monitoring/monitors.json · Setup: docs/uptime-monitoring.md`);
}

process.exit(failed.length ? 1 : 0);
