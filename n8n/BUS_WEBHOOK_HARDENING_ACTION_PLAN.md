# Bus-schedule webhook — actieplan hardening (referentie)

**Status:** nog niet geïmplementeerd — bewaard als checklist voor later.  
**Endpoint:** `GET …/webhook/bus-schedule`  
**Gerelateerd:** zie ook `ARCHITECTURE_AND_WEBHOOK_HARDENING.md` (algemene architectuur en richtlijnen).

---

## Huidige situatie (kort)

- Publieke GET-webhook → direct **Google Sheets** lezen → filter/normaliseren → JSON-response.
- `Cache-Control: public, max-age=60` helpt browsers; **voorkomt geen** server-side scraping of burst-verkeer.
- CORS `*` is geen beveiliging tegen `curl`/bots.
- Optionele `apiKey` / `q.key` in de Function-node wordt **niet afgedwongen** vóór de sheet-read.

---

## Prioriteit 1 — Rate limiting (VPS / Nginx)

**Doel:** voorkomen dat iemand de URL massaal aanroept.

- `limit_req_zone` + `limit_req` per IP op het pad van `bus-schedule` (richtlijn: o.a. 30–60 req/min, strengere burst voor abuse).
- Access logs gebruiken om pieken te zien.

*Zonder dit blijft elke aanroep — ook met andere maatregelen — een belasting.*

---

## Prioriteit 2 — Minder Google Sheets-reads

**Doel:** niet bij **elke** GET het volledige sheet ophalen.

**Opties (één kiezen of combineren):**

| Aanpak | Idee |
|--------|------|
| **Proxy-cache (Nginx)** | GET-response 30–60 s cachen (key = volledige querystring). Groot effect, weinig n8n-wijzigingen. |
| **Cache binnen n8n** | Sheet periodiek (Schedule) in store / geheugen; webhook leest alleen cache. |
| **Langere `max-age`** | Alleen als data dat toelaat; nog steeds geen bescherming tegen burst. |

---

## Prioriteit 3 — API-key gate vóór Sheets (n8n-branch)

**Doel:** zonder geldige key **geen** `Read Google Sheet`-node uitvoeren (snelle 401, minder quota-verlies).

### Gewenste flow (node-namen zoals in repo)

```text
Webhook (GET) bus-schedule
        │
        ▼
  API key OK?  (IF)
    │         │
   ja        nee
    │         ▼
    │     Respond 401 (Unauthorized) + JSON + CORS-headers
    ▼
Read Google Sheet (Bus_Schedule)
    │
    ▼
Attach request query
    │
    ▼
Filter + Normalize + Sort (Athens)
    │
    ▼
Respond (JSON + CORS)
```

### Implementatiestappen

1. **n8n variable / omgeving:** bv. `BUS_API_KEY` = lang random string (niet in workflow JSON hardcoden).
2. **IF-node** direct na webhook:
   - **True** → `Read Google Sheet (Bus_Schedule)` (bestaande verbindingen daarna ongewijzigd).
   - **False** → nieuwe **Respond to Webhook** (401, body bv. `{"error":"unauthorized"}`,zelfde CORS-headers als succes-response waar nodig).
3. **Voorwaarde (header óf query):**
   - Header: `X-API-Key` (handig voor curl/servers).
   - Query: `key=…` (vaak eenvoudiger in de browser: **geen** CORS-preflight zoals bij custom headers).
   - Expression (na 1 test-run controleren op jouw n8n JSON-vorm), bv.:

     ```text
     ={{ $json.headers['x-api-key'] || $json.headers['X-API-Key'] || $json.query?.key || '' }}
     ```

     gelijk aan `={{ $env.BUS_API_KEY }}`, of IF v2 met twee regels en **Any/OR**.

4. **Frontend (`app.js`):** zodra dit live staat, bij `fetch` naar `N8N_BUS_WEBHOOK_URL` dezelfde key meesturen (header en/of query).  
   **Let op:** key in statische frontend is **niet echt geheim**; dit filtert vooral simpele misbruikers. Echte bescherming = **rate limit + cache**.

### CORS / OPTIONS

- Alleen **GET zonder custom headers** → meestal geen preflight.
- **GET + `X-API-Key`** → browser stuurt vaak **OPTIONS** eerst; oplossen via **Nginx** (OPTIONS met 204 + CORS-headers) of aparte OPTIONS-handler.
- Pragmatisch: **`?key=`** in de site als je geen proxy-preflight wilt tunen.

---

## Prioriteit 4 — Query-validatie (optioneel)

- Ongeldige `dir` nu: stil terugvallen op `volos` (vriendelijk, maar elke call kost nog sheet-work). Overweeg **400** vóór sheet bij duidelijk ongeldige parameters.
- `minutesEarly` begrenzen (bv. 0–30).

---

## Prioriteit 5 — Operationeel

- Geen interne foutdetails in JSON naar clients.
- Logging/alerts bij abnormale volumes.
- Spreadsheet-ID in exports: geen extra gevoelige kolommen terugsturen dan nodig.

---

## Checklist “klaar voor productie”

- [ ] Nginx (of vergelijkbaar): rate limit op `/webhook/bus-schedule`
- [ ] GET-cache of minder frequente sheet-reads
- [ ] IF + 401-respond vóór Google Sheets (indien gewenst)
- [ ] `BUS_API_KEY` in n8n + frontend/sync-proces voor key (of alleen query op korte termijn)
- [ ] CORS/preflight getest vanaf `https://www.kalanera.gr` en lokaal
- [ ] `ARCHITECTURE_AND_WEBHOOK_HARDENING.md` bijwerken als iets structureel verandert

---

*Laatst bijgewerkt als referentie-actieplan (geen implementatie in deze commit vereist).*
