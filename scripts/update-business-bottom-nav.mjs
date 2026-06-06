import fs from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = process.cwd();
const BUSINESS_DIR = path.join(REPO_ROOT, "business");

function isGreekFile(filename) {
  return filename.toLowerCase().endsWith("-el.html");
}

function ensureBusTabInBottomNav(html, { isGreek }) {
  const navStart = html.indexOf('<nav class="bottom-nav"');
  if (navStart === -1) return { html, changed: false, reason: "no bottom-nav" };

  const navEnd = html.indexOf("</nav>", navStart);
  if (navEnd === -1) return { html, changed: false, reason: "bottom-nav missing </nav>" };

  const beforeNav = html.slice(0, navStart);
  const navBlock = html.slice(navStart, navEnd + "</nav>".length);
  const afterNav = html.slice(navEnd + "</nav>".length);

  // Only touch the inner wrapper
  const innerOpen = '<div class="bottom-nav-inner">';
  const innerStart = navBlock.indexOf(innerOpen);
  if (innerStart === -1) return { html, changed: false, reason: "no bottom-nav-inner" };

  const innerContentStart = innerStart + innerOpen.length;
  const innerClose = "</div>";
  const innerEnd = navBlock.indexOf(innerClose, innerContentStart);
  if (innerEnd === -1) return { html, changed: false, reason: "bottom-nav-inner missing </div>" };

  const inner = navBlock.slice(innerContentStart, innerEnd);

  // Skip if already present
  if (/href="\.\.\/bus(?:-el)?\.html"/i.test(inner)) {
    return { html, changed: false, reason: "already has bus tab" };
  }

  // Find the first anchor (Home) and insert after it.
  const firstAnchorEnd = inner.indexOf("</a>");
  if (firstAnchorEnd === -1) return { html, changed: false, reason: "no anchors in bottom-nav-inner" };

  const insertPos = firstAnchorEnd + "</a>".length;
  const busHref = isGreek ? "../bus-el.html" : "../bus.html";
  const busLabel = isGreek ? "Λεωφορείο" : "Bus";

  // Keep indentation similar to existing files (2 spaces in most business pages).
  const insertion = `\n      <a href="${busHref}"><i class="fa-solid fa-bus"></i><span>${busLabel}</span></a>`;

  const newInner = inner.slice(0, insertPos) + insertion + inner.slice(insertPos);
  const newNavBlock =
    navBlock.slice(0, innerContentStart) +
    newInner +
    navBlock.slice(innerEnd);

  return { html: beforeNav + newNavBlock + afterNav, changed: true, reason: "inserted" };
}

function removeBusFromInlineMoreMenu(html) {
  // Remove the "Bus (Kala Nera)" section from the inline More menu HTML on legacy business pages.
  // We match the section by its header + TODAY/ΣΗΜΕΡΑ marker to avoid touching footer/header nav links.
  const re =
    /<section class="more-section">\s*<h3>\s*(Bus\s*\(Kala Nera\)|Λεωφορείο\s*\(Καλά\s*Νερά\))\s*<\/h3>[\s\S]*?<small>\s*(TODAY|ΣΗΜΕΡΑ)\s*<\/small>[\s\S]*?<\/section>\s*/i;
  const next = html.replace(re, "");
  return { html: next, changed: next !== html };
}

async function main() {
  let files;
  try {
    files = await fs.readdir(BUSINESS_DIR);
  } catch (e) {
    console.error(`Cannot read directory: ${BUSINESS_DIR}`);
    console.error(e);
    process.exitCode = 1;
    return;
  }

  const htmlFiles = files.filter((f) => f.toLowerCase().endsWith(".html"));
  let changedCount = 0;
  let skippedCount = 0;

  for (const file of htmlFiles) {
    const fullPath = path.join(BUSINESS_DIR, file);
    const src = await fs.readFile(fullPath, "utf8");
    const { html: withTab, changed: tabChanged, reason } = ensureBusTabInBottomNav(src, {
      isGreek: isGreekFile(file),
    });
    const { html: out, changed: moreChanged } = removeBusFromInlineMoreMenu(withTab);

    const changed = tabChanged || moreChanged;
    if (!changed) {
      skippedCount++;
      continue;
    }

    await fs.writeFile(fullPath, out, "utf8");
    changedCount++;
    const flags = [tabChanged ? "tab" : null, moreChanged ? "more" : null].filter(Boolean).join("+");
    // eslint-disable-next-line no-console
    console.log(`updated: business/${file} (${flags || reason})`);
  }

  // eslint-disable-next-line no-console
  console.log(`done. changed=${changedCount} skipped=${skippedCount} total=${htmlFiles.length}`);
}

await main();

