/**
 * app.js - De "hersenen" van de Kala Nera Business Directory
 */

const N8N_WEBHOOK_URL = 'https://n8n.vanlaar.cloud/webhook/local-businesses';
// Bus timetable (n8n path bus-schedule-next). Query: from, dir, remaining=0|1, dayOffset=0..6 (Athens calendar).
// Legacy webhook /webhook/bus-schedule blijft in n8n actief voor oudere app.js die nog niet via service worker is bijgewerkt.
const N8N_WEBHOOK_URL_BUS_SCHEDULE_NEXT = 'https://n8n.vanlaar.cloud/webhook/bus-schedule-next';
// Server-side cache (Sheet-regels): zie n8n/bus-schedule-next-cached-workflow.example.json (+ build-bus-schedule-next-cached-example.mjs).
/** client-side slots: sleutel dir + Athens kalenderdatum doeldag (niet alleen offset), sync met n8n dayOffset-filter. */
const BUS_STORAGE_KEY = 'kalanera_bus_schedule_cache_v3';
const BUS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
/** Today + 6 days: seven consecutive Athens calendar days */
const BUS_DAY_OFFSET_MAX = 6;
const BUS_DAY_OFFSET_STORAGE_KEY = 'kalanera_bus_day_offset';
const BUS_DEFAULT_DIR = 'volos';
/** All `dir` slugs accepted from UI + n8n (must match Google Sheet Direction values). */
const BUS_VALID_DIRS = [
    'volos', 'milies', 'argalasti', 'afissos',
    'vyzitsa', 'pinakates', 'neochori', 'siki', 'promiri', 'katigiorgis', 'milina', 'platanias', 'trikeri',
];
/** Toon chauffeur-waarschuwing (lage frequentie) voor deze bestemmingen — uitbreidbaar. */
const BUS_LOW_FREQ_DIRS = new Set(['trikeri', 'katigiorgis', 'platanias']);
const STORAGE_KEY = 'kalanera_offline_data';

// Check de taal van de huidige pagina
const currentLang = document.documentElement.lang || 'en'; // Nu is Engels de fallback

const translations = {
    'el': {
        'all': 'Όλα',
        'all_locations': 'Όλες οι τοποθεσίες',
        // Categorieën
        'Camp': 'Καμπινγκ',
        'Drink': 'Ποτό',
        'Eat': 'Φαγητό',
        'Other': 'Άλλο',
        'Rent' : 'Ενοικιάσεις',
        'Shop': 'Ψώνια',
        'Sleep': 'Διαμονή',
        'Travel': 'Ταξίδια',
        // Locaties
        'Kala Nera': 'Καλά Νερά',
        'Kato Gatzea': 'Κάτω Γατζέα',
        'Ano Gatzea': 'Άνω Γατζέα',
        'Koropi': 'Κορώπη',
        'Milies': 'Μηλιές',
        'Vizitsa': 'Βυζίτσα',
        'Afissos': 'Άφησσος',
        // Voeg hier de rest van je categorieën en locaties toe
        'pwa_msg': 'Εγκαταστήστε την εφαρμογή για καλύτερη εμπειρία.',
        'pwa_btn': 'Εγκατάσταση',
        // Bus
        'bus_last_updated': 'Τελευταία ενημέρωση',
        'bus_today_none': 'Δεν υπάρχουν άλλα δρομολόγια σήμερα.',
        'bus_unavailable': 'Το πρόγραμμα λεωφορείων δεν είναι διαθέσιμο αυτή τη στιγμή.',
        'bus_arrival_prefix': 'Άφιξη',
        'bus_from': 'Από',
        'bus_stop_label': 'Στάση',
        'bus_stop_highway_bakery': 'Κεντρικός δρόμος',
        'bus_stop_village_butcher': 'Κέντρο/παραλία',
        'bus_showing': 'Εμφάνιση',
        'bus_runs': 'Δρομολόγια',
        'bus_frequency': 'Συχνότητα',
        'bus_departure_el_l1': 'Ώρα στη στάση',
        'bus_departure_el_l2': 'Καλά Νερά',
        'bus_low_freq': 'Ρωτήστε τον οδηγό για επιστροφή',
        'bus_also_prefix': 'Επίσης:',
        'bus_line_berg': 'Ορεινή γραμμή — καθημερινά, στάση στο κέντρο του χωριού.',
        'bus_line_coast': 'Παράκτια γραμμή — καθημερινά, ιδανική για παραλίες.',
        'bus_line_south': 'Νότια γραμμή — καθημερινά, μόνο κεντρικός δρόμος.',
        'bus_line_south_east': 'Νότια γραμμή (ανατολικά) — Δευ–Παρ, μόνο κεντρικός δρόμος.',
        'bus_heading_today': 'ΣΗΜΕΡΑ',
        'bus_heading_tomorrow_upper': 'ΑΎΡΙΟ',
        'bus_heading_tomorrow': 'Αύριο',
        'bus_heading_weekday_date': '{weekday} {date}',
        'bus_full_title_date': 'Πλήρες πρόγραμμα · {date}',
        'bus_full_title_today': 'Πλήρες πρόγραμμα σήμερα',
        'bus_timeline_list_aria_date': 'Αναχωρήσεις {date} σε χρονική σειρά',
        'bus_first_departure_title': 'Πρώτο δρομολόγιο',
        'bus_day_none': 'Δεν υπάρχουν δρομολόγια αυτή την ημέρα.',
        'bus_day_strip_aria': 'Επιλογή ημέρας (Αθήνα, έως 7 ημέρες)',
        'bus_day_strip_hint': 'Επόμενες 7 ημέρες (τοπική ώρα Πηλίου)',
        'bus_next_heading': 'Επόμενο λεωφορείο'
    }
};

// Helper functie om tekst te vertalen
function t(text) {
    if (currentLang === 'el' && translations['el'][text]) {
        return translations['el'][text];
    }
    return text; // Fallback naar Engels
}

let allBusinesses = []; 
/** Geselecteerde gebieden (Sheet-waarden Location). Leeg, of alles uit SITE_LOCATION_FILTERS aangevinkt = geen filter. */
let activeLocations = new Set();
let deferredPrompt; // Global variabele voor PWA
let listMode = (localStorage.getItem('kalanera_list_mode') || 'categories'); // 'categories' | 'az'

/** Webhook: platte array óf `{ rows|data|items: [...] }` (cache-/Respond-node verschillen). */
function normalizeBusinessWebhookPayload(parsed) {
    if (parsed == null) return [];
    if (typeof parsed === 'string') return null;
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object') {
        if (Array.isArray(parsed.rows)) return parsed.rows;
        if (Array.isArray(parsed.data)) return parsed.data;
        if (Array.isArray(parsed.items)) return parsed.items;
    }
    return null;
}

function sheetLikeStatusValue(biz) {
    if (!biz || typeof biz !== 'object') return '';
    let s = biz.Status ?? biz.status ?? biz.STATUS;
    if (s != null && String(s).trim() !== '') return s;
    const key = Object.keys(biz).find(
        (k) => String(k).replace(/^\ufeff/, '').trim().toLowerCase() === 'status'
    );
    return key ? biz[key] : '';
}

function businessRowIsActive(biz) {
    return String(sheetLikeStatusValue(biz) ?? '').trim().toLowerCase() === 'active';
}

// Icon Map voor categorieën
const iconMap = {
    'Bakery': 'fa-bread-slice', 'Bakker': 'fa-bread-slice', 'Coffee': 'fa-coffee', 'Koffie': 'fa-coffee',
    'Eat': 'fa-utensils', 'Eten': 'fa-utensils', 'Drink': 'fa-glass-cheers', 'Pub': 'fa-beer',
    'Shop': 'fa-shopping-cart', 'Other': 'fa-shopping-bag', 'Supermarket': 'fa-shopping-basket',
    'Sleep': 'fa-bed', 'B&B': 'fa-hotel', 'Camp': 'fa-campground', 'Beauty': 'fa-spa',
    'Kapper': 'fa-cut', 'Sport': 'fa-running', 'Pharmacy': 'fa-pills', 'Garage': 'fa-car'
};

// --- STAP 2: VERSIE-BEHEER (SLECHTS OP 1 PLEK AANPASSEN) ---
const APP_VERSION = '2.1.7'; // <--- Pas VOORTAAN alleen nog maar dit getal aan!
let CURRENT_APP_VERSION = APP_VERSION; 

if ('serviceWorker' in navigator) {
    // We plakken de variabele automatisch achter de URL
    const swUrl = `/service-worker.js?v=${APP_VERSION}`;

    navigator.serviceWorker.register(swUrl)
        .then(reg => {
            console.log(`Service Worker registratie gepusht naar v${APP_VERSION}`);
            reg.update(); 
        });

    navigator.serviceWorker.ready.then(reg => {
        if (!navigator.serviceWorker.controller) return;
        
        const mc = new MessageChannel();
        mc.port1.onmessage = (e) => {
            if (e.data && e.data.version) {
                CURRENT_APP_VERSION = e.data.version;
                console.log("Versie bevestigd door SW:", CURRENT_APP_VERSION);
            }
        };
        navigator.serviceWorker.controller.postMessage({type: 'GET_VERSION'}, [mc.port2]);
    });
}

// --- INITIALISATIE ---
async function init() {
    const businessList = document.getElementById('business-list');
    const cachedData = localStorage.getItem(STORAGE_KEY);
    
    // --- STAP 1: Check op welke pagina we zijn ---
    const isWishlistPage = document.getElementById('empty-wishlist') !== null;

    // Functie om de juiste weergave te kiezen
    /** Voorkom eeuwig “loading…” als fetch faalt zonder geldige cache of bij alleen !response.ok */
    let directoryUiRendered = false;
    const showData = () => {
        if (!isWishlistPage) directoryUiRendered = true;
        if (isWishlistPage) {
            renderWishlist(); 
        } else {
            renderEverything(); 
        }

        // --- NIEUW: Vertel Analytics dat de pagina (inclusief anker #) geladen is ---
        if (typeof gtag === 'function') {
            gtag('config', 'G-XXXXXXXXXX', {
                'page_path': window.location.pathname + window.location.hash
            });
        }
    };

    // --- STAP 2: Laad data uit Cache ---
    if (cachedData) {
        try {
            allBusinesses = JSON.parse(cachedData);
            showData(); 
        } catch (e) {
            console.error("Cache corrupt.");
        }
    }

// --- STAP 3: Haal verse data op via n8n ---
    try {
        const response = await fetch(N8N_WEBHOOK_URL);
        if (!response.ok) {
            const bodySnippet = await response.text().catch(() => '');
            console.warn(
                'Businesses webhook niet OK:',
                response.status,
                bodySnippet.slice(0, 400)
            );
        } else {
            const bodyText = await response.text();
            const trimmed = bodyText.trim();
            let payload;
            if (!trimmed) {
                console.warn(
                    'Businesses webhook: lege response body (HTTP',
                    response.status,
                    ') — meestal n8n Respond zonder body of $json.rows undefined. Check workflow / cache branch.'
                );
                payload = [];
            } else {
                try {
                    payload = JSON.parse(trimmed);
                } catch (parseErr) {
                    console.warn(
                        'Businesses webhook: body is geen geldige JSON',
                        parseErr,
                        '| snippet:',
                        trimmed.slice(0, 400)
                    );
                    throw parseErr;
                }
            }
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (parseErr) {
                    console.warn('Businesses webhook: body is string maar geen geldige JSON', parseErr);
                    throw new Error('Invalid businesses payload shape');
                }
            }
            const rawData = normalizeBusinessWebhookPayload(payload);
            if (!Array.isArray(rawData)) {
                console.warn(
                    'Businesses webhook: verwacht array of object.rows[], ontving:',
                    typeof payload,
                    payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 15) : payload
                );
                throw new Error('Invalid businesses payload shape');
            }
            const freshData = rawData.filter(businessRowIsActive);
            if (rawData.length > 0 && freshData.length === 0) {
                const sample = rawData[0];
                console.warn(
                    'Businesses webhook: alle rijen uitgefilterd op Status≠Active. Voorbeeld Status-waarde:',
                    sheetLikeStatusValue(sample),
                    '| sleutels:',
                    sample && typeof sample === 'object' ? Object.keys(sample).slice(0, 20) : sample
                );
            }
            if (rawData.length === 0) {
                console.warn('Businesses webhook: lege array — check n8n Google Sheets bereik/tab en workflow.');
            }
           
            const now = new Date();
            
            // DYNAMISCHE TAAL CHECK
            // We bepalen de juiste 'locale' op basis van de pagina taal
            const locale = (currentLang === 'el') ? 'el-GR' : 'en-GB'; 
            
            // Formatteer datum en tijd volgens de taal van de bezoeker
            const timeString = now.toLocaleDateString(locale) + ' ' + 
                               now.toLocaleTimeString(locale, {hour: '2-digit', minute:'2-digit'});
            
            localStorage.setItem('kalanera_last_sync', timeString);

            localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
            allBusinesses = freshData;
          
            // VOEG DEZE REGEL TOE OM DE DOWNLOAD TE STARTEN: \/ <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<--------------
            // exportSitemap(allBusinesses); 

            showData(); 
        }
    } catch (error) {
        console.warn('Offline mode.', error?.message || error);
    }

    if (!isWishlistPage && businessList && !directoryUiRendered) {
        showData();
    }

    // --- STAP 4: Overige extra's ---
    updateOnlineStatus();
    updateWeather(); 

    // --- NIEUW: Luister naar hash-veranderingen voor Analytics ---
    // (Als mensen op een link naar een specifiek bedrijf klikken)
    window.addEventListener('hashchange', () => {
        if (typeof gtag === 'function') {
            gtag('event', 'page_view', {
                page_path: window.location.pathname + window.location.hash
            });
        }
    });
}

// --- UI RENDERING & FILTERS ---
function renderEverything() {
    generateLocationButtons();
    renderBusinesses(allBusinesses);
}

function updateOnlineStatus() {
    const offlineIndicator = document.getElementById('offline-indicator');
    
    if (navigator.onLine) {
        // We zijn ONLINE
        document.body.classList.remove('is-offline');
        if (offlineIndicator) offlineIndicator.style.display = 'none';
    } else {
        // We zijn OFFLINE
        document.body.classList.add('is-offline');
        if (offlineIndicator) offlineIndicator.style.display = 'block';
    }
}

