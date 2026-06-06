# -*- coding: utf-8 -*-
"""Merge install/TWA changes from 822ee0d into good app.js without mojibake."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GOOD = ROOT / "app.js"
BAD = ROOT / "_extract_bad.js"


def fix_line(line: str) -> str:
    try:
        return line.encode("latin-1").decode("utf-8")
    except UnicodeError:
        return line


def fix_block(text: str) -> str:
    return "".join(fix_line(l) for l in text.splitlines(keepends=True))


def line_index(lines, needle, start=0):
    for i in range(start, len(lines)):
        if needle in lines[i]:
            return i
    raise ValueError(f"not found: {needle!r}")


def main():
    good = GOOD.read_text(encoding="utf-8").splitlines(keepends=True)
    bad = BAD.read_text(encoding="utf-8").splitlines(keepends=True)

    # Good: replace from isAppStandalone through end of resolveInstallGuidanceScenario
    g_start = line_index(good, "function isAppStandalone()")
    g_end = line_index(good, "function useMagazineCardLayout()")

    # Bad: from TWA constants through resolveGuidanceWhenNoInstallPrompt + showInstallGuidance
    b_start = line_index(bad, "const TWA_ANDROID_PACKAGE")
    b_end = line_index(bad, "function useMagazineCardLayout()")

    block = fix_block("".join(bad[b_start:b_end]))

    # Prefer good getInstallGuidance (correct em dashes / Greek) but keep new scenarios from bad
    g_guid_start = line_index(good, "function getInstallGuidance(scenario)")
    g_guid_end = line_index(good, "function resolveInstallGuidanceScenario()")
    good_guidance = "".join(good[g_guid_start:g_guid_end])

    # Inject extra scenarios into good guidance (EN + EL) before closing `};` of copy objects
    extra_el = fix_block("""        runningTwa: {
            title: 'Χρησιμοποιείτε ήδη την εφαρμογή από το Google Play.',
            steps: ['Την επόμενη φορά ανοίξτε την από το μενού εφαρμογών του κινητού.']
        },
        runningPwa: {
            title: 'Χρησιμοποιείτε ήδη την εφαρμογή από την αρχική οθόνη.',
            steps: ['Την επόμενη φορά ανοίξτε την από το εικονίδιο Kala Nera.']
        },
        browserPlayInstalled: {
            title: 'Η εφαρμογή είναι ήδη εγκατεστημένη μέσω Google Play.',
            steps: [
                'Ανοίξτε την από το μενού εφαρμογών — όχι ξανά μέσω Chrome.',
                'Δεν χρειάζεται δεύτερη εγκατάσταση.'
            ]
        },
        browserPwaInstalled: {
            title: 'Η εφαρμογή είναι ήδη στην αρχική οθόνη.',
            steps: ['Ανοίξτε το εικονίδιο <strong>Kala Nera</strong> στην αρχική οθόνη σας.']
        },
        browserBothInstalled: {
            title: 'Έχετε ήδη την εφαρμογή (Play Store ή αρχική οθόνη).',
            steps: ['Αρκεί ένα εικονίδιο — ανοίξτε ό,τι προτιμάτε.']
        },
""")

    extra_en = """        runningTwa: {
            title: 'You are already using the app from Google Play.',
            steps: ['Next time, open it from your phone app drawer.']
        },
        runningPwa: {
            title: 'You are already using the app from your home screen.',
            steps: ['Next time, open it from the Kala Nera icon.']
        },
        browserPlayInstalled: {
            title: 'The app is already installed via Google Play.',
            steps: [
                'Open it from your app drawer — not again through Chrome.',
                'No second install needed.'
            ]
        },
        browserPwaInstalled: {
            title: 'The app is already on your home screen.',
            steps: ['Open the <strong>Kala Nera</strong> icon on your home screen.']
        },
        browserBothInstalled: {
            title: 'You already have the app (Play Store or home screen).',
            steps: ['One icon is enough — open whichever you prefer.']
        },
