/**
 * app.js - De "hersenen" van de Kala Nera Business Directory
 */

const N8N_WEBHOOK_URL = 'https://n8n.vanlaar.cloud/webhook/local-businesses';
const STORAGE_KEY = 'kalanera_offline_data';

let allBusinesses = []; 
let activeCategory = 'all';
let activeLocation = 'all';
let deferredPrompt; // Global variabele voor PWA

// Icon Map voor categorieën
const iconMap = {
    'Bakery': 'fa-bread-slice', 'Bakker': 'fa-bread-slice', 'Coffee': 'fa-coffee', 'Koffie': 'fa-coffee',
    'Eat': 'fa-utensils', 'Eten': 'fa-utensils', 'Drink': 'fa-glass-cheers', 'Pub': 'fa-beer',
    'Shop': 'fa-shopping-cart', 'Other': 'fa-shopping-bag', 'Supermarket': 'fa-shopping-basket',
    'Sleep': 'fa-bed', 'B&B': 'fa-hotel', 'Camp': 'fa-campground', 'Beauty': 'fa-spa',
    'Kapper': 'fa-cut', 'Sport': 'fa-running', 'Pharmacy': 'fa-pills', 'Garage': 'fa-car'
};

// --- INITIALISATIE ---
async function init() {
    const businessList = document.getElementById('business-list');
    const cachedData = localStorage.getItem(STORAGE_KEY);
    
    // --- STAP 1: Check op welke pagina we zijn ---
    const isWishlistPage = document.getElementById('empty-wishlist') !== null;

    // Functie om de juiste weergave te kiezen
    const showData = () => {
        if (isWishlistPage) {
            renderWishlist(); // Toon alleen hartjes
        } else {
            renderEverything(); // Toon alles + filters (Home)
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
            const timeString = now.toLocaleDateString('nl-NL') + ' ' + now.toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit'});
            localStorage.setItem('kalanera_last_sync', timeString);

            localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
            allBusinesses = freshData;
            
            showData(); // Update de pagina met verse data
        }
    } catch (error) {
        console.warn("Offline mode.");
    }

    // --- STAP 4: Overige extra's ---
    updateOnlineStatus();
    updateWeather(); // Zorg dat het weer ook geladen wordt
    updateWishlistCount(); // Voeg dit toe onderaan in init()
}

// --- UI RENDERING & FILTERS ---
function renderEverything() {
    generateCategoryButtons(allBusinesses);
    generateLocationButtons(allBusinesses);
    renderBusinesses(allBusinesses);
}