// Zorg dat de browser luistert naar veranderingen in de verbinding
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Voer het ook direct uit als de pagina laadt
document.addEventListener('DOMContentLoaded', updateOnlineStatus);

/** Vaste gebieden in de UI (matcht Sheet-waarden Location). Uitbreiden: array aanpassen. */
const SITE_LOCATION_FILTERS = ['Kala Nera', 'Kato Gatzea', 'Koropi'];

function getColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

/** Stabiele id voor ankers / #fragment (alleen a-z, 0-9, hyphen). */
function categorySectionSlug(cat) {
    return String(cat || 'other')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'other';
}

function locationFilterShowsAllBusinesses() {
    if (activeLocations.size === 0) return true;
    if (SITE_LOCATION_FILTERS.length === 0) return true;
    return SITE_LOCATION_FILTERS.every((loc) => activeLocations.has(loc));
}

function generateLocationButtons() {
    const container = document.getElementById('location-buttons');
    if (!container) return;

    let html = '';
    SITE_LOCATION_FILTERS.forEach((loc) => {
        const label = escapeHtml(t(loc));
        const isOn = activeLocations.has(loc);
        html += `<button type="button" class="loc-btn${isOn ? ' active' : ''}" data-location="${escapeHtml(loc)}" aria-pressed="${isOn ? 'true' : 'false'}" title="${label}"><span class="loc-btn__text">${label}</span></button>`;
    });

    container.innerHTML = html;
    container.querySelectorAll('.loc-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('.loc-btn');
            if (!targetBtn) return;
            const loc = targetBtn.getAttribute('data-location');
            if (!loc) return;
            if (activeLocations.has(loc)) activeLocations.delete(loc);
            else activeLocations.add(loc);
            const on = activeLocations.has(loc);
            targetBtn.classList.toggle('active', on);
            targetBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
            if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
                targetBtn.blur();
            }
            applyFilters();
        });
    });
}

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

    const filtered = allBusinesses.filter((biz) => {
        const matchesSearch =
            (biz.Name || "").toLowerCase().includes(searchTerm) ||
            (biz.Name_EL || "").toLowerCase().includes(searchTerm) ||
            (biz.Category || "").toLowerCase().includes(searchTerm) ||
            t(biz.Category).toLowerCase().includes(searchTerm) ||
            t(biz.Location).toLowerCase().includes(searchTerm);

        const matchesLocation =
            locationFilterShowsAllBusinesses() || activeLocations.has(biz.Location);

        return matchesSearch && matchesLocation;
    });
    renderBusinesses(filtered);
}

// --- DE HOOFDLIJST RENDEREN ---

function renderBusinesses(data) {
    const container = document.getElementById('business-list');
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0) {
            // NIEUW: Vertaal ook de "geen resultaten" melding
            const noResultsMsg = (currentLang === 'el') ? 'Δεν βρέθηκαν επιχειρήσεις.' : 'No businesses found matching your criteria.';
            container.innerHTML = `<p class="status-msg">${noResultsMsg}</p>`;
            return;
        }

    // Veilig de wishlist ophalen
    let wishlist = [];
    try {
        if (typeof getWishlist === 'function') {
            wishlist = getWishlist();
        } else {
            const saved = localStorage.getItem('kalanera_wishlist');
            wishlist = saved ? JSON.parse(saved) : [];
        }
    } catch (e) { wishlist = []; }

    const renderCardInto = (grid, biz, categoryForColor) => {

// --- NIEUW: DE NAAM LOGICA ---
            const displayName = (currentLang === 'el' && biz.Name_EL) ? biz.Name_EL : biz.Name;
            // -----------------------------

            const rawUrl = biz.Website || '';
            const cleanUrl = rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl;
            const catColor = getColor(categoryForColor || biz.Category || 'Other');
            const safeBizName = biz.Name.replace(/'/g, "\\'"); // Veilig voor JS strings
            
            const reviewUrl = `https://www.google.com/search?q=${encodeURIComponent(biz.Name + ' Kala Nera reviews')}`;
            const mapsUrl = biz.GoogleMapsLink || `https://www.google.com/maps/search/${encodeURIComponent(biz.Name + ' Kala Nera')}`;
            
            // Email HTML
            const emailHtml = (biz.Email && biz.Email.trim() !== "" && biz.Email !== "-") 
            ? `<a href="mailto:${biz.Email}" class="btn-icon mail-btn" title="E-mail" onclick="gtag('event', 'click_email', {'biz_name': '${safeBizName}'})"><i class="fa fa-envelope"></i></a>` 
            : '';

            const isFavorite = wishlist.includes(biz.Name);
            let finalImageUrl = biz.PhotoURL || `https://via.placeholder.com/180x130?text=${encodeURIComponent(biz.Name)}`;

            // 1. Website knop met tracking
            const webHtml = biz.Website && biz.Website.trim() !== "" 
                ? `<a href="${cleanUrl}" target="_blank" class="btn-icon web-btn" onclick="gtag('event', 'exit_to_website', {'biz_name': '${safeBizName}'})"><i class="fa fa-globe"></i></a>` 
                : '';
                
            // 2. Unieke ID voor deep-linking en AI-vindbaarheid
            const bizId = biz.Name.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');

            const locDisplay = t(biz.Location) || t('Kala Nera');
            const locDisplaySafe = escapeHtml(locDisplay);

  // 3. De Grid HTML
grid.innerHTML += `
    <div class="biz-card-mini is-media" id="${bizId}" style="border-left: 4px solid ${catColor}">
        <div class="mini-preview">
            <a class="media-link" href="business/${bizId}${currentLang === 'el' ? '-el' : ''}.html" onclick="gtag('event', 'click_image', {'biz_name': '${safeBizName}'})">
                <img src="${finalImageUrl}" onerror="this.src='pix/nophoto.jpg'" alt="${displayName}">
            </a>
            <div class="media-overlay">
                <div class="media-title">${displayName}</div>
                <div class="mini-actions mini-actions-media">
                ${(biz.Phone && biz.Phone.trim() !== "" && biz.Phone !== "-")
                    ? `<a href="tel:${biz.Phone}" class="btn-icon phone-btn is-media-icon" title="${escapeHtml(biz.Phone)}" onclick="gtag('event', 'click_phone', {'biz_name': '${safeBizName}'})"><i class="fa fa-phone"></i></a>`
                    : ''
                }
                <div class="action-right">
                    ${webHtml}
                    ${emailHtml}
                    <a href="${reviewUrl}" target="_blank" rel="noopener" class="btn-icon review-btn" onclick="gtag('event', 'click_reviews', {'biz_name': '${safeBizName}'})">
                        <i class="fa fa-star"></i>
                    </a>
                    <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-icon nav-btn-action" onclick="gtag('event', 'open_maps', {'biz_name': '${safeBizName}'})">
                        <i class="fa fa-location-dot"></i>
                    </a>
                </div>
                </div>
            </div>
            <button class="wishlist-btn ${isFavorite ? 'active' : ''}" onclick="toggleWishlist('${safeBizName}', this)" aria-label="Toggle favorite">
                <i class="${isFavorite ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
        </div>
        <p class="media-location-caption" title="${locDisplaySafe}"><span class="media-location-inner"><i class="fa fa-map-marker-alt" aria-hidden="true"></i><span class="media-location-txt">${locDisplaySafe}</span></span></p>
    </div>`;
    };

    // Mode A: grouped by category (default)
    if (listMode !== 'az') {
        const grouped = data.reduce((acc, biz) => {
            const cat = biz.Category || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(biz);
            return acc;
        }, {});

        Object.keys(grouped).sort().forEach((category, catIndex) => {
            const details = document.createElement('details');
            details.className = 'category-disclosure';
            details.id = `section-${categorySectionSlug(category)}`;
            if (catIndex === 0) {
                details.setAttribute('open', '');
            }

            const summary = document.createElement('summary');
            summary.className = 'category-section-summary';
            const accent = getColor(category);
            summary.style.setProperty('--cat-accent', accent);
            const iconWrap = document.createElement('span');
            iconWrap.className = 'category-summary-icon';
            iconWrap.innerHTML = getIcon(category);
            const labelEl = document.createElement('span');
            labelEl.className = 'category-summary-label';
            labelEl.textContent = t(category);
            const countEl = document.createElement('span');
            countEl.className = 'category-summary-count';
            countEl.textContent = String(grouped[category].length);
            const chev = document.createElement('i');
            chev.className = 'fa-solid fa-chevron-down category-summary-chevron';
            chev.setAttribute('aria-hidden', 'true');
            summary.append(iconWrap, labelEl, countEl, chev);

            const grid = document.createElement('div');
            grid.className = 'business-grid category-section-grid';
            grouped[category]
                .sort((a, b) => (a.Name || "").localeCompare(b.Name || ""))
                .forEach(biz => renderCardInto(grid, biz, category));

            details.appendChild(summary);
            details.appendChild(grid);
            container.appendChild(details);
        });
    } else {
        // Mode B: global A–Z list (best for alpha index)
        const grid = document.createElement('div');
        grid.className = 'business-grid';

        const sorted = [...data].sort((a, b) => {
            const nameA = (currentLang === 'el' && a.Name_EL) ? a.Name_EL : (a.Name || '');
            const nameB = (currentLang === 'el' && b.Name_EL) ? b.Name_EL : (b.Name || '');
            return (nameA || '').localeCompare(nameB || '');
        });

        sorted.forEach(biz => renderCardInto(grid, biz, biz.Category || 'Other'));
        container.appendChild(grid);
    }

    // Fast-scroll A–Z index (mobile): build after list is in DOM
    buildAlphaIndex();

    // NIEUW: Vertaal "Last sync"
    const syncLabel = (currentLang === 'el') ? 'Τελευταίος συγχρονισμός' : 'Last sync';
    const lastSync = localStorage.getItem('kalanera_last_sync') || (currentLang === 'el' ? 'Άγνωστο' : 'Unknown');
    const syncDiv = document.createElement('div');
    syncDiv.className = 'sync-info';
    syncDiv.innerHTML = `<small style="display:block; text-align:center; margin-top:20px; color:var(--muted); font-size:11px;">${syncLabel}: ${lastSync}</small>`;
    container.appendChild(syncDiv);

 
    // Animatie
    setTimeout(() => {
        document.querySelectorAll('.biz-card-mini').forEach((card, index) => {
            setTimeout(() => { card.classList.add('show'); }, index * 30);
        });
    }, 50);

    // Schema.org update voor SEO
     // updateSchemaOrg(data); // sitemap.xml wordt nu via n8n ingevuld
}

function buildAlphaIndex() {
    // Remove existing
    const existing = document.querySelector('.alpha-index');
    if (existing) {
        try { existing._observer && existing._observer.disconnect(); } catch (e) {}
        existing.remove();
    }
    const existingToast = document.querySelector('.alpha-toast');
    if (existingToast) existingToast.remove();

    // Only on the directory page (not wishlist/forms) and only in A–Z mode
    if (listMode !== 'az') return;
    if (!document.getElementById('business-list')) return;

    const cards = Array.from(document.querySelectorAll('#business-list .biz-card-mini'));
    if (cards.length < 15) return; // avoid clutter on short lists

    // Map first letter -> first card element
    const letterToEl = new Map();
    for (const el of cards) {
        const titleEl = el.querySelector('.media-title') || el.querySelector('.biz-name');
        const name = (titleEl && titleEl.textContent ? titleEl.textContent : '').trim();
        if (!name) continue;
        const ch = name[0].toUpperCase();
        const letter = ch.match(/[A-Z]/) ? ch : '#';
        if (!letterToEl.has(letter)) letterToEl.set(letter, el);
    }

    const letters = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

    const index = document.createElement('div');
    index.className = 'alpha-index';
    index.setAttribute('aria-label', 'Alphabetical quick scroll');
    index.innerHTML = letters.map(l => {
        const enabled = letterToEl.has(l);
        return `<button type="button" class="alpha-letter ${enabled ? '' : 'is-disabled'}" data-letter="${l}" ${enabled ? '' : 'disabled'}>${l}</button>`;
    }).join('');

    const toast = document.createElement('div');
    toast.className = 'alpha-toast';
    toast.setAttribute('aria-hidden', 'true');
    toast.style.display = 'none';
    document.body.appendChild(toast);
    document.body.appendChild(index);

    // Only show index once the directory list is in view (below hero)
    const anchor = document.getElementById('business-list');
    if (anchor && 'IntersectionObserver' in window) {
        const obs = new IntersectionObserver((entries) => {
            const entry = entries[0];
            // show when list is entering viewport; hide when above it (hero region)
            if (entry && entry.isIntersecting) {
                index.classList.add('is-visible');
            } else {
                index.classList.remove('is-visible');
            }
        }, {
            root: null,
            threshold: 0.01,
            // account for sticky header + toolbar height so it doesn't appear too early
            rootMargin: '-140px 0px -40% 0px'
        });
        obs.observe(anchor);
        // store on element for cleanup on rerender
        index._observer = obs;
    } else {
        // fallback: always visible
        index.classList.add('is-visible');
    }

    let toastTimer = null;
    const showToast = (letter) => {
        toast.textContent = letter;
        toast.style.display = 'grid';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 500);
    };

    const scrollToLetter = (letter) => {
        const target = letterToEl.get(letter);
        if (!target) return;
        showToast(letter);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    index.addEventListener('click', (e) => {
        const btn = e.target.closest('.alpha-letter');
        if (!btn || btn.disabled) return;
        scrollToLetter(btn.getAttribute('data-letter'));
    });

    // Swipe support (touch / pointer)
    const handlePoint = (clientY) => {
        const rect = index.getBoundingClientRect();
        const y = Math.min(Math.max(clientY - rect.top, 0), rect.height - 1);
        const itemH = rect.height / letters.length;
        const idx = Math.floor(y / itemH);
        const letter = letters[Math.min(Math.max(idx, 0), letters.length - 1)];
        if (letterToEl.has(letter)) scrollToLetter(letter);
        else showToast(letter);
    };

    let tracking = false;
    index.addEventListener('pointerdown', (e) => { tracking = true; index.setPointerCapture(e.pointerId); handlePoint(e.clientY); });
    index.addEventListener('pointermove', (e) => { if (tracking) handlePoint(e.clientY); });
    index.addEventListener('pointerup', () => { tracking = false; });
    index.addEventListener('pointercancel', () => { tracking = false; });
}