"""

    def inject_extra(guidance: str, marker: str, extra: str) -> str:
        idx = guidance.find(marker)
        if idx == -1:
            raise ValueError(f"marker not in guidance: {marker}")
        return guidance[:idx] + extra + guidance[idx:]

    good_guidance = inject_extra(good_guidance, "        desktop: {", extra_el)
    good_guidance = inject_extra(
        good_guidance,
        "        desktop: {\n            title: 'Install the",
        extra_en,
    )

    # Replace getInstallGuidance in block with merged good version
    b_guid_start = block.find("function getInstallGuidance(scenario)")
    b_guid_end = block.find("function installSituationToGuidanceKey")
    if b_guid_start == -1 or b_guid_end == -1:
        raise ValueError("guidance markers missing in bad block")
    block = block[:b_guid_start] + good_guidance + block[b_guid_end:]

    merged = good[:g_start] + [block] + good[g_end:]

    # Patch getInstallPlatform / applyInstallPlatformUi / init / listeners from bad (fixed)
    patches = [
        ("function getInstallPlatform() {", "function bodyWantsInstallPromo() {"),
        ("window.addEventListener('beforeinstallprompt'", "function refreshWebcam()"),
    ]
    text = "".join(merged)
    for start_needle, end_needle in patches:
        g_s = text.find(start_needle)
        if g_s == -1:
            continue
        g_e = text.find(end_needle, g_s)
        b_s = line_index(bad, start_needle.split("(")[0])
        # find in bad text
        bad_text = "".join(bad)
        b_s = bad_text.find(start_needle)
        b_e = bad_text.find(end_needle, b_s)
        if b_s == -1 or b_e == -1 or g_e == -1:
            raise ValueError(f"patch failed for {start_needle}")
        text = text[:g_s] + fix_block(bad_text[b_s:b_e]) + text[g_e:]

    # updateWeather
    weather_new = fix_block("""async function updateWeather() {
    const tempEl = document.getElementById('weather-temp');
    const iconEl = document.getElementById('weather-icon');
    if (!tempEl) return;

    try {
        const lat = 39.30;
        const lon = 23.12;
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();

        const temp = Math.round(data.current_weather.temperature);
        const code = data.current_weather.weathercode;

        let iconHtml = '<i class="fa-solid fa-sun" aria-hidden="true" style="color:#f59e0b"></i>';
        if (code > 0) iconHtml = '<i class="fa-solid fa-cloud-sun" aria-hidden="true" style="color:#f59e0b"></i>';
        if (code > 3) iconHtml = '<i class="fa-solid fa-cloud" aria-hidden="true" style="color:#64748b"></i>';
        if (code > 60) iconHtml = '<i class="fa-solid fa-cloud-rain" aria-hidden="true" style="color:#0ea5e9"></i>';

        tempEl.innerText = `${temp}°C`;
        if (iconEl) iconEl.innerHTML = iconHtml;
    } catch (e) {
        console.warn("Weer kon niet worden geladen");
        tempEl.style.display = 'none';
    }
}

""")
    w_s = text.find("async function updateWeather()")
    w_e = text.find("// --- WISHLIST LOGICA ---", w_s)
    text = text[:w_s] + weather_new + text[w_e:]

    # More sheet install awareness
    old_install_section = """        <section class="more-section">
            <h3>${labels.install}</h3>
            <div class="more-links">"""
    new_install_section = """        <section class="more-section">
            <h3>${labels.install}</h3>
            <p class="install-aware more-install-aware">${getInstallAwarenessHtml()}</p>
            <div class="more-links">"""
    if old_install_section not in text:
        raise ValueError("more install section not found")
    text = text.replace(old_install_section, new_install_section, 1)

    text = text.replace("const APP_VERSION = '3.1.22';", "const APP_VERSION = '3.1.37';")

    GOOD.write_text(text, encoding="utf-8", newline="\n")

    checks = [
        ("Περισσότερα", "Περισσότερα" in text),
        ("✕", "✕</button>" in text),
        ("© in more", "© ${formattedCopyright}" in text),
        ("no Î£", "Î£" not in text),
        ("3.1.37", "3.1.37" in text),
        ("fa-sun", "fa-solid fa-sun" in text),
        ("resolveInstallSituation", "resolveInstallSituation" in text),
        ("getInstallAwarenessHtml", "getInstallAwarenessHtml" in text),
        ("runningTwa", "runningTwa" in text),
    ]
    for name, ok in checks:
        print(f"{'OK' if ok else 'FAIL'}: {name}")
    if not all(ok for _, ok in checks):
        raise SystemExit(1)
    print("Merged successfully")


if __name__ == "__main__":
    main()
