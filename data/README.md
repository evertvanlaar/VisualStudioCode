# `/data` — statische datasets op de live site

| Bestand | Bron | Gebruikt door |
|---------|------|----------------|
| `pelion-cultural-events.json` | Handmatig / script | `events-page.js` |
| `local-businesses.json` | n8n publish-workflow (Google Sheet) | `app.js` (modus `json` / `auto`) |
| `local-businesses.staging.json` | Zelfde workflow, staging deploy | Test via `?bizData=json&bizStaging=1` |
| `local-businesses.meta.json` | Optioneel | Monitoring / deploy-scripts |
| `bus-schedule.json` | n8n publish-workflow (tab Bus_Schedule) | `app.js` bus (modus `json` / `auto`) |
| `bus-schedule.staging.json` | Zelfde workflow, staging deploy | Test via `?busData=json&busStaging=1` |
| `bus-schedule.meta.json` | Optioneel | Monitoring / deploy-scripts |
| `visitkalanera-sitemap.json` | GitHub Actions / `scripts/refresh-visitkalanera-sitemap.mjs` | n8n directory-vergelijking (incognito: geen directe fetch vanaf n8n) |

## Lokaal aanmaken (test)

```bash
node scripts/seed-local-businesses-data.mjs
```

Daarna in de browser: `index.html?bizData=json`.

Zie `docs/static-business-json-rollout.md` en `docs/static-bus-json-rollout.md` voor productie-rollout.