function setListMode(mode) {
    listMode = mode === 'az' ? 'az' : 'categories';
    localStorage.setItem('kalanera_list_mode', listMode);

    const btnCat = document.getElementById('view-mode-categories');
    const btnAz = document.getElementById('view-mode-az');
    if (btnCat && btnAz) {
        btnCat.setAttribute('aria-selected', listMode === 'categories' ? 'true' : 'false');
        btnAz.setAttribute('aria-selected', listMode === 'az' ? 'true' : 'false');
    }

    applyFilters();
}


// --- HULPFUNCTIES (Zorg dat deze eronder staan!) ---

function getIcon(cat) {
    if (typeof iconMap === 'undefined') return '<i class="fa fa-tag"></i>';
    const key = Object.keys(iconMap).find(k => (cat || "").toLowerCase().includes(k.toLowerCase()));
    return `<i class="fa ${key ? iconMap[key] : 'fa-tag'}"></i>`;
}

function getColor(str) {
    if (!str) return '#4A6C4A';
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

function copyToClipboard(text, el) {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text).then(() => {
        const icon = el.querySelector('i');
        const oldClass = icon.className;
        icon.className = 'fa fa-check';
        setTimeout(() => { icon.className = oldClass; }, 2000);
    });
}

// --- EVENT LISTENERS ---

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// --- GEOPTIMALISEERD PWA INSTALL EVENT ---
window.addEventListener('beforeinstallprompt', (e) => {
    // 1. Altijd blokkeren op desktop (boven 767px)
    if (window.innerWidth > 767) return; 

    // 2. Stop het standaard gedrag en sla het event op
    e.preventDefault();
    deferredPrompt = e;

    // 3. Toon de optie ALTIJD in het menu
    const installItem = document.getElementById('menu-install-item');
    if (installItem) {
        installItem.style.display = 'block';
        installItem.classList.add('show-install');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // 1. Dark Mode
    if (typeof initDarkMode === 'function') {
        initDarkMode();
    }

    // 2. Zoekbalk listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    // 2a. View mode toggle (Categories / A-Z)
    const btnCat = document.getElementById('view-mode-categories');
    const btnAz = document.getElementById('view-mode-az');
    if (btnCat && btnAz) {
        // Initialize UI from stored mode
        btnCat.setAttribute('aria-selected', listMode === 'categories' ? 'true' : 'false');
        btnAz.setAttribute('aria-selected', listMode === 'az' ? 'true' : 'false');

        btnCat.addEventListener('click', () => setListMode('categories'));
        btnAz.addEventListener('click', () => setListMode('az'));
    }

    // 3. Mobiel menu
    const menu = document.querySelector('#mobile-menu');
    const menuLinks = document.querySelector('#nav-list');
    if (menu && menuLinks) {
        menu.addEventListener('click', () => {
            menuLinks.classList.toggle('active');
            menu.classList.toggle('is-active');
        });
    }

    // 3b. Mobile "More" tab (bottom nav)
    initMoreTab();

    // 4. Wishlist teller bijwerken
    updateWishlistCount();

    // 5. De data-fetching starten
    init();

    // 5b. Bus schedule (optional section on homepage)
    initBusSchedule();

    // 6. EXTRA: Google Maps Button logica (optioneel, voor analytics of effect)
    const mapFab = document.querySelector('.map-fab');
    if (mapFab) {
        console.log("Map button is ready");
    }
});

// --- BUS SCHEDULE (Homepage) ---
function busT(key, fallback) {
    const isEl = (currentLang === 'el');
    if (!isEl) return fallback;
    const elMap = translations && translations.el ? translations.el : {};
    return elMap[key] || fallback;
}

function busLang() {
    const lang = (document.documentElement.lang || '').toLowerCase();
    if (lang.startsWith('el')) return 'el';
    if (lang.startsWith('nl')) return 'nl';
    return 'en';
}

function busText(key, { en, nl, el }) {
    const lang = busLang();
    if (lang === 'el') return (el || en || '');
    if (lang === 'nl') return (nl || en || '');
    return (en || '');
}

function busStopLabel(stopKey) {
    const key = String(stopKey || '').trim().toLowerCase();
    if (!key) return '';
    if (key === 'highway_bakery') {
        return busText('stop_highway_bakery', {
            en: 'Highway stop (bakery)',
            nl: 'Hoofdweg (bij de bakker)',
            el: busT('bus_stop_highway_bakery', 'Κεντρικός δρόμος'),
        });
    }
    if (key === 'village_butcher') {
        return busText('stop_village_butcher', {
            en: 'Village stop (butcher)',
            nl: 'Dorp/kustweg (bij de slager)',
            el: busT('bus_stop_village_butcher', 'Κέντρο/παραλία'),
        });
    }
    // Unknown: show raw key
    return key;
}

function busDaysLabel(daysValue) {
    const raw = String(daysValue || '').trim();
    if (!raw) return '';

    const key = raw.toLowerCase();
    // Huidige sheet: weekdays | daily | weekend
    if (key === 'daily') {
        return busText('runs_daily', { en: 'Daily', nl: 'Dagelijks', el: 'Καθημερινά' });
    }
    if (key === 'weekdays') {
        return busText('runs_weekdays', { en: 'Weekdays', nl: 'Doordeweeks', el: 'Δευ–Παρ' });
    }
    if (key === 'weekend') {
        return busText('runs_weekend', { en: 'Weekend', nl: 'Weekend', el: 'Σαβ–Κυρ' });
    }
    // Legacy patronen
    if (raw === '1-7') {
        return busText('runs_daily', { en: 'Daily', nl: 'Dagelijks', el: 'Καθημερινά' });
    }
    if (raw === '1-5') {
        return busText('runs_mon_fri', { en: 'Mon–Fri', nl: 'Ma–Vr', el: 'Δευ–Παρ' });
    }
    if (raw === '1-6') {
        return busText('runs_mon_sat', { en: 'Mon–Sat', nl: 'Ma–Za', el: 'Δευ–Σαβ' });
    }
    if (raw === '7') {
        return busText('runs_sun', { en: 'Sun', nl: 'Zo', el: 'Κυρ' });
    }

    return raw;
}

function busFrequencyLabel(freqValue) {
    const raw = String(freqValue || '').trim();
    if (!raw) return '';

    // Normalize a few common Dutch values used in the sheet
    const v = raw.toLowerCase();
    if (v === 'dagelijks') return busText('freq_daily', { en: 'Daily', nl: 'Dagelijks', el: 'Καθημερινά' });
    if (v === 'ma-vr' || v === 'ma–vr') return busText('freq_mon_fri', { en: 'Mon–Fri', nl: 'Ma–Vr', el: 'Δευ–Παρ' });
    if (v === 'ma-za' || v === 'ma–za') return busText('freq_mon_sat', { en: 'Mon–Sat', nl: 'Ma–Za', el: 'Δευ–Σαβ' });
    if (v === 'zo' || v === 'zondag') return busText('freq_sun', { en: 'Sun', nl: 'Zo', el: 'Κυρ' });

    // Fallback: show as-is
    return raw;
}

/** Font Awesome (solid) icoon voor patronen uit de sheet — Daily / Mon–Fri / weekend (legenda bus.html · bus-el.html). */
function busScheduleFaIconClass(pattern) {
    const p = String(pattern || '').toLowerCase();
    if (p === 'daily') return 'fa-arrows-rotate';
    if (p === 'weekdays') return 'fa-briefcase';
    if (p === 'weekend') return 'fa-umbrella-beach';
    return '';
}

function busScheduleGlyphIconHtml(pattern) {
    const cls = busScheduleFaIconClass(pattern);
    if (!cls) return '';
    return `<span class="bus-sched-icon" aria-hidden="true"><i class="fa-solid ${cls}" aria-hidden="true"></i></span>`;
}

/** Normalises sheet `days` to a badge pattern slug, or '' when unknown/custom. */
function busNormalizeSchedulePattern(daysRaw) {
    const raw = String(daysRaw || '').trim();
    const key = raw.toLowerCase();
    if (key === 'daily' || raw === '1-7') return 'daily';
    if (key === 'weekdays' || raw === '1-5') return 'weekdays';
    if (key === 'weekend') return 'weekend';
    if (raw === '1-6') return 'mon_sat';
    if (raw === '7') return 'sun';
    return '';
}

function busScheduleShortLabel(pattern) {
    switch (pattern) {
        case 'daily':
            return busText('runs_short_daily', { en: 'Daily', nl: 'Dagelijks', el: 'Καθημερινά' });
        case 'weekdays':
            return busText('runs_short_weekdays', { en: 'Mon–Fri', nl: 'Ma–vr', el: 'Δευ–Παρ' });
        case 'weekend':
            return busText('runs_short_weekend', { en: 'Sat–Sun', nl: 'Za–zo', el: 'Σαβ–Κυρ' });
        case 'mon_sat':
            return busText('runs_short_mon_sat', { en: 'Mon–Sat', nl: 'Ma–za', el: 'Δευ–Σαβ' });
        case 'sun':
            return busText('runs_short_sun', { en: 'Sundays', nl: 'Alleen zo', el: 'Κυριακές' });
        default:
            return '';
    }
}

function busScheduleLongPlain(pattern) {
    switch (pattern) {
        case 'daily':
            return busText('sched_plain_daily', {
                en: 'Every day',
                nl: 'Elke dag',
                el: 'Κάθε μέρα',
            });
        case 'weekdays':
            return busText('sched_plain_weekdays', {
                en: 'Monday to Friday',
                nl: 'Maandag t/m vrijdag',
                el: 'Δευτέρα έως Παρασκευή',
            });
        case 'weekend':
            return busText('sched_plain_weekend', {
                en: 'Saturday and Sunday',
                nl: 'Zaterdag en zondag',
                el: 'Σάββατο και Κυριακή',
            });
        case 'mon_sat':
            return busText('sched_plain_mon_sat', {
                en: 'Monday to Saturday',
                nl: 'Maandag t/m zaterdag',
                el: 'Δευτέρα έως Σάββατο',
            });
        case 'sun':
            return busText('sched_plain_sun', {
                en: 'Sundays only',
                nl: 'Alleen op zondag',
                el: 'Μόνο τις Κυριακές',
            });
        default:
            return '';
    }
}

/** Extra kolom frequency alleen als het geen dubbel is van dagpatroon. */
function busScheduleFqAddsInfo(pattern, daysRaw, frequency, longPlain) {
    const fqDisp = String(busFrequencyLabel(frequency) || '').trim();
    if (!fqDisp) return '';
    const short = busScheduleShortLabel(pattern);
    if (short && busFold(fqDisp) === busFold(short)) return '';
    if (longPlain && busFold(fqDisp) === busFold(longPlain)) return '';
    const dayL = String(busDaysLabel(daysRaw) || '').trim();
    if (dayL && busFold(fqDisp) === busFold(dayL)) return '';
    return fqDisp;
}

/** Platte beschrijving (aria, kopiëren): volledige zin waar mogelijk. */
function busScheduleDetailPlain(days, frequency) {
    const pattern = busNormalizeSchedulePattern(days);
    if (!pattern) {
        const dayL = busDaysLabel(days);
        const fqL = busFrequencyLabel(frequency);
        return [dayL, fqL].filter(Boolean).join(' · ') || '—';
    }
    const long = busScheduleLongPlain(pattern);
    const extra = busScheduleFqAddsInfo(pattern, days, frequency, long);
    return extra ? `${long} · ${extra}` : long;
}

/** Visueel: alleen pictogram bij de bestemming; legenda verklaart. Optioneel · extra kolom frequency. */
function busScheduleDetailHtml(days, frequency) {
    const pattern = busNormalizeSchedulePattern(days);
    if (!pattern) {
        return busEscapeHtml(busScheduleDetailPlain(days, frequency));
    }
    const tooltip = busScheduleDetailPlain(days, frequency);
    const extraFq = busScheduleFqAddsInfo(pattern, days, frequency, busScheduleLongPlain(pattern));
    const glyph = busScheduleGlyphIconHtml(pattern);
    let inner = glyph;
    if (extraFq) {
        if (glyph) {
            inner += `<span class="bus-runs-caption__sep" aria-hidden="true">\u00A0·\u00A0</span>`;
        }
        inner += `<span class="bus-runs-caption__extra">${busEscapeHtml(extraFq)}</span>`;
    }
    if (!inner) {
        return busEscapeHtml(busScheduleDetailPlain(days, frequency));
    }
    const titleEscaped = busEscapeHtml(tooltip);
    return `<span class="bus-runs-caption" aria-hidden="true" title="${titleEscaped}">${inner}</span>`;
}

function busShowingPrefix() {
    return busText('showing', {
        en: 'Showing',
        nl: 'Toont',
        el: busT('bus_showing', 'Εμφάνιση'),
    });
}

/** Welke lijnbeschrijving hoort bij gekozen bestemming (Volos = geen extra hint). */
function busLineHintKey(dir) {
    const d = String(dir || '').toLowerCase();
    if (['milies', 'vyzitsa', 'pinakates'].includes(d)) return 'berg';
    if (d === 'afissos' || d === 'neochori') return 'coast';
    if (['siki', 'promiri', 'katigiorgis'].includes(d)) return 'south_east';
    if (['argalasti', 'milina', 'platanias', 'trikeri'].includes(d)) return 'south';
    return '';
}

function busLineHintText(dir) {
    const key = busLineHintKey(dir);
    if (!key) return '';
    const lines = {
        berg: {
            en: 'Mountain line — daily, village centre stops.',
            nl: 'Berglijn — dagelijks, halte in het dorpscentrum.',
            el: '',
        },
        coast: {
            en: 'Coast line — daily, ideal for beaches.',
            nl: 'Kustlijn — dagelijks, geschikt voor stranden.',
            el: '',
        },
        south: {
            en: 'South line — daily, main road only.',
            nl: 'Zuidlijn — dagelijks, alleen hoofdweg.',
            el: '',
        },
        south_east: {
            en: 'South line (east) — Mon–Fri, main road only.',
            nl: 'Zuidlijn (oost) — ma–vr, alleen hoofdweg.',
            el: '',
        },
    };
    const m = lines[key];
    if (!m) return '';
    const k = `bus_line_${key}`;
    return busText(k, { en: m.en, nl: m.nl, el: busT(k, m.el) });
}

function busUpdateRouteSubtitle(dir) {
    const el = document.getElementById('bus-route');
    if (el) {
        const label = busDirLabel(dir);
        el.textContent = `${busShowingPrefix()}: ${label}`;
    }
    const hintEl = document.getElementById('bus-line-hint');
    if (hintEl) {
        const hint = busLineHintText(dir);
        hintEl.textContent = hint;
        hintEl.hidden = !hint;
    }
}

function busNowAthensParts(date = new Date()) {
    // Use Europe/Athens so "today" and time comparisons match local reality.
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Athens',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(date);
    const map = {};
    parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });
    return {
        ymd: `${map.year}-${map.month}-${map.day}`,
        hm: `${map.hour}:${map.minute}`
    };
}

