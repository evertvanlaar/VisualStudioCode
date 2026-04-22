/**
 * app.js - De "hersenen" van de Kala Nera Business Directory
 */

const N8N_WEBHOOK_URL = 'https://n8n.vanlaar.cloud/webhook/local-businesses';
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
        'Afissos': 'Αφήσσος',
        // Voeg hier de rest van je categorieën en locaties toe
        'pwa_msg': 'Εγκαταστήστε την εφαρμογή για καλύτερη εμπειρία.',
        'pwa_btn': 'Εγκατάσταση'
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
let activeCategory = 'all';
let activeLocation = 'all';
let deferredPrompt; // Global variabele voor PWA
let listMode = (localStorage.getItem('kalanera_list_mode') || 'categories'); // 'categories' | 'az'

// Icon Map voor categorieën
const iconMap = {
    'Bakery': 'fa-bread-slice', 'Bakker': 'fa-bread-slice', 'Coffee': 'fa-coffee', 'Koffie': 'fa-coffee',
    'Eat': 'fa-utensils', 'Eten': 'fa-utensils', 'Drink': 'fa-glass-cheers', 'Pub': 'fa-beer',
    'Shop': 'fa-shopping-cart', 'Other': 'fa-shopping-bag', 'Supermarket': 'fa-shopping-basket',
    'Sleep': 'fa-bed', 'B&B': 'fa-hotel', 'Camp': 'fa-campground', 'Beauty': 'fa-spa',
    'Kapper': 'fa-cut', 'Sport': 'fa-running', 'Pharmacy': 'fa-pills', 'Garage': 'fa-car'
};