function updateOnlineStatus() {
    const offlineIndicator = document.getElementById('offline-indicator');
    const mapSection = document.querySelector('.map-section');

    if (navigator.onLine) {
        // ONLINE MODUS
        if (offlineIndicator) {
            offlineIndicator.classList.remove('is-visible');
            // Na de animatie (0.4s) op display none zetten voor de zekerheid
            setTimeout(() => {
                if (navigator.onLine) offlineIndicator.style.display = 'none';
            }, 400);
        }
        if (mapSection) mapSection.style.display = 'block';
    } else {
        // OFFLINE MODUS
        if (offlineIndicator) {
            offlineIndicator.style.display = 'flex'; 
            // Klein tikje wachten zodat de browser de display:flex snapt vóór de animatie
            setTimeout(() => {
                offlineIndicator.classList.add('is-visible');
            }, 10);
        }
        if (mapSection) {
            mapSection.style.display = 'none';
        }
    }
}

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
    let html = `<button class="filter-btn ${activeCategory === 'all' ? 'active' : ''}" data-category="all"><i class="fa fa-th-large"></i> <span>All</span></button>`;
    categories.forEach(cat => {
        html += `<button class="filter-btn ${activeCategory === cat ? 'active' : ''}" data-category="${cat}">${getIcon(cat)} <span>${cat}</span></button>`;
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
    let html = `<button class="filter-btn ${activeLocation === 'all' ? 'active' : ''}" data-location="all"><i class="fa fa-map-marker-alt"></i> <span>All Locations</span></button>`;
    locations.forEach(loc => {
        html += `<button class="filter-btn ${activeLocation === loc ? 'active' : ''}" data-location="${loc}"><span>${loc}</span></button>`;
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
        const matchesSearch = (biz.Name || "").toLowerCase().includes(searchTerm) || 
                              (biz.Category || "").toLowerCase().includes(searchTerm);
        const matchesCategory = activeCategory === 'all' || biz.Category === activeCategory;
        const matchesLocation = activeLocation === 'all' || biz.Location === activeLocation;
        return matchesSearch && matchesCategory && matchesLocation;
    });
    renderBusinesses(filtered);
}

// --- DE HOOFDLIJST RENDEREN ---

function renderBusinesses(data) {
    const container = document.getElementById('business-list');
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="status-msg">No businesses found matching your criteria.</p>';
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

    const grouped = data.reduce((acc, biz) => {
        const cat = biz.Category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(biz);
        return acc;
    }, {});

    Object.keys(grouped).sort().forEach(category => {
        const header = document.createElement('div');
        header.className = 'category-section-header';
        header.innerHTML = `<span>${getIcon(category)} ${category} <small>(${grouped[category].length})</small></span>`;
        container.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'business-grid';
        
        grouped[category].sort((a, b) => (a.Name || "").localeCompare(b.Name || "")).forEach(biz => {
            const rawUrl = biz.Website || '';
            const cleanUrl = rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl;
            const displayUrl = rawUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
            const catColor = getColor(category);
            
            const reviewUrl = `https://www.google.com/search?q=${encodeURIComponent(biz.Name + ' Kala Nera reviews')}`;
            const mapsUrl = biz.GoogleMapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.Name + ' Kala Nera')}`;
            const emailHtml = biz.Email ? `<a href="mailto:${biz.Email}" class="btn-icon email-btn" title="E-mail"><i class="fa fa-envelope"></i></a>` : '';

            const isFavorite = wishlist.includes(biz.Name);
            let finalImageUrl = biz.PhotoURL || (rawUrl ? `https://s0.wp.com/mshots/v1/${encodeURIComponent(cleanUrl)}?w=180&h=130` : `https://via.placeholder.com/180x130?text=${encodeURIComponent(biz.Name)}`);

            grid.innerHTML += `
            <div class="biz-card-mini" style="border-left: 4px solid ${catColor}">
                <div class="mini-preview">
                    <a href="${cleanUrl}" target="_blank">
                        <img src="${finalImageUrl}" onerror="this.src='https://via.placeholder.com/180x130?text=No+Photo'">
                    </a>
                    <button class="wishlist-btn ${isFavorite ? 'active' : ''}" onclick="toggleWishlist('${biz.Name.replace(/'/g, "\\'")}', this)">
                        <i class="${isFavorite ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    </button>
                </div>
                <div class="mini-content">
                    <div class="mini-row-top">
                        <h2 class="biz-name">${biz.Name}</h2>
                        <span class="biz-location"><i class="fa fa-map-marker-alt"></i> ${biz.Location || 'Kala Nera'}</span>
                    </div>
                    <div class="mini-row-sub">
                        <a href="${cleanUrl}" target="_blank" class="mini-web-link">
                            <i class="fa fa-external-link"></i> ${displayUrl || 'Visit Website'}
                        </a>
                    </div>
                    <div class="mini-actions">
                        <div class="phone-group">
                            <a href="tel:${biz.Phone}" class="btn-icon"><i class="fa fa-phone"></i></a>
                            <span class="phone-txt">${biz.Phone || '-'}</span>
                            <button class="copy-btn" onclick="copyToClipboard('${biz.Phone}', this)"><i class="fa fa-copy"></i></button>
                        </div>
                        <div class="action-right">
                            ${emailHtml}
                            <a href="${reviewUrl}" target="_blank" class="btn-icon review-btn"><i class="fa fa-star"></i></a>
                            <a href="${mapsUrl}" target="_blank" class="btn-icon nav-btn-action"><i class="fa fa-location-dot"></i></a>
                        </div>
                    </div>
                </div>
            </div>`;
        });
        container.appendChild(grid);
    });

    // Sync info
    const lastSync = localStorage.getItem('kalanera_last_sync') || 'Onbekend';
    const syncDiv = document.createElement('div');
    syncDiv.className = 'sync-info';
    syncDiv.innerHTML = `<small style="display:block; text-align:center; margin-top:20px; color:var(--muted); font-size:11px;">Last sync: ${lastSync}</small>`;
    container.appendChild(syncDiv);
    
    // Animatie
    setTimeout(() => {
        document.querySelectorAll('.biz-card-mini').forEach((card, index) => {
            setTimeout(() => { card.classList.add('show'); }, index * 30);
        });
    }, 50);
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