function busClampDayOffset(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(BUS_DAY_OFFSET_MAX, Math.floor(x)));
}

/** Athens kalenderdatum YYYY-MM-DD voor strip-offset — zelfde civil-logica als n8n (addDaysToGregorianYmd). */
function busScheduleTargetYmd(dayOffset) {
    const off = busClampDayOffset(dayOffset);
    const today = busNowAthensParts();
    const [y, m, d] = today.ymd.split('-').map(Number);
    const x = new Date(Date.UTC(y, m - 1, d + off));
    const ys = x.getUTCFullYear();
    const ms = String(x.getUTCMonth() + 1).padStart(2, '0');
    const ds = String(x.getUTCDate()).padStart(2, '0');
    return `${ys}-${ms}-${ds}`;
}

function busScheduleSlotKey(dir, dayOffset) {
    return `${dir}:${busScheduleTargetYmd(dayOffset)}`;
}

/** Instant for Athens calendar day = today + offset (0..6), from today's Athens ymd. */
function busAthensTargetInstant(dayOffset) {
    const off = busClampDayOffset(dayOffset);
    const today = busNowAthensParts();
    const [y, m, d] = today.ymd.split('-').map(Number);
    const ms = Date.UTC(y, m - 1, d, 12, 0, 0) + off * 86400000;
    return new Date(ms);
}

function busAthensTargetLabels(dayOffset) {
    const off = busClampDayOffset(dayOffset);
    const inst = busAthensTargetInstant(off);
    const loc = busLang() === 'el' ? 'el-GR' : 'en-GB';
    const weekday = new Intl.DateTimeFormat(loc, { timeZone: 'Europe/Athens', weekday: 'short' }).format(inst);
    const dayMonthCompact = new Intl.DateTimeFormat(loc, { timeZone: 'Europe/Athens', day: 'numeric', month: 'short' }).format(inst);
    const monthTitleFmt = busLang() === 'el' ? 'long' : 'short';
    const dayMonthTitle = new Intl.DateTimeFormat(loc, { timeZone: 'Europe/Athens', day: 'numeric', month: monthTitleFmt }).format(inst);
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Athens',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(inst);
    const map = {};
    parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });
    const ymd = `${map.year}-${map.month}-${map.day}`;
    return { weekday, dayMonthCompact, dayMonthTitle, ymd, inst };
}

function busHeadingPrimaryLine(dayOffset) {
    const off = busClampDayOffset(dayOffset);
    if (off === 0) {
        return busText('bus_heading_today', {
            en: 'TODAY',
            nl: 'VANDAAG',
            el: busT('bus_heading_today', 'ΣΗΜΕΡΑ'),
        });
    }
    if (off === 1) {
        return busText('bus_heading_tomorrow_upper', {
            en: 'TOMORROW',
            nl: 'MORGEN',
            el: busT('bus_heading_tomorrow_upper', 'ΑΎΡΙΟ'),
        });
    }
    const { weekday, dayMonthTitle } = busAthensTargetLabels(off);
    const tpl = busText('bus_heading_weekday_date', {
        en: '{weekday} {date}',
        nl: '{weekday} {date}',
        el: busT('bus_heading_weekday_date', '{weekday} {date}'),
    });
    return tpl.replace('{weekday}', weekday).replace('{date}', dayMonthTitle);
}

function busFullTimetableTitle(dayOffset) {
    const off = busClampDayOffset(dayOffset);
    if (off === 0) {
        return busText('bus_full_title_today', {
            en: 'Full timetable today',
            nl: 'Volledig schema vandaag',
            el: busT('bus_full_title_today', 'Πλήρες πρόγραμμα σήμερα'),
        });
    }
    const { weekday, dayMonthTitle } = busAthensTargetLabels(off);
    const dateStr = `${weekday} ${dayMonthTitle}`;
    const tpl = busText('bus_full_title_date', {
        en: 'Full timetable · {date}',
        nl: 'Volledig schema · {date}',
        el: busT('bus_full_title_date', 'Πλήρες πρόγραμμα · {date}'),
    });
    return tpl.replace('{date}', dateStr);
}

function busParseHHMMToMinutes(hhmm) {
    if (!hhmm) return null;
    const m = String(hhmm).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
}

const BUS_DIR_LABELS = {
    volos: { en: 'Volos', el: 'Βόλος' },
    milies: { en: 'Milies', el: 'Μηλιές' },
    argalasti: { en: 'Argalasti', el: 'Αργαλαστή' },
    afissos: { en: 'Afissos', el: 'Άφησσος' },
    vyzitsa: { en: 'Vyzitsa', el: 'Βυζίτσα' },
    pinakates: { en: 'Pinakates', el: 'Πινακάτες' },
    neochori: { en: 'Neochori', el: 'Νεοχώρι' },
    siki: { en: 'Siki', el: 'Σήκι' },
    promiri: { en: 'Promiri', el: 'Προμήρι' },
    katigiorgis: { en: 'Katigiorgis', el: 'Κατηγιώργης' },
    milina: { en: 'Milina', el: 'Μηλίνα' },
    platanias: { en: 'Platanias', el: 'Πλατανιάς' },
    trikeri: { en: 'Trikeri', el: 'Τρίκερι' },
};

function busDirLabel(dir) {
    const key = String(dir || '').toLowerCase();
    const row = BUS_DIR_LABELS[key];
    if (!row) return dir;
    return busLang() === 'el' ? row.el : row.en;
}

