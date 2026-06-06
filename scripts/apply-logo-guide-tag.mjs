/**
 * Apply logo--with-tag + "Guide" (Kalam) to all static HTML headers.
 * Skips files that already have logo--with-tag.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const REPLACEMENTS = [
  {
    from: '<a href="../index.html" class="logo">Kala <span>Nera</span></a>',
    to: `<a href="../index.html" class="logo logo--with-tag" aria-label="Kala Nera Guide — home">
        <span class="logo-main">Kala <span>Nera</span></span>
        <span class="logo-tag" aria-hidden="true">Guide</span>
      </a>`,
  },
  {
    from: '<a href="index.html" class="logo">Kala <span>Nera</span></a>',
    to: `<a href="index.html" class="logo logo--with-tag" aria-label="Kala Nera Guide — home">
                <span class="logo-main">Kala <span>Nera</span></span>
                <span class="logo-tag" aria-hidden="true">Guide</span>
            </a>`,
  },
  {
    from: '<a href="../index-el.html" class="logo">Καλά <span>Νερά</span></a>',
    to: `<a href="../index-el.html" class="logo logo--with-tag" aria-label="Οδηγός Καλών Νερών — αρχική">
        <span class="logo-main">Καλά <span>Νερά</span></span>
        <span class="logo-tag" aria-hidden="true">Guide</span>
      </a>`,
  },
  {
    from: '<a href="index-el.html" class="logo">Καλά <span>Νερά</span></a>',
    to: `<a href="index-el.html" class="logo logo--with-tag" aria-label="Οδηγός Καλών Νερών — αρχική">
                <span class="logo-main">Καλά <span>Νερά</span></span>
                <span class="logo-tag" aria-hidden="true">Guide</span>
            </a>`,
  },
];

async function walkHtmlFiles(dir, acc = []) {
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) await walkHtmlFiles(p, acc);
    else if (ent.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

async function main() {
  const files = await walkHtmlFiles(ROOT);
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    if (path.basename(file) === 'offline.html') continue;
    let html = await fs.readFile(file, 'utf8');
    if (html.includes('logo--with-tag')) {
      skipped++;
      continue;
    }
    let changed = false;
    for (const { from, to } of REPLACEMENTS) {
      if (html.includes(from)) {
        html = html.replace(from, to);
        changed = true;
      }
    }
    if (changed) {
      await fs.writeFile(file, html, 'utf8');
      updated++;
      console.log('updated', path.relative(ROOT, file));
    }
  }

  console.log(`apply-logo-guide-tag: ${updated} updated, ${skipped} already had tag`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