// --- STAP 2: VERSIE-BEHEER (SLECHTS OP 1 PLEK AANPASSEN) ---
const APP_VERSION = '1.0.78'; // <--- Pas VOORTAAN alleen nog maar dit getal aan!
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
    const showData = () => {
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
        if (response.ok) {
            const rawData = await response.json();
            const freshData = rawData.filter(biz => biz.Status === 'Active');
           
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
        console.warn("Offline mode.");
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
    generateCategoryButtons(allBusinesses);
    generateLocationButtons(allBusinesses);
    renderBusinesses(allBusinesses);
    updateFilterBadge();
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

function getIcon(cat) {
    const key = Object.keys(iconMap).find(k => (cat || "").toLowerCase().includes(k.toLowerCase()));
    return `<i class="fa ${key ? iconMap[key] : 'fa-tag'}"></i>`;
}

function getColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

function generateCategoryButtons(data) {
    const container = document.getElementById('filter-buttons');
    if (!container) return;
    const categories = [...new Set(data.map(biz => biz.Category).filter(cat => cat))].sort();
    
    // Vertaal "All"
    let html = `<button class="filter-btn ${activeCategory === 'all' ? 'active' : ''}" data-category="all"><i class="fa fa-th-large"></i> <span>${t('all')}</span></button>`;
    
    categories.forEach(cat => {
        // We tonen t(cat) aan de gebruiker, maar houden cat in data-category
        html += `<button class="filter-btn ${activeCategory === cat ? 'active' : ''}" data-category="${cat}">${getIcon(cat)} <span>${t(cat)}</span></button>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = (e) => {
            const targetBtn = e.target.closest('.filter-btn');
            activeCategory = targetBtn.getAttribute('data-category');
            container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            targetBtn.classList.add('active');
            applyFilters();
        };
    });
}

function generateLocationButtons(data) {
    const container = document.getElementById('location-buttons');
    if (!container) return;
    const locations = [...new Set(data.map(biz => biz.Location).filter(loc => loc))].sort();
    
    // Vertaal "All Locations"
    let html = `<button class="filter-btn ${activeLocation === 'all' ? 'active' : ''}" data-location="all"><i class="fa fa-map-marker-alt"></i> <span>${t('all_locations')}</span></button>`;
    
    locations.forEach(loc => {
        html += `<button class="filter-btn ${activeLocation === loc ? 'active' : ''}" data-location="${loc}"><span>${t(loc)}</span></button>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = (e) => {
            const targetBtn = e.target.closest('.filter-btn');
            activeLocation = targetBtn.getAttribute('data-location');
            container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            targetBtn.classList.add('active');
            applyFilters();
        };
    });
}

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    
    const filtered = allBusinesses.filter(biz => {
        // Check of de zoekterm voorkomt in Naam, de Engelse categorie, OF de Griekse vertaling daarvan
        const matchesSearch = 
            (biz.Name || "").toLowerCase().includes(searchTerm) || 
            (biz.Name_EL || "").toLowerCase().includes(searchTerm) || // VOEG DEZE REGEL TOE
            (biz.Category || "").toLowerCase().includes(searchTerm) ||
            (t(biz.Category).toLowerCase().includes(searchTerm)) || // Zoek in vertaalde categorie
            (t(biz.Location).toLowerCase().includes(searchTerm));   // Zoek in vertaalde locatie

        const matchesCategory = activeCategory === 'all' || biz.Category === activeCategory;
        const matchesLocation = activeLocation === 'all' || biz.Location === activeLocation;
        
        return matchesSearch && matchesCategory && matchesLocation;
    });
    renderBusinesses(filtered);
    updateFilterBadge();
}

function updateFilterBadge() {
    const badge = document.getElementById('filter-badge');
    if (!badge) return;
    const count = (activeCategory !== 'all' ? 1 : 0) + (activeLocation !== 'all' ? 1 : 0);
    badge.textContent = String(count);
    badge.style.display = count > 0 ? 'grid' : 'none';
}

function openFilterSheet() {
    const sheet = document.getElementById('filter-sheet');
    const backdrop = document.getElementById('filter-sheet-backdrop');
    if (!sheet || !backdrop) return;
    sheet.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add('sheet-open');

    // Desktop: position sheet near the filter button
    const openBtn = document.getElementById('open-filters');
    if (openBtn && window.innerWidth >= 992) {
        const rect = openBtn.getBoundingClientRect();
        const margin = 10;
        const sheetWidth = Math.min(520, Math.floor(window.innerWidth * 0.92));
        let left = Math.round(rect.right - sheetWidth);
        left = Math.max(margin, Math.min(left, window.innerWidth - sheetWidth - margin));
        const top = Math.round(rect.bottom + 10);
        sheet.style.setProperty('--sheet-left', `${left}px`);
        sheet.style.setProperty('--sheet-top', `${top}px`);
    }
}

function closeFilterSheet() {
    const sheet = document.getElementById('filter-sheet');
    const backdrop = document.getElementById('filter-sheet-backdrop');
    if (!sheet || !backdrop) return;
    sheet.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove('sheet-open');
}

function resetFilters() {
    activeCategory = 'all';
    activeLocation = 'all';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    // Re-render filter buttons to mark "All" active
    generateCategoryButtons(allBusinesses);
    generateLocationButtons(allBusinesses);
    applyFilters();
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

  // 3. De Grid HTML
grid.innerHTML += `
    <div class="biz-card-mini is-media" id="${bizId}" style="border-left: 4px solid ${catColor}">
        <div class="mini-preview">
            <a class="media-link" href="business/${bizId}${currentLang === 'el' ? '-el' : ''}.html" onclick="gtag('event', 'click_image', {'biz_name': '${safeBizName}'})">
                <img src="${finalImageUrl}" onerror="this.src='pix/nophoto.jpg'" alt="${displayName}">
            </a>
            <div class="media-overlay" aria-hidden="true">
                <div class="media-title">${displayName}</div>
            </div>
            <button class="wishlist-btn ${isFavorite ? 'active' : ''}" onclick="toggleWishlist('${safeBizName}', this)" aria-label="Toggle favorite">
                <i class="${isFavorite ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
        </div>
        <div class="mini-content">
            <div class="mini-row-top">
                <h2 class="biz-name">
                    <a href="business/${bizId}${currentLang === 'el' ? '-el' : ''}.html" style="text-decoration:none; color:inherit;">
                        ${displayName}
                    </a>
                </h2>
                <span class="biz-location">
                    <i class="fa fa-map-marker-alt"></i> ${t(biz.Location) || t('Kala Nera')}
                </span>
            </div>
            
            <div class="mini-actions mini-actions-media" style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px; margin-top: 10px;">
                ${(biz.Phone && biz.Phone.trim() !== "" && biz.Phone !== "-") 
                    ? `<div class="phone-group" style="display: flex; align-items: center; width: 155px; min-width: 155px; background: rgba(0,0,0,0.05); border-radius: 20px; padding: 2px 4px 2px 6px; gap: 6px;">
                            <a href="tel:${biz.Phone}" class="btn-icon phone-btn" style="background:none; box-shadow:none; width:auto; height:auto; padding:0; margin:0;" onclick="gtag('event', 'click_phone', {'biz_name': '${safeBizName}'})">
                                <i class="fa fa-phone" style="color: #4A6C4A; font-size: 0.8rem;"></i>
                            </a>
                            <span class="phone-txt" style="font-size: 0.85rem; color: #3c4043; font-weight: 600; white-space: nowrap; overflow: visible;">${biz.Phone}</span>
                    </div>` 
                    : `<div class="phone-group" style="width: 155px; min-width: 155px; visibility: hidden;"></div>`
                }
                <span class="below-location-chip"><i class="fa fa-map-marker-alt"></i> ${t(biz.Location) || t('Kala Nera')}</span>
                <div class="action-right" style="display: flex; gap: 6px; flex-shrink: 0; justify-content: flex-end;">
                    ${webHtml}
                    ${emailHtml}
                    <a href="${reviewUrl}" target="_blank" rel="noopener" class="btn-icon review-btn" style="width: 28px;" onclick="gtag('event', 'click_reviews', {'biz_name': '${safeBizName}'})">
                        <i class="fa fa-star"></i>
                    </a>
                    <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-icon nav-btn-action" style="width: 28px;" onclick="gtag('event', 'open_maps', {'biz_name': '${safeBizName}'})">
                        <i class="fa fa-location-dot"></i>
                    </a>
                </div>
            </div>
        </div>
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

        Object.keys(grouped).sort().forEach(category => {
            const header = document.createElement('div');
            header.className = 'category-section-header';
            header.innerHTML = `<span>${getIcon(category)} ${t(category)} <small>(${grouped[category].length})</small></span>`;
            container.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'business-grid';
            grouped[category]
                .sort((a, b) => (a.Name || "").localeCompare(b.Name || ""))
                .forEach(biz => renderCardInto(grid, biz, category));
            container.appendChild(grid);
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
    if (!document.getElementById('filter-buttons')) return;

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

    // 2a. Filter sheet open/close
    const openBtn = document.getElementById('open-filters');
    const closeBtn = document.getElementById('close-filters');
    const resetBtn = document.getElementById('reset-filters');
    const backdrop = document.getElementById('filter-sheet-backdrop');
    if (openBtn) openBtn.addEventListener('click', openFilterSheet);
    if (closeBtn) closeBtn.addEventListener('click', closeFilterSheet);
    if (resetBtn) resetBtn.addEventListener('click', () => { resetFilters(); });
    if (backdrop) backdrop.addEventListener('click', closeFilterSheet);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeFilterSheet();
    });

    // 2b. View mode toggle (Categories / A-Z)
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

    // 6. EXTRA: Google Maps Button logica (optioneel, voor analytics of effect)
    const mapFab = document.querySelector('.map-fab');
    if (mapFab) {
        console.log("Map button is ready");
    }
});

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
        useful: isEl ? 'Χρήσιμα τηλέφωνα' : 'Useful numbers',
        install: isEl ? 'Εγκατάσταση εφαρμογής' : 'Install App',
        about: isEl ? 'Σχετικά με εμάς' : 'About us',
        follow: isEl ? 'Ακολουθήστε μας' : 'Follow us',
        contact: isEl ? 'Επικοινωνία' : 'Contact',
        stats: isEl ? 'Στατιστικά' : 'Statistics',
        developer: isEl ? 'Με την υποστήριξη' : 'Powered by'
    };

    const aboutText = getFooterAboutText() || (isEl
        ? 'Βοηθάμε τους ταξιδιώτες να ανακαλύψουν τα καλύτερα μέρη στην περιοχή.'
        : 'We help travelers discover the best places in the area.'
    );

    const fb = getFooterFacebookLink();
    const fbHref = (fb && fb.href) ? fb.href : 'https://www.facebook.com/kalanera.info';
    const fbLabel = (fb && fb.label) ? fb.label : labels.follow;

    const gc = getFooterGoatcounterLink();
    const statsHref = (gc && gc.href) ? gc.href : 'http://www.goatcounter.com';
    const statsLabel = (gc && gc.label) ? gc.label : labels.stats;

    const copyright = getFooterCopyrightText();
    const version = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '';

    const formattedCopyright = (() => {
        if (!copyright) return '';
        // Avoid double copyright symbol (some pages already include "©")
        const withoutLeading = copyright.replace(/^\s*©+\s*/g, '').trim();
        // Render "E-Project..." on the next line for readability
        const escaped = escapeHtml(withoutLeading);
        return escaped.replace(/\sE-Project\b/g, '<br>E-Project');
    })();

    container.innerHTML = `
        <section class="more-section">
            <h3>${labels.useful}</h3>
            <div class="more-links">
                <a href="tel:+302423086222"><span><i class="fa-solid fa-shield"></i> ${isEl ? 'Αστυνομία Μηλιές' : 'Police Office Milies'}</span><small>+30 24230 86222</small></a>
                <a href="tel:+302423022385"><span><i class="fa-solid fa-pills"></i> ${isEl ? 'Φαρμακείο Καλά Νερά' : 'Pharmacy Kala Nera'}</span><small>+30 24230 22385</small></a>
                <a href="tel:+302423022160"><span><i class="fa-solid fa-pills"></i> ${isEl ? 'Φαρμακείο Κάτω Γατζέα' : 'Pharmacy Kato Gatzea'}</span><small>+30 24230 22160</small></a>
                <a href="tel:+302423086666"><span><i class="fa-solid fa-user-doctor"></i> ${isEl ? 'Ιατρός Καλά Νερά' : 'Doctor Kala Nera'}</span><small>+30 24230 86666</small></a>
            </div>
        </section>

        <section class="more-section">
            <h3>${labels.install}</h3>
            <div class="more-links">
                <button type="button" onclick="if(typeof triggerManualInstall === 'function'){ triggerManualInstall(event); }">
                    <span><i class="fa fa-download"></i> ${isEl ? 'Εγκατάσταση' : 'Install'}</span>
                    <small>${isEl ? 'PWA' : 'PWA'}</small>
                </button>
            </div>
        </section>

        <section class="more-section more-about">
            <h3>${labels.about}</h3>
            <p>${escapeHtml(aboutText)}</p>
            <div class="more-links" style="margin-top:10px;">
                <a href="${fbHref}" target="_blank" rel="noopener">
                    <span><i class="fab fa-facebook-f"></i> ${fbLabel}</span>
                    <small>Facebook</small>
                </a>
                <a href="mailto:info@spiti.tech?">
                    <span><i class="fa-solid fa-envelope"></i> ${labels.contact}</span>
                    <small>info@spiti.tech</small>
                </a>
                <a href="${statsHref}" target="_blank" rel="noopener">
                    <span><i class="fa-solid fa-chart-line"></i> ${statsLabel}</span>
                    <small>GoatCounter</small>
                </a>
            </div>
            <div class="more-links" style="margin-top:10px;">
                <div class="more-card is-meta">
                    <div class="meta-row">
                        <span>${labels.developer}: ${brandName}</span>
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
    const col = footer.querySelector('.footer-container .footer-column p');
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
    return {
        href: link.getAttribute('href'),
        label: (footer.querySelector('.footer-column h3') && footer.querySelectorAll('.footer-column h3')[2])
            ? footer.querySelectorAll('.footer-column h3')[2].textContent.trim()
            : ''
    };
}

function getFooterGoatcounterLink() {
    const footer = document.querySelector('footer.site-footer');
    if (!footer) return null;
    const link = footer.querySelector('a[href*="goatcounter"]');
    if (!link) return null;
    return {
        href: link.getAttribute('href'),
        label: link.textContent ? link.textContent.trim() : ''
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
        .then(response => response.json()) // Luister naar n8n antwoord
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
    
    // Maak een unieke tijdstempel om caching te voorkomen
    const timestamp = new Date().getTime();
    
    // Update de bron van de afbeelding
    img.src = "https://www.meteology.gr/cam/milina/index.php?t=" + timestamp;
    
    // Even een visuele hint dat hij ververst
    status.style.opacity = "0.5";
    setTimeout(() => { status.style.opacity = "1"; }, 500);
}

// Ververs elke 10 seconden (10000 milliseconden)
setInterval(refreshWebcam, 10000);

// Start de eerste keer direct bij laden
window.onload = refreshWebcam;



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