/** Normaliseer voor vergelijk EN/EL namen met sheet (zonder accenten). */
function busFold(s) {
    return String(s || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Sheet «origin» is usually the stop in Kala Nera — treat as repeated so we can show destination only.
 * Latin / Greek spellings; empty origin → default stop.
 */
function busIsKalaNeraOrigin(bus) {
    const raw = String(bus && bus.origin || '').trim();
    if (!raw) return true;
    const compact = busFold(raw).replace(/\s+/g, '');
    if (compact === 'kalanera' || (compact.includes('kala') && compact.includes('nera'))) return true;
    if (/καλ/.test(raw) && /νερ/.test(raw)) return true;
    return false;
}

/**
 * Primary direction line for timetable rows — destination only when origin is the Kala Nera stop.
 */
function busTripDestinationLine(bus) {
    const dest = String(bus && bus.destination || '').trim();
    const origin = String(bus && bus.origin || '').trim();
    if (busIsKalaNeraOrigin(bus)) {
        return dest || origin || '—';
    }
    if (origin && dest) return `${origin} ➔ ${dest}`;
    return dest || origin || '—';
}

function busFullTimetableOriginNoteText() {
    return busText('bus_full_timetable_origin', {
        en: 'Departures · Kala Nera stop',
        nl: 'Vertrek · halte Kala Nera',
        el: busT('bus_full_timetable_origin', 'Από στάση Καλά Νερά'),
    });
}

/** Per sheet-row: weekdays label + frequency label; merged splits when these differ between destinations */
function busComputeRunsMeta(rows, routeDirKey) {
    if (!rows || rows.length === 0) return null;
    const routeDir = String(routeDirKey || '').toLowerCase();
    const segments = rows.map((r) => {
        const d = String(r.dir || '').trim().toLowerCase();
        const label = String(r.destination || '').trim() || busDirLabel(d) || '';
        const detailPlain = busScheduleDetailPlain(r.days, r.frequency);
        const detailHtml = busScheduleDetailHtml(r.days, r.frequency);
        const sortPri = d === routeDir ? 0 : (d ? 1 : 2);
        return { label: label || '—', detailPlain, detailHtml, sortPri, d };
    }).sort((a, b) => {
        if (a.sortPri !== b.sortPri) return a.sortPri - b.sortPri;
        return String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' });
    });
    return { segments };
}

/**
 * destination_also (Also: …) lists extra passenger stops served on the same departure as the primary row —
 * repeat the same Runs detail for each listed place (sheet seldom has separate rows per Via-stop).
 */
function busExpandRunsMetaWithAlsoStops(bus, meta) {
    if (!meta || !meta.segments || !meta.segments.length) return meta;
    const alsoRaw = String(bus.destination_also || '').trim();
    if (!alsoRaw) return meta;

    const firstDetailNorm = String(meta.segments[0].detailPlain || '').trim();
    const allSegmentsSameFreq = meta.segments.every(
        (s) => String(s.detailPlain || '').trim() === firstDetailNorm
    );
    if (!(meta.segments.length === 1 || allSegmentsSameFreq)) return meta;

    const templatePlain = meta.segments[0].detailPlain;
    const detailTemplate = templatePlain ? String(templatePlain).trim() : '—';
    const templateHtml = meta.segments[0].detailHtml;

    const seenLabels = new Set();
    meta.segments.forEach((s) => {
        seenLabels.add(busFold(s.label || ''));
    });
    seenLabels.add(busFold(busTripDestinationLine(bus)));

    const extraSegs = [];
    alsoRaw.split(/[,;|]/).forEach((chunk) => {
        let lab = chunk.trim().replace(/^also\s*[:\uff1a]/i, '').trim();
        if (!lab) return;
        lab = lab.replace(/^επίσης\s*[:\uff1a]\s*/i, '').trim();
        const fk = busFold(lab);
        if (!fk || seenLabels.has(fk)) return;
        seenLabels.add(fk);
        extraSegs.push({
            label: lab,
            detailPlain: detailTemplate,
            detailHtml: templateHtml != null ? templateHtml : busEscapeHtml(detailTemplate),
            sortPri: 3,
            d: '',
        });
    });

    if (!extraSegs.length) return meta;

    const segments = [...meta.segments, ...extraSegs].sort((a, b) => {
        if ((a.sortPri ?? 99) !== (b.sortPri ?? 99)) return (a.sortPri ?? 99) - (b.sortPri ?? 99);
        return String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' });
    });

    return { segments };
}

function busResolveRunsMeta(bus, routeDirKey) {
    let meta = bus.runs_meta || busComputeRunsMeta([bus], routeDirKey);
    return busExpandRunsMetaWithAlsoStops(bus, meta);
}

/**
 * Elk {label, detailPlain, detailHtml} uit sheet-segmenten + Also-uitbreiding; dedupe op genormaliseerde naam.
 */
function busUnifiedDestinationsList(bus, routeDirKey) {
    const meta = busResolveRunsMeta(bus, routeDirKey);
    const segs = meta && meta.segments && meta.segments.length ? meta.segments : [];

    const map = new Map();
    for (const s of segs) {
        const lab = String(s.label || '').trim();
        const fk = busFold(lab);
        if (!fk) continue;
        const detailPlain = String(s.detailPlain || s.detail || '').trim() || '—';
        const detailHtml = s.detailHtml != null ? s.detailHtml : busEscapeHtml(detailPlain);
        if (!map.has(fk)) map.set(fk, { label: lab, detailPlain, detailHtml });
    }

    let list = [...map.values()];
    if (!list.length) {
        const p = String(busTripDestinationLine(bus)).trim();
        const detailPlain = busScheduleDetailPlain(bus.days, bus.frequency);
        const detailHtml = busScheduleDetailHtml(bus.days, bus.frequency);
        list = [{ label: p || '—', detailPlain, detailHtml }];
    }

    return list;
}

/** Platte tekst (aria-label, kopie); zonder HTML. */
function busUnifiedDestinationsPlain(bus, routeDirKey) {
    const list = busUnifiedDestinationsList(bus, routeDirKey);
    return list
        .map(({ label, detailPlain }) => {
            const d = String(detailPlain || '').trim();
            if (!d || d === '—') return label;
            return `${label} · ${d}`;
        })
        .join(' · ');
}

/** Per bestemming als flex-item: scheiding zit vóór nr. 2+, dus nooit een losse «·» aan regel-einde. */
function busUnifiedDestinationsHtml(bus, routeDirKey) {
    const list = busUnifiedDestinationsList(bus, routeDirKey);
    if (!list.length) return '';
    return list
        .map(({ label, detailHtml, detailPlain }, idx) => {
            const d = String(detailPlain || '').trim();
            const hasSched = d && d !== '—';
            const stop = hasSched
                ? `<span class="bus-route-stop"><span class="bus-route-stop__block"><span class="bus-route-stop__dest">${busEscapeHtml(label)}</span><span class="bus-route-stop__sched">${detailHtml}</span></span></span>`
                : `<span class="bus-route-stop">${busEscapeHtml(label)}</span>`;
            if (idx === 0) return `<span class="bus-route-item">${stop}</span>`;
            return `<span class="bus-route-item"><span class="bus-route-sep" aria-hidden="true">\u00A0·\u00A0</span>${stop}</span>`;
        })
        .join('');
}

function busNormSheetKey(k) {
    return String(k || '')
        .replace(/^\ufeff/, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

/** Sheet-kolom vinden ongeacht header-casing/spaties/BOM (zelfde logica als n8n). */
function busSheetField(row, aliases) {
    if (!row || typeof row !== 'object') return undefined;
    const wanted = new Set(aliases.map((a) => busNormSheetKey(a)));
    for (const key of Object.keys(row)) {
        if (wanted.has(busNormSheetKey(key))) return row[key];
    }
    return undefined;
}

/** Map één token uit Destinations_Served naar een `dir`-slug. */
function busSlugFromDestinationToken(token) {
    const raw = String(token || '').trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    if (BUS_VALID_DIRS.includes(lower)) return lower;
    const f = busFold(raw);
    const typos = { vizitsa: 'vyzitsa', pinakes: 'pinakates' };
    if (typos[f] && BUS_VALID_DIRS.includes(typos[f])) return typos[f];
    for (const slug of BUS_VALID_DIRS) {
        if (busFold(slug) === f) return slug;
        const row = BUS_DIR_LABELS[slug];
        if (row && (busFold(row.en) === f || busFold(row.el) === f)) return slug;
    }
    return '';
}

function busNormalizeJsonQuotes(s) {
    return String(s || '')
        .replace(/\u201c|\u201d/g, '"')
        .replace(/\u2018|\u2019/g, "'");
}

function busParseDirsServedField(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) {
        return [...new Set(raw.map(t => busSlugFromDestinationToken(String(t))).filter(Boolean))];
    }
    const s = String(raw).trim();
    if (!s) return [];
    if (s.startsWith('[')) {
        try {
            const arr = JSON.parse(busNormalizeJsonQuotes(s));
            if (Array.isArray(arr)) {
                return [...new Set(arr.map(t => busSlugFromDestinationToken(String(t))).filter(Boolean))];
            }
        } catch (e) { /* CSV-fallback */ }
    }
    return [...new Set(s.split(/[,;|]/).map(part => busSlugFromDestinationToken(part.trim())).filter(Boolean))];
}

/**
 * Geconsolideerde sheet-rij: zet primary destination + Also:-lijst op basis van gekozen `routeDir`.
 * Rijen zonder dirs_served blijven ongewijzigd (legacy / n8n-expand).
 * Rijen waar routeDir niet in dirs_served zit worden weggefilterd (n8n zou ze al moeten weglaten).
 */
function busApplyConsolidatedList(buses, routeDir) {
    const key = String(routeDir || '').toLowerCase();
    if (!buses || !buses.length) return [];
    const out = [];
    for (const b of buses) {
        const slugs = b.dirs_served && b.dirs_served.length ? b.dirs_served : null;
        if (!slugs) {
            out.push(b);
            continue;
        }
        if (!slugs.includes(key)) continue;
        const primaryDest = busDirLabel(key);
        const alsoLabels = slugs.filter(d => d !== key).map(d => busDirLabel(d)).filter(Boolean);
        const alsoUnique = [...new Set(alsoLabels)].filter(l => l !== primaryDest);
        out.push({
            ...b,
            dir: key,
            destination: primaryDest,
            destination_also: alsoUnique.join(', '),
        });
    }
    return out;
}

function busLowFreqNoticeText() {
    return busText('bus_low_freq', {
        en: 'Check return times with the driver',
        nl: 'Controleer terugreis bij de chauffeur',
        el: busT('bus_low_freq', 'Ρωτήστε τον οδηγό για επιστροφή'),
    });
}

function busRenderSkeleton(container) {
    if (!container) return;
    container.innerHTML = `
        <div class="bus-skeleton" aria-hidden="true"></div>
        <div class="bus-skeleton" aria-hidden="true"></div>
        <div class="bus-skeleton" aria-hidden="true"></div>
    `;
}

function busRenderError(container, retryBtn) {
    if (!container) return;
    container.innerHTML = `<div class="bus-error">${busT('bus_unavailable', 'Timetable currently unavailable.')}</div>`;
    if (retryBtn) retryBtn.hidden = false;
}

function busRenderEmpty(container, dayOffset = 0) {
    if (!container) return;
    const off = busClampDayOffset(dayOffset);
    const msg = off === 0
        ? busT('bus_today_none', 'No more buses for today.')
        : busText('bus_day_none', {
            en: 'No departures on this day.',
            nl: 'Geen ritten op deze dag.',
            el: busT('bus_day_none', 'Δεν υπάρχουν δρομολόγια αυτή την ημέρα.'),
        });
    container.innerHTML = `<div class="bus-empty">${busEscapeHtml(msg)}</div>`;
}

function busEscapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function busFormatLastUpdated(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    const isEl = (currentLang === 'el');
    const locale = isEl ? 'el-GR' : 'en-GB';
    const txt = d.toLocaleString(locale, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const prefix = busT('bus_last_updated', 'Last updated');
    return `${prefix}: ${txt}`;
}

function busNormalizeItem(item) {
    // Accept either "stable API contract" OR raw sheet columns.
    const j = item && item.json ? item.json : item;
    const departure = busSheetField(j, ['time_kalanera', 'Time_KalaNera', 'departure', 'Departure', 'Time', 'Time_KalaNera_Departure'])
        || j.Time_KalaNera || j.departure || j.Departure || j.Time || j.Time_KalaNera_Departure || '';
    const origin = j.origin || j.Origin || 'Kala Nera';
    const destination = j.destination || j.Destination || j.Final || j.Arrival_Final || '';
    const arrival = j.arrival || j.Arrival || j.Arrival_Final || '';
    const note = (currentLang === 'el')
        ? (busSheetField(j, ['note_gr', 'Note_GR', 'note_el', 'Note_EL', 'Note']) ?? j.Note_GR ?? j.note_el ?? j.Note_EL ?? j.Note ?? '')
        : (busSheetField(j, ['note_en', 'Note_EN', 'note', 'Note']) ?? j.Note_EN ?? j.note_en ?? j.Note ?? '');
    const dir = j.dir || j.Direction || j.Route || '';
    const stop_kalanera = j.stop_kalanera || j.Stop_KalaNera || '';
    let days = busSheetField(j, ['days', 'Days']) ?? j.days ?? j.Days ?? '';
    let category = busSheetField(j, ['category', 'Category']) ?? j.category ?? j.Category ?? '';
    const categoryDaysJoined = j.CategoryDays || j.category_days;
    if ((!category || !days) && categoryDaysJoined != null && String(categoryDaysJoined).trim()) {
        const parts = String(categoryDaysJoined).split(/\s*[|/]\s*|\t+/);
        if (!category && parts[0]) category = parts[0].trim();
        if (!days && parts[1]) days = parts[1].trim();
    }
    const frequency = busSheetField(j, ['frequency', 'Frequency']) ?? j.frequency ?? j.Frequency ?? '';
    const trip_id = j.trip_id || j.Trip_ID || j.tripId || '';
    const slugCol = busSheetField(j, ['dirs_served', 'Dirs_Served']) ?? j.dirs_served ?? j.Dirs_Served;
    const nameCol = busSheetField(j, ['destinations_served', 'Destinations_Served']) ?? j.destinations_served ?? j.Destinations_Served;
    const slugStr = slugCol != null ? String(slugCol).trim() : '';
    const nameStr = nameCol != null ? String(nameCol).trim() : '';
    let dirs_served = slugStr ? busParseDirsServedField(slugCol) : [];
    if (!dirs_served.length && nameStr) dirs_served = busParseDirsServedField(nameCol);
    const route_name = busSheetField(j, ['route_name', 'Route_Name']) ?? j.route_name ?? j.Route_Name ?? '';
    const idRaw = busSheetField(j, ['id', 'ID']) ?? j.ID ?? j.id;
    const sheet_id = idRaw != null && idRaw !== '' ? String(idRaw) : '';
    return {
        departure,
        origin,
        destination,
        arrival,
        note,
        dir,
        stop_kalanera,
        days,
        frequency,
        trip_id,
        dirs_served,
        category,
        route_name,
        sheet_id,
    };
}

function busTripIdKey(raw) {
    const s = String(raw || '').trim();
    return s;
}

/**
 * Vouwt sheet-rijen met dezelfde Trip_ID samen tot één kaart (Kala Nera-perspectief).
 * Lege trip_id: rij blijft los staan (geen merge).
 */
function busMergeTripsByTripId(buses, routeDir) {
    if (!buses || buses.length === 0) return [];
    const dirKey = String(routeDir || '').toLowerCase();
    const withId = [];
    const withoutId = [];
    for (const b of buses) {
        if (busTripIdKey(b.trip_id)) withId.push(b);
        else withoutId.push(b);
    }
    const groups = new Map();
    for (const b of withId) {
        const k = busTripIdKey(b.trip_id);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(b);
    }
    const merged = [];
    for (const rows of groups.values()) {
        merged.push(busMergeTripGroup(rows, dirKey));
    }
    return busSortByDeparture([...merged, ...withoutId]);
}

function busMergeTripGroup(rows, dirKey) {
    if (!rows || rows.length === 0) return {};
    if (rows.length === 1) {
        const one = rows[0];
        const runs_meta = busComputeRunsMeta(rows, dirKey);
        return { ...one, destination_also: one.destination_also || '', runs_meta };
    }

    const sortedForPrimary = [...rows].sort((a, b) => {
        const am = String(a.dir || '').toLowerCase() === dirKey ? 0 : 1;
        const bm = String(b.dir || '').toLowerCase() === dirKey ? 0 : 1;
        return am - bm;
    });
    const primary = sortedForPrimary[0];

    const depVals = [...new Set(rows.map(r => String(r.departure || '').trim()).filter(Boolean))];
    const departure = depVals.length === 1 ? depVals[0] : String(primary.departure || '').trim();

    const seenDirs = [];
    const seenSet = new Set();
    for (const d of BUS_VALID_DIRS) {
        if (rows.some(r => String(r.dir || '').toLowerCase() === d) && !seenSet.has(d)) {
            seenSet.add(d);
            seenDirs.push(d);
        }
    }
    for (const r of rows) {
        const d = String(r.dir || '').toLowerCase();
        if (d && !seenSet.has(d)) {
            seenSet.add(d);
            seenDirs.push(d);
        }
    }

    const primaryDest = (String(primary.destination || '').trim())
        || busDirLabel(dirKey)
        || (seenDirs[0] ? busDirLabel(seenDirs[0]) : '');

    const alsoLabels = seenDirs
        .filter(d => d !== dirKey)
        .map(d => busDirLabel(d))
        .filter(Boolean);
    const alsoUnique = [...new Set(alsoLabels)].filter(l => l !== primaryDest);
    const destination_also = alsoUnique.join(', ');

    const daysVals = [...new Set(rows.map(r => String(r.days || '').trim()).filter(Boolean))];
    const days = daysVals.length === 1 ? daysVals[0] : primary.days;

    const stopVals = [...new Set(rows.map(r => String(r.stop_kalanera || '').trim()).filter(Boolean))];
    const stop_kalanera = stopVals.length === 1 ? stopVals[0] : primary.stop_kalanera;

    const arrVals = [...new Set(rows.map(r => String(r.arrival || '').trim()).filter(Boolean))];
    const arrival = arrVals.length === 1 ? arrVals[0] : String(primary.arrival || '').trim();

    const noteParts = [...new Set(rows.map(r => String(r.note || '').trim()).filter(Boolean))];
    const note = noteParts.join(' · ');

    const runs_meta = busComputeRunsMeta(rows, dirKey);

    return {
        departure,
        origin: primary.origin,
        destination: primaryDest,
        destination_also,
        arrival,
        note,
        dir: dirKey,
        stop_kalanera,
        days,
        frequency: primary.frequency,
        trip_id: primary.trip_id,
        runs_meta,
    };
}

function busFilterRemainingToday(buses, minMinutesNow) {
    const nowParts = busNowAthensParts();
    const nowMin = busParseHHMMToMinutes(nowParts.hm);
    if (nowMin === null) return buses;
    const cutoff = Math.max(0, nowMin - (minMinutesNow || 0));
    return buses.filter(b => {
        const depMin = busParseHHMMToMinutes(b.departure);
        if (depMin === null) return false;
        return depMin >= cutoff;
    });
}

/** Index van de eerste bus die nog niet gepasseerd is (zelfde buffer als „Next bus“). */
function busNextDepartureIndex(sortedBuses, minMinutesNow) {
    const nowParts = busNowAthensParts();
    const nowMin = busParseHHMMToMinutes(nowParts.hm);
    if (nowMin === null) return -1;
    const cutoff = Math.max(0, nowMin - (minMinutesNow || 0));
    for (let i = 0; i < sortedBuses.length; i++) {
        const depMin = busParseHHMMToMinutes(sortedBuses[i].departure);
        if (depMin === null) continue;
        if (depMin >= cutoff) return i;
    }
    return -1;
}

function busSortByDeparture(buses) {
    return buses.sort((a, b) => {
        const am = busParseHHMMToMinutes(a.departure);
        const bm = busParseHHMMToMinutes(b.departure);
        if (am === null && bm === null) return 0;
        if (am === null) return 1;
        if (bm === null) return -1;
        return am - bm;
    });
}

/** Label above departure time: always two short lines (stack) so card height matches across languages and avoids awkward wraps (e.g. «main-road») in narrow columns or after browser translation. */
function busDepartureCaptionParts() {
    let l1;
    let l2;
    if (busLang() === 'el') {
        l1 = busT('bus_departure_el_l1', 'Αναχώρηση');
        l2 = busT('bus_departure_el_l2', 'Καλά Νερά');
    } else {
        l1 = busText('bus_departure_l1', {
            en: 'Time at stop',
            nl: 'Tijd bij halte',
            el: '',
        });
        l2 = busText('bus_departure_l2', {
            en: 'Kala Nera',
            nl: 'Kala Nera',
            el: '',
        });
    }
    const aria = busEscapeHtml(`${l1} ${l2}`);
    const html = `<div class="bus-time-label bus-time-label--stack"><span class="bus-time-label-line">${busEscapeHtml(l1)}</span><span class="bus-time-label-line">${busEscapeHtml(l2)}</span></div>`;
    return { aria, html };
}

function busRenderList(container, buses, { limit, routeDir, dayOffset } = {}) {
    if (!container) return;
    const off = busClampDayOffset(dayOffset);
    if (!buses || buses.length === 0) return busRenderEmpty(container, off);

    const arrivalPrefix = busT('bus_arrival_prefix', 'Est. arrival');
    const depCap = busDepartureCaptionParts();
    const max = (typeof limit === 'number') ? limit : 8;
    const dirKey = String(routeDir || '').toLowerCase();
    const showLowFreq = BUS_LOW_FREQ_DIRS.has(dirKey);
    const lowFreqHtml = showLowFreq
        ? `<div class="bus-note bus-note--lowfreq" role="note"><i class="fa-solid fa-circle-info bus-note--lowfreq-icon" aria-hidden="true"></i><span class="bus-note--lowfreq-text">${busEscapeHtml(busLowFreqNoticeText())}</span></div>`
        : '';
    container.innerHTML = buses.slice(0, Math.max(0, max)).map(bus => {
        const dep = busEscapeHtml(bus.departure);
        const stopsHtml = busUnifiedDestinationsHtml(bus, dirKey);
        const note = busEscapeHtml(bus.note);
        const arr = bus.arrival ? busEscapeHtml(`${arrivalPrefix}: ${bus.arrival}`) : '';
        const stopText = busStopLabel(bus.stop_kalanera);
        const stopLabel = stopText
            ? busEscapeHtml(`${busText('stop_label', { en: 'Stop', nl: 'Halte', el: busT('bus_stop_label', 'Στάση') })}: ${stopText}`)
            : '';
        return `
            <div class="bus-card">
                <div class="bus-time-wrap" role="group" aria-label="${depCap.aria}">
                    ${depCap.html}
                    <div class="bus-time">${dep}</div>
                </div>
                <div class="bus-info">
                    <div class="bus-route-stops">${stopsHtml}</div>
                    ${note ? `<div class="bus-note">${note}</div>` : ``}
                    ${stopLabel ? `<div class="bus-stop">${stopLabel}</div>` : ``}
                    ${arr ? `<div class="bus-arrival">${arr}</div>` : ``}
                </div>
                ${lowFreqHtml}
            </div>
        `;
    }).join('');
}

function busRenderTimelineList(container, buses, { limit, routeDir, dayOffset } = {}) {
    if (!container) return;
    const off = busClampDayOffset(dayOffset);
    if (!buses || buses.length === 0) return busRenderEmpty(container, off);

    const arrivalPrefix = busT('bus_arrival_prefix', 'Est. arrival');
    const max = (typeof limit === 'number') ? limit : 8;
    const dirKey = String(routeDir || '').toLowerCase();
    const showLowFreq = BUS_LOW_FREQ_DIRS.has(dirKey);
    const lowFreqHtml = showLowFreq
        ? `<div class="bus-note bus-note--lowfreq bus-note--lowfreq--timeline" role="note"><i class="fa-solid fa-circle-info bus-note--lowfreq-icon" aria-hidden="true"></i><span class="bus-note--lowfreq-text">${busEscapeHtml(busLowFreqNoticeText())}</span></div>`
        : '';
    const { weekday, dayMonthTitle } = busAthensTargetLabels(off);
    const dateStr = `${weekday} ${dayMonthTitle}`;
    const listAriaPlain = off === 0
        ? busText('bus_timeline_list_aria', {
            en: 'Today\'s departures in time order',
            nl: 'Vertrektijden van vandaag op volgorde',
            el: busT('bus_timeline_list_aria', 'Σημερινές αναχωρήσεις σε χρονική σειρά'),
        })
        : busText('bus_timeline_list_aria_date', {
            en: `Departures on ${dateStr} in time order`,
            nl: `Vertrektijden op ${dateStr} op volgorde`,
            el: busT('bus_timeline_list_aria_date', 'Αναχωρήσεις {date} σε χρονική σειρά').replace('{date}', dateStr),
        });
    const listAria = busEscapeHtml(listAriaPlain);

    const nextIdx = off === 0 ? busNextDepartureIndex(buses, 10) : -1;
    const nextLblPlain = busText('bus_timeline_next_badge', {
        en: 'Next bus',
        nl: 'Volgende bus',
        el: busT('bus_timeline_next_badge', 'Επόμενο'),
    });

    const itemsHtml = buses.slice(0, Math.max(0, max)).map((bus, idx, list) => {
        const dep = busEscapeHtml(bus.departure);
        const stopsPlain = busUnifiedDestinationsPlain(bus, dirKey);
        const stopsHtml = busUnifiedDestinationsHtml(bus, dirKey);
        const isLast = idx === list.length - 1;
        const isNext = nextIdx >= 0 && idx === nextIdx;
        const itemAria = busEscapeHtml(
            `${isNext ? `${nextLblPlain}: ` : ''}${String(bus.departure || '').trim()}: ${stopsPlain}`
        );
        const note = bus.note ? busEscapeHtml(bus.note) : '';
        const arrivalLine = bus.arrival ? busEscapeHtml(`${arrivalPrefix}: ${bus.arrival}`) : '';
        const stopText = busStopLabel(bus.stop_kalanera);
        const stopLabel = stopText
            ? busEscapeHtml(`${busText('stop_label', { en: 'Stop', nl: 'Halte', el: busT('bus_stop_label', 'Στάση') })}: ${stopText}`)
            : '';
        const metaLine = stopLabel || '';
        return `
            <li class="bus-timeline__item${isNext ? ' bus-timeline__item--next' : ''}${isLast ? ' bus-timeline__item--last' : ''}" aria-label="${itemAria}">
                <div class="bus-timeline__axis" aria-hidden="true">
                    <span class="bus-timeline__dot"></span>
                    ${isLast ? '' : '<span class="bus-timeline__stem"></span>'}
                </div>
                <div class="bus-timeline__time-col">
                    <div class="bus-timeline__time-row">
                        <span class="bus-timeline__time">${dep}</span>
                        ${isNext ? `<span class="bus-timeline__time-bus" aria-hidden="true"><i class="fa-solid fa-bus"></i></span>` : ''}
                    </div>
                </div>
                <div class="bus-timeline__body">
                    <div class="bus-route-stops">${stopsHtml}</div>
                    ${note ? `<div class="bus-timeline__note">${note}</div>` : ``}
                    ${metaLine ? `<div class="bus-timeline__meta">${metaLine}</div>` : ``}
                    ${arrivalLine ? `<div class="bus-timeline__arrival">${arrivalLine}</div>` : ``}
                </div>
            </li>
        `;
    }).join('');

    container.innerHTML = `
        <ol class="bus-timeline" aria-label="${listAria}">${itemsHtml}</ol>
        ${lowFreqHtml}
    `;
}

function busRenderFullTimetable(container, buses, { routeDir, dayOffset } = {}) {
    if (!container) return;
    busRenderTimelineList(container, buses, { limit: 500, routeDir, dayOffset });
}

async function busFetchSchedule(dir, dayOffset) {
    const url = new URL(N8N_WEBHOOK_URL_BUS_SCHEDULE_NEXT);
    // ?from=Kala%20Nera&dir=…&remaining=0|1&dayOffset=0..6 (Athens calendar day; n8n filters days column for that weekday)
    url.searchParams.set('from', 'Kala Nera');
    url.searchParams.set('dir', dir || BUS_DEFAULT_DIR);
    url.searchParams.set('remaining', '0');
    url.searchParams.set('dayOffset', String(busClampDayOffset(dayOffset)));

    const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });
    if (!res.ok) throw new Error(`Bus schedule fetch failed: ${res.status}`);
    return await res.json();
}

function busReadCacheSlot(dir, dayOffset) {
    try {
        const raw = localStorage.getItem(BUS_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (parsed.version !== 3 || !parsed.slots || typeof parsed.slots !== 'object') return null;
        const key = busScheduleSlotKey(dir, dayOffset);
        const slot = parsed.slots[key];
        if (!slot || !Array.isArray(slot.items)) return null;
        return { savedAt: slot.savedAt, items: slot.items };
    } catch (e) {
        return null;
    }
}

function busWriteCacheSlot(dir, dayOffset, items) {
    try {
        let slots = {};
        const raw = localStorage.getItem(BUS_STORAGE_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.version === 3 && parsed.slots && typeof parsed.slots === 'object') {
                    slots = { ...parsed.slots };
                }
            } catch (e) { /* ignore */ }
        }
        const key = busScheduleSlotKey(dir, dayOffset);
        slots[key] = {
            savedAt: new Date().toISOString(),
            items: Array.isArray(items) ? items : [],
        };
        localStorage.setItem(BUS_STORAGE_KEY, JSON.stringify({ version: 3, slots }));
    } catch (e) { /* ignore */ }
}

/** @returns {Record<string, { savedAt?: string, items?: unknown[] }>|null} */
function busGetSlotsFromStorage() {
    try {
        const raw = localStorage.getItem(BUS_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== 3 || !parsed.slots || typeof parsed.slots !== 'object') return null;
        return parsed.slots;
    } catch (e) {
        return null;
    }
}

/** Shims for callers that only cache “today” (offset 0). */
function busReadCache(dir) {
    const s = busReadCacheSlot(dir, 0);
    if (!s) return null;
    return { savedAt: s.savedAt, byDir: { [dir]: s.items } };
}

function busWriteCache(dir, data) {
    busWriteCacheSlot(dir, 0, data);
}

function busCacheFresh(savedAtIso) {
    if (!savedAtIso) return false;
    const ms = new Date(savedAtIso).getTime();
    if (Number.isNaN(ms)) return false;
    return (Date.now() - ms) <= BUS_CACHE_TTL_MS;
}

/**
 * When online, fetch every destination not yet present in cache (background, paced).
 * Prefetches only dayOffset 0 (today) per dir for offline baseline.
 */
async function busPrefetchMissingDirs() {
    if (!navigator.onLine) return;
    const slots = busGetSlotsFromStorage() || {};
    const missing = BUS_VALID_DIRS.filter((d) => {
        const slot = slots[busScheduleSlotKey(d, 0)];
        return !slot || !Array.isArray(slot.items);
    });
    if (!missing.length) return;
    for (const dir of missing) {
        try {
            const data = await busFetchSchedule(dir, 0);
            const list = Array.isArray(data) ? data : (data && data.items ? data.items : []);
            busWriteCacheSlot(dir, 0, list);
        } catch (e) { /* skip dir */ }
        await new Promise((r) => setTimeout(r, 150));
    }
}

/** KTEL Pelion / Magnesia map in <dialog> (bus full pages only). */
function busInitPelionMapDialog() {
    const dialog = document.getElementById('bus-pelion-map-dialog');
    if (!dialog) return;
    const img = document.getElementById('bus-pelion-map-img');
    const dataSrc = img && img.dataset ? img.dataset.mapSrc : '';
    const ensureImgSrc = () => {
        if (img && dataSrc && !img.getAttribute('src')) img.setAttribute('src', dataSrc);
    };
    const open = () => {
        ensureImgSrc();
        if (typeof dialog.showModal === 'function') dialog.showModal();
    };
    const close = () => {
        if (typeof dialog.close === 'function') dialog.close();
    };
    document.getElementById('bus-pelion-map-open')?.addEventListener('click', open);
    /* Thumbnail lives outside <dialog>; must query document, not dialog. */
    document.querySelectorAll('[data-open-pelion-map]').forEach((btn) => {
        btn.addEventListener('click', open);
    });
    dialog.querySelector('.bus-pelion-dialog__close')?.addEventListener('click', close);
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) close();
    });
}

