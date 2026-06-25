# `/data` — statische datasets op de live site

| Bestand | Bron | Gebruikt door |
|---------|------|----------------|
| `pelion-cultural-events.json` | Handmatig / script | `events-page.js` |
| `local-businesses.json` | n8n publish-workflow (Google Sheet) | `app.js` (modus `json` / `auto`) |
| `local-businesses.staging.json` | Zelfde workflow, staging deploy | Test via `?bizData=json&bizStaging=1` |
| `local-businesses.meta.json` | Optioneel | Monitoring / deploy-scripts |
| `bus-schedule.json` | Actief rooster op server (`winter` of `summer`) | `app.js` bus (modus `json` / `auto`) |
| `bus-schedule.winter.json` | Archief winter (`dev/bus-schedule.winter.json`) | Test via `?busData=json&busSeason=winter` |
| `bus-schedule.summer.json` | Zomerrooster (`dev/bus-schedule.summer.json`) | Test via `?busData=json&busSeason=summer` |
| `bus-schedule.staging.json` | Kopie zomer voor veilige test | Test via `?busData=json&busStaging=1` |
| `bus-schedule.meta.json` | `scripts/switch-bus-season.mjs` | Welk seizoen actief is |
| `visitkalanera-sitemap.json` | GitHub Actions / `scripts/refresh-visitkalanera-sitemap.mjs` | n8n directory-vergelijking (incognito: geen directe fetch vanaf n8n) |

## Lokaal aanmaken (test)

```bash
node scripts/seed-local-businesses-data.mjs
```

Daarna in de browser: `index.html?bizData=json`.

Zie `docs/static-business-json-rollout.md` en `docs/static-bus-json-rollout.md` voor productie-rollout.

## Bus-rooster winter ↔ zomer

Bronbestanden (in git): `dev/bus-schedule.winter.json`, `dev/bus-schedule.summer.json`.

```bash
# Beide seizoenen naar data/ + staging = zomer (geen impact op live JSON)
node scripts/switch-bus-season.mjs publish-all

# Alleen zomer in staging (test)
node scripts/switch-bus-season.mjs staging-summer

# Cutover vanavond: zomer live
node scripts/switch-bus-season.mjs summer

# Terug naar winter
node scripts/switch-bus-season.mjs winter
```

Test-URL's (na deploy van `app.js` + season JSON):

- Zomer zonder productie-impact: `bus.html?busData=json&busStaging=1` of `?busData=json&busSeason=summer`
- Winter archief: `?busData=json&busSeason=winter`
