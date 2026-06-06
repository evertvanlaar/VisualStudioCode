/**
 * Inject locales/bus-strings.json into app.js as BUS_UI_STRINGS_EMBEDDED (offline / fetch-fallback).
 *
 * Usage (repo root): node scripts/sync-bus-ui-strings.mjs
 *
 * Keeps single source of truth: locales/bus-strings.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const jsonPath = path.join(root, 'locales', 'bus-strings.json');
const appPath = path.join(root, 'app.js');

const START = '// <sync-bus-ui-strings>';
const END = '// </sync-bus-ui-strings>';

const raw = fs.readFileSync(jsonPath, 'utf8');
const parsed = JSON.parse(raw);
if (!parsed.busStrings || !parsed.busStrings.en || !parsed.busStrings.el) {
  throw new Error('bus-strings.json: missing busStrings.en / busStrings.el');
}

const embedded = JSON.stringify(parsed.busStrings, null, 2);

const block = `${START}
const BUS_UI_STRINGS_EMBEDDED = ${embedded};
${END}`;

let app = fs.readFileSync(appPath, 'utf8');
if (!app.includes(START) || !app.includes(END)) {
  throw new Error(`app.js: missing markers ${START} ... ${END}`);
}
const re = /\/\/ <sync-bus-ui-strings>[\s\S]*?\/\/ <\/sync-bus-ui-strings>/;
if (!re.test(app)) {
  throw new Error('app.js: could not match sync-bus-ui-strings block');
}
app = app.replace(re, block);
fs.writeFileSync(appPath, app, 'utf8');
console.log('sync-bus-ui-strings: OK → embedded busStrings from locales/bus-strings.json');