function initBusSchedule() {
    const container = document.getElementById('bus-container'); // legacy single-container pages
    const nextContainer = document.getElementById('bus-next-container');
    const fullContainer = document.getElementById('bus-full-container');
    const lastUpdatedEl = document.getElementById('bus-last-updated');
    const retryBtn = document.getElementById('bus-retry');
    const dirSelect = document.getElementById('bus-dir-select');
    const dirBtns = Array.from(document.querySelectorAll('[data-bus-dir]'));
    const viewMode = document.body && document.body.getAttribute('data-bus-view') ? document.body.getAttribute('data-bus-view') : 'compact'; // 'compact' | 'full'
    const dayStripEl = document.getElementById('bus-day-strip');
    const headingDayEl = document.getElementById('bus-heading-day');
    const fullTitleEl = document.getElementById('bus-full-title');
    const nextTitleEl = document.getElementById('bus-next-section-title');
    const stripHintEl = document.getElementById('bus-day-strip-hint');
    busInitPelionMapDialog();

    // Only run on pages that include the section
    const isCombinedBusPage = !!(nextContainer || fullContainer);
    if (!container && !isCombinedBusPage) return;

    const fullOriginNoteEl = document.getElementById('bus-full-origin-note');
    if (fullOriginNoteEl) {
        fullOriginNoteEl.textContent = busFullTimetableOriginNoteText();
    }

    let activeDir = (localStorage.getItem('kalanera_bus_dir') || BUS_DEFAULT_DIR);
    if (!BUS_VALID_DIRS.includes(activeDir)) activeDir = BUS_DEFAULT_DIR;

    let activeDayOffset = 0;
    if (dayStripEl) {
        const s = parseInt(localStorage.getItem(BUS_DAY_OFFSET_STORAGE_KEY) || '0', 10);
        activeDayOffset = busClampDayOffset(s);
    }

    const syncDayStripActive = () => {
        if (!dayStripEl) return;
        dayStripEl.querySelectorAll('[data-bus-day-offset]').forEach((btn) => {
            const v = busClampDayOffset(btn.getAttribute('data-bus-day-offset'));
            const on = v === activeDayOffset;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    };

    const mountDayStrip = () => {
        if (!dayStripEl || dayStripEl.dataset.mounted === '1') return;
        dayStripEl.dataset.mounted = '1';
        dayStripEl.setAttribute('role', 'tablist');
        dayStripEl.setAttribute('aria-label', busText('bus_day_strip_aria', {
            en: 'Choose day (seven days from today, Pelion local time)',
            nl: 'Kies dag (7 dagen vanaf vandaag, lokale tijd)',
            el: busT('bus_day_strip_aria', 'Επιλογή ημέρας (Αθήνα, έως 7 ημέρες)'),
        }));
        const frag = document.createDocumentFragment();
        for (let off = 0; off <= BUS_DAY_OFFSET_MAX; off++) {
            const { weekday, dayMonthCompact } = busAthensTargetLabels(off);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'bus-day-btn';
            btn.setAttribute('role', 'tab');
            btn.setAttribute('data-bus-day-offset', String(off));
            const d1 = document.createElement('span');
            d1.className = 'bus-day-btn__dow';
            d1.textContent = weekday;
            const d2 = document.createElement('span');
            d2.className = 'bus-day-btn__dm';
            d2.textContent = dayMonthCompact;
            btn.appendChild(d1);
            btn.appendChild(d2);
            frag.appendChild(btn);
        }
        dayStripEl.appendChild(frag);
        dayStripEl.addEventListener('click', (e) => {
            const btn = e.target && e.target.closest ? e.target.closest('[data-bus-day-offset]') : null;
            if (!btn) return;
            const v = busClampDayOffset(btn.getAttribute('data-bus-day-offset'));
            if (v === activeDayOffset) return;
            activeDayOffset = v;
            try {
                localStorage.setItem(BUS_DAY_OFFSET_STORAGE_KEY, String(activeDayOffset));
            } catch (err) { /* ignore */ }
            syncDayStripActive();
            updateDayChrome();
            load({ force: false });
        });
    };

    mountDayStrip();
    if (stripHintEl) {
        stripHintEl.textContent = busText('bus_day_strip_hint', {
            en: 'Next 7 days (local time · Pelion)',
            nl: 'Komende 7 dagen (lokale tijd)',
            el: busT('bus_day_strip_hint', 'Επόμενες 7 ημέρες (τοπική ώρα Πηλίου)'),
        });
    }

    const updateDayChrome = () => {
        if (headingDayEl) headingDayEl.textContent = busHeadingPrimaryLine(activeDayOffset);
        if (fullTitleEl) fullTitleEl.textContent = busFullTimetableTitle(activeDayOffset);
        if (nextTitleEl) {
            const icon = '<i class="fa-solid fa-bus bus-subsection-icon" aria-hidden="true"></i> ';
            const plain = activeDayOffset === 0
                ? busText('bus_next_heading', {
                    en: 'Next bus',
                    nl: 'Volgende bus',
                    el: busT('bus_next_heading', 'Επόμενο λεωφορείο'),
                })
                : busText('bus_first_departure_title', {
                    en: 'First departure',
                    nl: 'Eerste vertrek',
                    el: busT('bus_first_departure_title', 'Πρώτο δρομολόγιο'),
                });
            nextTitleEl.innerHTML = icon + busEscapeHtml(plain);
        }
        syncDayStripActive();
    };

    const setActiveDirUi = (dir) => {
        busUpdateRouteSubtitle(dir);
        if (dirSelect && dirSelect.value !== dir) dirSelect.value = dir;
        dirBtns.forEach(btn => {
            const isActive = btn.getAttribute('data-bus-dir') === dir;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    };

    const renderFromNormalized = (normalized, savedAtIso) => {
        const forDir = busApplyConsolidatedList(normalized, activeDir);
        const merged = busMergeTripsByTripId(forDir, activeDir);
        const off = busClampDayOffset(activeDayOffset);
        if (isCombinedBusPage) {
            const sortedAll = busSortByDeparture([...merged]);
            const upcoming = (off === 0)
                ? busSortByDeparture(busFilterRemainingToday([...merged], 10))
                : sortedAll;
            if (nextContainer) {
                busRenderList(nextContainer, upcoming, { limit: 1, routeDir: activeDir, dayOffset: off });
            }
            if (fullContainer) {
                busRenderFullTimetable(fullContainer, sortedAll, { routeDir: activeDir, dayOffset: off });
            }
        } else {
            const filtered = (viewMode === 'full')
                ? merged
                : (off === 0 ? busFilterRemainingToday(merged, 10) : merged);
            busRenderList(container, busSortByDeparture(filtered), {
                limit: viewMode === 'full' ? 500 : 8,
                routeDir: activeDir,
                dayOffset: off,
            });
        }
        if (lastUpdatedEl && savedAtIso) lastUpdatedEl.textContent = busFormatLastUpdated(savedAtIso);
        updateDayChrome();
    };

    const renderFromCacheIfAny = () => {
        const slot = busReadCacheSlot(activeDir, activeDayOffset);
        if (!slot || !Array.isArray(slot.items)) return false;
        const normalized = slot.items.map(busNormalizeItem);
        renderFromNormalized(normalized, slot.savedAt);
        return true;
    };

    const load = async ({ force } = {}) => {
        if (retryBtn) retryBtn.hidden = true;
        setActiveDirUi(activeDir);

        const slot = busReadCacheSlot(activeDir, activeDayOffset);
        const canUseCache = slot && busCacheFresh(slot.savedAt) && Array.isArray(slot.items);

        if (!force && canUseCache) {
            renderFromCacheIfAny();
            void busPrefetchMissingDirs();
            return;
        }

        if (!navigator.onLine) {
            // Offline: show cache if possible, else error.
            if (!renderFromCacheIfAny()) {
                if (isCombinedBusPage) {
                    if (nextContainer) busRenderError(nextContainer, retryBtn);
                    if (fullContainer) busRenderError(fullContainer, retryBtn);
                } else {
                    busRenderError(container, retryBtn);
                }
            }
            return;
        }

        if (isCombinedBusPage) {
            if (nextContainer) busRenderSkeleton(nextContainer);
            if (fullContainer) busRenderSkeleton(fullContainer);
        } else {
            busRenderSkeleton(container);
        }
        try {
            const data = await busFetchSchedule(activeDir, activeDayOffset);
            const list = Array.isArray(data) ? data : (data && data.items ? data.items : []);
            busWriteCacheSlot(activeDir, activeDayOffset, list);

            const normalized = list.map(busNormalizeItem);
            renderFromNormalized(normalized, new Date().toISOString());
            void busPrefetchMissingDirs();
        } catch (e) {
            // Fall back to cache if present
            if (!renderFromCacheIfAny()) {
                if (isCombinedBusPage) {
                    if (nextContainer) busRenderError(nextContainer, retryBtn);
                    if (fullContainer) busRenderError(fullContainer, retryBtn);
                } else {
                    busRenderError(container, retryBtn);
                }
            }
        }
    };

    if (dirSelect) {
        dirSelect.addEventListener('change', () => {
            const dir = dirSelect.value;
            if (!dir || !BUS_VALID_DIRS.includes(dir) || dir === activeDir) return;
            activeDir = dir;
            localStorage.setItem('kalanera_bus_dir', activeDir);
            load({ force: false });
        });
    }
    dirBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const dir = btn.getAttribute('data-bus-dir');
            if (!dir || !BUS_VALID_DIRS.includes(dir) || dir === activeDir) return;
            activeDir = dir;
            localStorage.setItem('kalanera_bus_dir', activeDir);
            load({ force: false });
        });
    });

    if (retryBtn) retryBtn.addEventListener('click', () => load({ force: true }));

    window.addEventListener('online', () => {
        void busPrefetchMissingDirs();
    });

    updateDayChrome();
    // Initial
    load({ force: false });
}