// PWA Install Event
window.addEventListener('beforeinstallprompt', async (e) => {
    // VOORKOM ALTIJD de standaard browser banner (zeer belangrijk!)
    e.preventDefault();

    // 1. Check alle condities om de knop te verbergen
    const isDesktop = window.innerWidth > 767;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isFlagged = localStorage.getItem('kalanera_app_installed') === 'true';
    
    let isAlreadyInstalled = false;
    if ('getInstalledRelatedApps' in navigator) {
        const relatedApps = await navigator.getInstalledRelatedApps();
        isAlreadyInstalled = relatedApps.length > 0;
    }

    const installItem = document.getElementById('menu-install-item');

    // 2. Als we op desktop zitten, al geïnstalleerd zijn of het vlaggetje hebben:
    if (isDesktop || isStandalone || isFlagged || isAlreadyInstalled) {
        if (installItem) installItem.classList.remove('show-install');
        return; // We stoppen hier, deferredPrompt blijft leeg
    }

    // 3. Alleen als we écht mobiel zijn en nog niet geïnstalleerd hebben:
    deferredPrompt = e;
    if (installItem) installItem.classList.add('show-install');
});

document.addEventListener('DOMContentLoaded', () => {
// EXTRA: Forceer verbergen als we al in app-modus zitten
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone || localStorage.getItem('kalanera_app_installed') === 'true') {
        const installItem = document.getElementById('menu-install-item');
        if (installItem) installItem.style.display = 'none';
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    const menu = document.querySelector('#mobile-menu');
    const menuLinks = document.querySelector('#nav-list');
    if (menu && menuLinks) {
        menu.addEventListener('click', () => {
            menuLinks.classList.toggle('active');
            menu.classList.toggle('is-active');
        });
    }

    init();
});

// Handmatige Installatie Functie
async function triggerManualInstall(event) {
    if (event) event.preventDefault();
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        // --- NIEUW: Sla op dat de app geïnstalleerd is ---
        localStorage.setItem('kalanera_app_installed', 'true');
        
        const installItem = document.getElementById('menu-install-item');
        if (installItem) installItem.classList.remove('show-install');
    }
    deferredPrompt = null;
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

// Roep de functie aan in je init() of onderaan DOMContentLoaded
updateWeather();

// --- WISHLIST LOGICA ---

function renderWishlist() {
    const container = document.getElementById('business-list');
    const emptyMsg = document.getElementById('empty-wishlist');
    
    // 1. Haal de namen van je favorieten op uit de browser-opslag
    const saved = localStorage.getItem('kalanera_wishlist');
    const wishlistNames = saved ? JSON.parse(saved) : [];

    // 2. Filter de grote lijst (allBusinesses) op alleen deze namen
    const favoriteBusinesses = allBusinesses.filter(biz => wishlistNames.includes(biz.Name));

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

    // --- DIT IS DE NIEUWE REGEL ---
    updateWishlistCount(); 
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

function updateWishlistCount() {
    const badge = document.getElementById('wishlist-count');
    if (!badge) return;

    // Haal de lijst op uit de opslag
    const saved = localStorage.getItem('kalanera_wishlist');
    const wishlist = saved ? JSON.parse(saved) : [];
    
    // Update het getal
    if (wishlist.length > 0) {
        badge.innerText = wishlist.length;
        badge.style.display = 'inline-block'; // Toon bolletje als er items zijn
    } else {
        badge.style.display = 'none'; // Verberg bolletje als lijst leeg is
    }
}