# -*- coding: utf-8 -*-
"""Repair double-encoded UTF-8 in app.js from commit 822ee0d."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = ROOT / "_extract_bad.js"
out = ROOT / "app.js"


def repair_text(text: str) -> str:
    try:
        return text.encode("latin-1").decode("utf-8")
    except UnicodeEncodeError:
        # Fall back: repair line by line
        lines = []
        for line in text.splitlines(keepends=True):
            try:
                lines.append(line.encode("latin-1").decode("utf-8"))
            except UnicodeEncodeError:
                lines.append(line)
        return "".join(lines)


def main():
    text = src.read_text(encoding="utf-8")
    fixed = repair_text(text)
    # Version bump for encoding fix release
    fixed = fixed.replace("const APP_VERSION = '3.1.36';", "const APP_VERSION = '3.1.37';")
    fixed = fixed.replace("const APP_VERSION = '3.1.22';", "const APP_VERSION = '3.1.37';")
    out.write_text(fixed, encoding="utf-8", newline="\n")
    checks = [
        ("Περισσότερα", "Περισσότερα" in fixed),
        ("more close", "✕</button>" in fixed),
        ("copyright regex", "/^\\s*©+\\s*/g" in fixed or "©+\\s*/g" in fixed),
        ("no mojibake tip", "Î£Ï…Î¼Î²" not in fixed),
        ("version", "3.1.37" in fixed),
        ("Font Awesome weather", "fa-solid fa-sun" in fixed),
        ("resolveInstallSituation", "async function resolveInstallSituation" in fixed),
        ("getInstallAwarenessHtml", "function getInstallAwarenessHtml" in fixed),
    ]
    for name, ok in checks:
        print(f"{'OK' if ok else 'FAIL'}: {name}")
    if not all(ok for _, ok in checks):
        raise SystemExit(1)
    print(f"Wrote {out} ({len(fixed)} chars)")


if __name__ == "__main__":
    main()