function initMoreTab() {
    const moreBtn = document.querySelector('.bottom-nav a[data-more]');
    if (!moreBtn) return;

    moreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openMoreSheet();
    });
}

function openMoreSheet() {
    // Only relevant on mobile where bottom nav is shown
    if (window.innerWidth >= 992) return;

    let backdrop = document.getElementById('more-sheet-backdrop');
    let sheet = document.getElementById('more-sheet');

    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'more-sheet-backdrop';
        backdrop.className = 'more-sheet-backdrop';
        backdrop.hidden = true;
        document.body.appendChild(backdrop);
    }

    if (!sheet) {
        sheet = document.createElement('section');
        sheet.id = 'more-sheet';
        sheet.className = 'more-sheet';
        sheet.hidden = true;
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');

        const isEl = (document.documentElement.lang || 'en') === 'el';
        const title = isEl ? 'Περισσότερα' : 'More';

        sheet.innerHTML = `
            <div class="more-sheet-handle" aria-hidden="true"></div>
            <header class="more-sheet-header">
                <div class="more-sheet-title"><i class="fa-solid fa-ellipsis"></i> ${title}</div>
                <button type="button" class="more-sheet-close" id="more-sheet-close" aria-label="Close">✕</button>
            </header>
            <div class="more-sheet-content" id="more-sheet-content"></div>
        `;
        document.body.appendChild(sheet);
    }

    renderMoreSheetContent();

    backdrop.hidden = false;
    sheet.hidden = false;
    document.body.classList.add('sheet-open');

    const close = () => closeMoreSheet();
    backdrop.onclick = close;
    const closeBtn = document.getElementById('more-sheet-close');
    if (closeBtn) closeBtn.onclick = close;

    // ESC to close
    const onKey = (e) => {
        if (e.key === 'Escape') closeMoreSheet();
    };
    document.addEventListener('keydown', onKey, { once: true });
}

function closeMoreSheet() {
    const backdrop = document.getElementById('more-sheet-backdrop');
    const sheet = document.getElementById('more-sheet');
    if (backdrop) backdrop.hidden = true;
    if (sheet) sheet.hidden = true;
    document.body.classList.remove('sheet-open');
}

function renderMoreSheetContent() {
    const container = document.getElementById('more-sheet-content');
    if (!container) return;

    const isEl = (document.documentElement.lang || 'en') === 'el';
    const brandName = isEl ? 'ΚάντεΚλικ' : 'KanteKlik';
    const labels = {
        bus: isEl ? 'Λεωφορείο (Καλά Νερά)' : 'Bus (Kala Nera)',
        useful: isEl ? 'Χρήσιμα τηλέφωνα' : 'Useful numbers',
        install: isEl ? 'Εγκατάσταση εφαρμογής' : 'Install App',
        about: isEl ? 'Σχετικά με εμάς' : 'About us',
        follow: isEl ? 'Ακολουθήστε μας' : 'Follow us',
        contact: isEl ? 'Επικοινωνία' : 'Contact',
        privacy: isEl ? 'Πολιτική απορρήτου' : 'Privacy policy',
        developer: isEl ? 'Με την υποστήριξη' : 'Powered by'
    };

    const aboutText = getFooterAboutText() || (isEl
        ? 'Βοηθάμε τους ταξιδιώτες να ανακαλύψουν τα καλύτερα μέρη στην περιοχή.'
        : 'We help travelers discover the best places in the area.'
    );

    const fb = getFooterFacebookLink();
    const fbHref = (fb && fb.href) ? fb.href : 'https://www.facebook.com/kalanera.info';
    const fbLabel = (fb && fb.label) ? fb.label : labels.follow;

    const year = new Date().getFullYear();
    const footerCopyright = getFooterCopyrightText();
    const copyrightFallback = isEl
        ? `${year} Κατάλογος Επιχειρήσεων Καλά Νερά. E-Project όλα τα δικαιώματα διατηρούνται.`
        : `${year} Kala Nera Business Directory. E-Project all rights reserved.`;
    const copyrightRaw = (footerCopyright && footerCopyright.trim()) ? footerCopyright.trim() : copyrightFallback;

    const version = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '';
    const busHref = isEl ? 'bus-el.html' : 'bus.html';
    const privacyHref = isEl ? 'privacy-el.html' : 'privacy.html';

    const formattedCopyright = (() => {
        // Avoid double copyright symbol (some pages already include "©")
        const withoutLeading = copyrightRaw.replace(/^\s*©+\s*/g, '').trim();
        const escaped = escapeHtml(withoutLeading);
        return escaped.replace(/\sE-Project\b/g, '<br>E-Project');
    })();

    container.innerHTML = `
        <section class="more-section">
            <h3>${labels.bus}</h3>
            <div class="more-links">
                <a href="${busHref}">
                    <span class="more-link-leading"><i class="fa-solid fa-bus"></i><span class="more-link-label">${labels.bus}</span></span>
                    <small>${isEl ? 'ΣΗΜΕΡΑ' : 'TODAY'}</small>
                </a>
            </div>
        </section>

        <section class="more-section">
            <h3>${labels.useful}</h3>
            <div class="more-links">
                <a href="tel:+302423086222"><span class="more-link-leading"><i class="fa-solid fa-shield"></i><span class="more-link-label">${isEl ? 'Αστυνομία Μηλιές' : 'Police Office Milies'}</span></span><small>+30 24230 86222</small></a>
                <a href="tel:+302423022385"><span class="more-link-leading"><i class="fa-solid fa-pills"></i><span class="more-link-label">${isEl ? 'Φαρμακείο Καλά Νερά' : 'Pharmacy Kala Nera'}</span></span><small>+30 24230 22385</small></a>
                <a href="tel:+302423022160"><span class="more-link-leading"><i class="fa-solid fa-pills"></i><span class="more-link-label">${isEl ? 'Φαρμακείο Κάτω Γατζέα' : 'Pharmacy Kato Gatzea'}</span></span><small>+30 24230 22160</small></a>
                <a href="tel:+302423086666"><span class="more-link-leading"><i class="fa-solid fa-user-doctor"></i><span class="more-link-label">${isEl ? 'Ιατρός Καλά Νερά' : 'Doctor Kala Nera'}</span></span><small>+30 24230 86666</small></a>
            </div>
        </section>

        <section class="more-section">
            <h3>${labels.install}</h3>
            <div class="more-links">
                <button type="button" onclick="if(typeof triggerManualInstall === 'function'){ triggerManualInstall(event); }">
                    <span class="more-link-leading"><i class="fa fa-download"></i><span class="more-link-label">${isEl ? 'Εγκατάσταση' : 'Install'}</span></span>
                    <small>${isEl ? 'PWA' : 'PWA'}</small>
                </button>
            </div>
        </section>

        <section class="more-section more-about">
            <h3>${labels.about}</h3>
            <p>${escapeHtml(aboutText)}</p>
            <div class="more-links" style="margin-top:10px;">
                <a href="${fbHref}" target="_blank" rel="noopener">
                    <span class="more-link-leading"><i class="fab fa-facebook-f"></i><span class="more-link-label">${fbLabel}</span></span>
                    <small>Facebook</small>
                </a>
                <a href="mailto:info@spiti.tech?">
                    <span class="more-link-leading"><i class="fa-solid fa-envelope"></i><span class="more-link-label">${labels.contact}</span></span>
                    <small>info@spiti.tech</small>
                </a>
                <a href="${privacyHref}">
                    <span class="more-link-leading"><i class="fa-solid fa-user-shield"></i><span class="more-link-label">${labels.privacy}</span></span>
                    <small>kalanera.gr</small>
                </a>
            </div>
            <div class="more-links" style="margin-top:10px;">
                <div class="more-card is-meta">
                    <div class="meta-row">
                        <span class="more-link-label">${labels.developer}: ${brandName}</span>
                        <div class="meta-right" aria-label="Version and developer logo">
                            <div class="meta-version"><code>v${version}</code></div>
                        </div>
                    </div>
                    ${formattedCopyright ? `<div class="copyright-row"><span class="copyright-text">© ${formattedCopyright}</span><img class="meta-logo" src="logo-72x72.png" alt="Kalanera InPhoto" width="28" height="28" loading="lazy"></div>` : ``}
                </div>
            </div>
        </section>
    `;
}

