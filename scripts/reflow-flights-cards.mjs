import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const enRe =
  /<dl class="flights-card-grid">\s*<div><dt>Arrives<\/dt><dd>([^<]*)<\/dd><\/div>\s*<div><dt>Departs<\/dt><dd>([^<]*)<\/dd><\/div>\s*<div class="flights-card-span2"><dt>Season<\/dt><dd>([^<]*)<\/dd><\/div>\s*<\/dl>/g;

const elRe =
  /<dl class="flights-card-grid">\s*<div><dt>Άφιξη<\/dt><dd>([^<]*)<\/dd><\/div>\s*<div><dt>Αναχ\.<\/dt><dd>([^<]*)<\/dd><\/div>\s*<div class="flights-card-span2"><dt>Περίοδος<\/dt><dd>([^<]*)<\/dd><\/div>\s*<\/dl>/g;

function toMeta(repl, arr, isEl) {
  const [a, d, s] = arr;
  if (isEl) {
    return `<dl class="flights-card-meta">
                        <div class="flights-meta-pair">
                            <div class="flights-meta-bit">
                                <dt>Άφιξη</dt>
                                <dd>${a}</dd>
                            </div>
                            <div class="flights-meta-bit">
                                <dt>Αναχ.</dt>
                                <dd>${d}</dd>
                            </div>
                        </div>
                        <div class="flights-meta-season">
                            <dt>Περίοδος</dt>
                            <dd>${s}</dd>
                        </div>
                    </dl>`;
  }
  return `<dl class="flights-card-meta">
                        <div class="flights-meta-pair">
                            <div class="flights-meta-bit">
                                <dt>Arrives</dt>
                                <dd>${a}</dd>
                            </div>
                            <div class="flights-meta-bit">
                                <dt>Departs</dt>
                                <dd>${d}</dd>
                            </div>
                        </div>
                        <div class="flights-meta-season">
                            <dt>Season</dt>
                            <dd>${s}</dd>
                        </div>
                    </dl>`;
}

for (const name of ['flights.html', 'flights-el.html']) {
  const p = path.join(root, name);
  let s = fs.readFileSync(p, 'utf8');
  const isEl = name.includes('-el');
  const re = isEl ? elRe : enRe;
  s = s.replace(re, (...args) => {
    const m = args.slice(0, -2);
    const arr = [m[1], m[2], m[3]];
    return toMeta(null, arr, isEl);
  });
  fs.writeFileSync(p, s, 'utf8');
  console.log(name, (s.match(/flights-card-meta/g) || []).length);
}