function getFooterAboutText() {
    const footer = document.querySelector('footer.site-footer');
    if (!footer) return '';
    const col = footer.querySelector('.footer-container .footer-lead') || footer.querySelector('.footer-container .footer-column p');
    return col && col.textContent ? col.textContent.trim() : '';
}

function getFooterCopyrightText() {
    const footer = document.querySelector('footer.site-footer');
    if (!footer) return '';
    const p = footer.querySelector('.footer-bottom p');
    return p && p.textContent ? p.textContent.trim() : '';
}

function getFooterFacebookLink() {
    const footer = document.querySelector('footer.site-footer');
    if (!footer) return null;
    const link = footer.querySelector('.social-icons a[href*="facebook.com"]');
    if (!link) return null;
    const socialCol = link.closest('.footer-column');
    const heading = socialCol && socialCol.querySelector('h3');
    return {
        href: link.getAttribute('href'),
        label: heading ? heading.textContent.trim() : ''
    };
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}



async function updateWeather() {
    const tempEl = document.getElementById('weather-temp');
    const iconEl = document.getElementById('weather-icon');
    if (!tempEl) return;

    try {
        // Coördinaten van Kala Nera
        const lat = 39.30;
        const lon = 23.12;
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        
        const temp = Math.round(data.current_weather.temperature);
        const code = data.current_weather.weathercode;

        // Simpele icoon mapping
        let icon = '☀️';
        if (code > 0) icon = '🌤️';
        if (code > 3) icon = '☁️';
        if (code > 60) icon = '🌧️';

        tempEl.innerText = `${temp}°C`;
        iconEl.innerText = icon;
    } catch (e) {
        console.warn("Weer kon niet worden geladen");
        tempEl.style.display = 'none';
    }
}


// --- WISHLIST LOGICA ---

function renderWishlist() {
    const container = document.getElementById('business-list');
    const emptyMsg = document.getElementById('empty-wishlist');
    const clearBtn = document.getElementById('clear-wishlist'); // Pak de knop uit de hero op

    // 1. Haal de namen van je favorieten op uit de browser-opslag
    const saved = localStorage.getItem('kalanera_wishlist');
    const wishlistNames = saved ? JSON.parse(saved) : [];

    // 2. Filter de grote lijst (allBusinesses) op alleen deze namen
    const favoriteBusinesses = allBusinesses.filter(biz => wishlistNames.includes(biz.Name));

    // --- NIEUW: Beheer de "Clear Wishlist" knop ---
    if (clearBtn) {
        // Toon de knop alleen als er echt favorieten zijn
        clearBtn.style.display = favoriteBusinesses.length > 0 ? 'inline-block' : 'none';

        // Voeg de klik-actie toe
        clearBtn.onclick = (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to clear your entire wishlist?")) {
                localStorage.setItem('kalanera_wishlist', JSON.stringify([]));
                // We roepen de functie opnieuw aan om de UI direct te updaten
                renderWishlist();
                // Vergeet niet het hartje in de menubalk ook te updaten
                if (typeof updateWishlistCount === "function") updateWishlistCount();
            }
        };
    }
    // ----------------------------------------------

    // 3. Als de lijst leeg is, toon de "Nog geen favorieten" melding
    if (favoriteBusinesses.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        if (container) container.innerHTML = '';
        return;
    }

    // 4. Als er wel favorieten zijn, verberg de melding en render de kaartjes
    if (emptyMsg) emptyMsg.style.display = 'none';
    
    // We hergebruiken hier je bestaande renderBusinesses functie!
    renderBusinesses(favoriteBusinesses);
}

function updateWishlistCount() {
    const wishlist = getWishlist();
    const count = wishlist.length;
    
    // Check de taal (Engels is standaard, tenzij de pagina op 'el' staat)
    const isEl = (currentLang === 'el');
    const label = isEl ? 'Αγαπημένα' : 'Favorites';
    const targetPage = isEl ? 'wishlist-el.html' : 'wishlist.html';

    // Zoek de link die "wishlist" in de href heeft
    const wishlistLink = document.querySelector('a[href*="wishlist"]');
    
    if (wishlistLink) {
        // Zorg dat de link naar de juiste taal-pagina wijst
        wishlistLink.href = targetPage;

        // Update de tekst en het icoon
        if (count > 0) {
            wishlistLink.innerHTML = `<i class="fa-solid fa-heart menu-heart"></i> ${label} (${count})`;
        } else {
            wishlistLink.innerHTML = `<i class="fa-solid fa-heart menu-heart"></i> ${label}`;
        }
    }
}

/**
 * Beheert het aan/uitzetten van favorieten
 */
function toggleWishlist(name, btn) {
    let saved = localStorage.getItem('kalanera_wishlist');
    let wishlist = saved ? JSON.parse(saved) : [];

    if (wishlist.includes(name)) {
        // Verwijderen uit lijst
        wishlist = wishlist.filter(n => n !== name);
        btn.classList.remove('active');
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'fa-regular fa-heart';
        
        // Als we op de wishlist pagina zijn: haal het kaartje direct weg
        if (document.getElementById('empty-wishlist')) {
            renderWishlist(); 
        }
    } else {
        // Toevoegen aan lijst
        wishlist.push(name);
        btn.classList.add('active');
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-heart';
    }

    localStorage.setItem('kalanera_wishlist', JSON.stringify(wishlist));

    // VOEG DEZE REGEL TOE:
    updateWishlistCount();

    if (document.getElementById('empty-wishlist')) renderWishlist();
}

/**
 * Hulpfunctie om de huidige wishlist op te halen
 */
function getWishlist() {
    try {
        const saved = localStorage.getItem('kalanera_wishlist');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
}

// Zorg dat deze functie wordt aangeroepen in je DOMContentLoaded event listener (die heb je al staan!)

// --- GEOPTIMALISEERDE INSTALLATIE CODE (VERSIE 1.0.8) ---
(function() {
    let deferredPrompt; // We gebruiken nu één universele naam
    const installItem = document.getElementById('menu-install-item');

    // 1. Luister naar het installatie-event
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log("PWA Installatie event opgevangen.");
        e.preventDefault();
        deferredPrompt = e;
        
        // De CSS regelt de weergave, maar we kunnen de class voor de zekerheid toevoegen
        if (installItem) {
            installItem.classList.add('show-install');
        }
    });

    // 2. De functie die wordt aangeroepen door de HTML (onclick)
    window.triggerManualInstall = async function(event) {
        if (event) event.preventDefault();
        
        console.log("Klik op install-knop. Status event:", deferredPrompt);

        if (!deferredPrompt) {
            // Als er geen event is, is de app waarschijnlijk al geïnstalleerd
            alert("The app is already installed or can be added via the browser-settings.");
            return;
        }

        // Toon de prompt
        deferredPrompt.prompt();

        // Wacht op keuze
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Gebruiker koos: ${outcome}`);

        if (outcome === 'accepted') {
            console.log('Installatie geaccepteerd.');
            // We laten de knop staan (jouw wens), of we halen de class weg:
            // if (installItem) installItem.classList.remove('show-install');
        }

        // Reset het event (verplicht door browser)
        deferredPrompt = null;
    };

    // 3. Luister naar de voltooide installatie
    window.addEventListener('appinstalled', () => {
        console.log('PWA succesvol geïnstalleerd.');
        // Optioneel: verberg knop na installatie
        // if (installItem) installItem.classList.remove('show-install');
    });
})();

// --- STAP 3: VERBERG INSTALLATIE-OPTIE IN DE APP ZELF ---
function checkDisplayMode() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                         || window.navigator.standalone 
                         || document.referrer.includes('android-app://');

    if (isStandalone) {
        console.log("App running in standalone mode. Hide installation-button.");
        const installItem = document.getElementById('menu-install-item');
        if (installItem) {
            // We gebruiken !important om de CSS-force die we eerder maakten te overrulen
            installItem.style.setProperty('display', 'none', 'important');
        }
    }
}

// Voer de check uit zodra de pagina geladen is
window.addEventListener('load', checkDisplayMode);

// Luister ook naar de 'appinstalled' event voor directe feedback
window.addEventListener('appinstalled', () => {
    const installItem = document.getElementById('menu-install-item');
    if (installItem) {
        installItem.style.setProperty('display', 'none', 'important');
    }
});

// Trace app versie, OS, Device, Scherm, Referrer, Theme, Install/Update en SOURCE (Web vs App)
(function() {
    if (/privacy(?:-el)?\.html$/i.test(window.location.pathname || '')) {
        return;
    }
    const WEBHOOK_URL = 'https://n8n.vanlaar.cloud/webhook/app-stats';

    function checkStatusAndSend() {
        const savedVersion = localStorage.getItem('app_version');
        const currentVersion = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown';
        
        let eventType = 'app_open';

        if (!savedVersion) {
            eventType = 'installatie';
        } else if (savedVersion !== currentVersion) {
            eventType = 'update';
        }

        sendStats(eventType, currentVersion);
        localStorage.setItem('app_version', currentVersion);
    }
    
    function sendStats(eventType, versionToSend) {
        const cssLink = document.getElementById('main-stylesheet');
        const cssVersion = cssLink && cssLink.href.includes('v=') ? cssLink.href.split('v=')[1] : 'geen-v';

        const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        const source = isPWA ? "App (PWA)" : "Website (Browser)";

        const data = {
            event: eventType,
            source: source,
            version: versionToSend,
            css_version: cssVersion,
            os: /android/i.test(navigator.userAgent) ? "Android" : /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "iOS" : "Desktop",
            device: /Mobi|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop",
            screen: window.innerWidth + 'x' + window.innerHeight,
            referrer: document.referrer || 'direct',
            theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
            datum: new Date().toLocaleString('nl-NL')
        };

        console.log("Stats verzenden:", data);

        fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        })
        .then(async (response) => {
            // Some webhooks respond with empty body or plain text; avoid JSON parse errors
            const text = await response.text();
            try {
                return text ? JSON.parse(text) : {};
            } catch (e) {
                return {};
            }
        })
        .then(res => {
            if (res.greeting) {
                // Wacht 2 seconden extra na de stats-verzending voor de begroeting
                setTimeout(() => {
                    triggerAutoGreeting(res.greeting);
                }, 2000);
            }
        })
        .catch(err => console.error("Stats Fetch error:", err));
    }

    window.addEventListener('load', () => {
        setTimeout(checkStatusAndSend, 1500);
    });
})();

// 1. DIRECT UITVOEREN (Tegen het flitsen van wit licht bij laden)
(function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('wotai-nightmode');
    }
})();


// MELDING ONDERAAN SCHERM 
/**
 * PWA Toast Loader
 * Toont een uitnodiging om de app te installeren zonder de kern-logica te breken.
 */
// --- ÉÉN SCHONE EN WERKENDE TOAST FUNCTIE ---
function showInstallToast() {
    // Install is now integrated in the More menu
    return;

    // 1. Alleen tonen als we NIET in de app zelf zitten
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isPWA) return;

    // 2. Voorkom dubbele toasts
    if (document.querySelector('.install-toast')) return;

    console.log("Toast wordt aangemaakt...");

    const toast = document.createElement('div');
    toast.className = 'install-toast';
    
    // --- VERTALING LOGICA ---
    const message = (currentLang === 'el') 
        ? translations.el.pwa_msg 
        : 'Install the Mobile APP for the best experience.';
    
    const buttonText = (currentLang === 'el') 
        ? translations.el.pwa_btn 
        : 'Install';
    // ------------------------

    toast.innerHTML = `
        <i class="fas fa-mobile-alt"></i>
        <p class="toast-text">${message}</p>
        <a href="#" onclick="if(typeof triggerManualInstall === 'function'){ triggerManualInstall(event); } return false;" class="toast-link">${buttonText}</a>
    `;

    document.body.appendChild(toast);

    // 3. Toon de toast (animatie via CSS class 'show')
    setTimeout(() => toast.classList.add('show'), 100);

    // 4. Verwijder automatisch na 10 seconden
    setTimeout(() => {
        if (toast && document.body.contains(toast)) {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 500);
        }
    }, 10000);
}

// 5. Start de toast pas 4 seconden na het laden van de pagina
// Dit zorgt dat je data eerst rustig kan laden
window.addEventListener('load', () => {
    setTimeout(showInstallToast, 4000);
});



function refreshWebcam() {
    const img = document.getElementById('webcamImage');
    const status = document.getElementById('cam-status');
    if (!img) return;
    
    // Maak een unieke tijdstempel om caching te voorkomen
    const timestamp = new Date().getTime();
    
    // Update de bron van de afbeelding
    img.src = "https://www.meteology.gr/cam/milina/index.php?t=" + timestamp;
    
    // Even een visuele hint dat hij ververst
    if (status) {
        status.style.opacity = "0.5";
        setTimeout(() => { status.style.opacity = "1"; }, 500);
    }
}

// Only enable the webcam refresh on pages that have it
if (document.getElementById('webcamImage')) {
    // Ververs elke 10 seconden (10000 milliseconden)
    setInterval(refreshWebcam, 10000);
    // Start de eerste keer direct bij laden
    window.addEventListener('load', refreshWebcam);
}



function toggleNavEmergency(event) {
    event.preventDefault();
    event.stopPropagation();
    const menu = document.getElementById("navEmergencyMenu");
    menu.classList.toggle("is-open");
}

// Sluit het menu als je ergens anders klikt
window.addEventListener('click', function(e) {
    const menu = document.getElementById("navEmergencyMenu");
    if (menu && !menu.contains(e.target) && !e.target.closest('.sos-trigger')) {
        menu.classList.remove("is-open");
    }
});



/**
 * Sitemap Export Functie
 * Gebruik dit eenmalig om sitemap.xml te genereren
 */
function exportSitemap(businesses) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.kalanera.gr/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.kalanera.gr/wishlist.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;

    businesses.forEach(biz => {
        const slug = biz.Name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        
        xml += `
    <url>
        <loc>https://www.kalanera.gr/business/${slug}.html</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>https://www.kalanera.gr/business/${slug}-el.html</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <priority>0.8</priority>
    </url>`;
    });
    xml += `\n</urlset>`;
    
    console.log("--- START SITEMAP XML ---");
    console.log(xml);
    console.log("--- EINDE SITEMAP XML ---");

    // Start download automatisch
    const blob = new Blob([xml], { type: 'text/xml' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'sitemap.xml';
    link.click();
}