/**
 * app.js - De "hersenen" van de Kala Nera Business Directory
 * Bevat: Data fetching, Caching, Filtering en UI Rendering
 */

const N8N_WEBHOOK_URL = 'https://n8n.vanlaar.cloud/webhook/local-businesses';
const STORAGE_KEY = 'kalanera_offline_data';

let allBusinesses = []; 
let activeCategory = 'all';
let activeLocation = 'all';

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

    // 1. Direct de offline cache laden (indien aanwezig)
    const cachedData = localStorage.getItem(STORAGE_KEY);
    if (cachedData) {
        try {
            allBusinesses = JSON.parse(cachedData);
            console.log("Offline cache gevonden en geladen.");
            renderEverything(); 
        } catch (e) {
            console.error("Cache was corrupt, wordt overgeslagen.");
        }
    } else {
        businessList.innerHTML = '<p class="status-msg">Downloading business data for first use...</p>';
    }

    // 2. Proberen de nieuwste data van internet te halen
    try {
        const response = await fetch(N8N_WEBHOOK_URL);
        if (response.ok) {
            const rawData = await response.json();
            const freshData = rawData.filter(biz => biz.Status === 'Active');

            // --- NIEUW: Tijdstip vastleggen ---
            const now = new Date();
            const timeString = now.toLocaleDateString('nl-NL') + ' ' + now.toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit'});
            localStorage.setItem('kalanera_last_sync', timeString);
            // ---------------------------------

            // Opslaan voor offline gebruik
            localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
            allBusinesses = freshData;
            
            console.log("Data succesfully synchronised.");
            renderEverything();
        }
    } catch (error) {
        console.warn("Verbindingsfout: App draait nu volledig op lokale cache.");
        if (!cachedData) {
            businessList.innerHTML = '<p class="status-msg">Offline: Please connect to the internet once to load the directory.</p>';
        }
    }
    
    // Altijd de online/offline status controleren
    updateOnlineStatus();
}

// --- UI RENDERING ---

function renderEverything() {
    generateCategoryButtons(allBusinesses);
    generateLocationButtons(allBusinesses);
    renderBusinesses(allBusinesses);
}

function updateOnlineStatus() {
    const offlineIndicator = document.getElementById('offline-indicator');
    if (!offlineIndicator) return;

    if (navigator.onLine) {
        document.body.classList.remove('is-offline');
        offlineIndicator.style.display = 'none';
    } else {
        document.body.classList.add('is-offline');
        offlineIndicator.style.display = 'block';
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

// --- FILTER COMPONENTEN ---

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
            container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            targetBtn.classList.add('active');
            activeCategory = targetBtn.getAttribute('data-category');
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
            container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            targetBtn.classList.add('active');
            activeLocation = targetBtn.getAttribute('data-location');
            applyFilters();
        };
    });
}

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    
    const filtered = allBusinesses.filter(biz => {
        const matchesSearch = (biz.Name || "").toLowerCase().includes(searchTerm) || 
                              (biz.Category || "").toLowerCase().includes(searchTerm) ||
                              (biz.Location || "").toLowerCase().includes(searchTerm);
        
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

    if (data.length === 0) {
        container.innerHTML = '<p class="status-msg">No businesses found matching your criteria.</p>';
        return;
    }

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
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.Name + ' Kala Nera')}`;
            const emailHtml = biz.Email ? `<a href="mailto:${biz.Email}" class="btn-icon email-btn" title="E-mail"><i class="fa fa-envelope"></i></a>` : '';

            let finalImageUrl = biz.PhotoURL || (rawUrl ? `https://s0.wp.com/mshots/v1/${encodeURIComponent(cleanUrl)}?w=180&h=130` : `https://via.placeholder.com/180x130?text=${encodeURIComponent(biz.Name)}`);

            grid.innerHTML += `
            <div class="biz-card-mini" style="border-left: 4px solid ${catColor}">
                <div class="mini-preview">
                    <a href="${cleanUrl}" target="_blank">
                        <img src="${finalImageUrl}" onerror="this.src='https://via.placeholder.com/180x130?text=No+Photo'">
                    </a>
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
                            <a href="${mapsUrl}" target="_blank" class="btn-icon"><i class="fa fa-location-dot"></i></a>
                        </div>
                    </div>
                </div>
            </div>`;
        });
        container.appendChild(grid);
    });

    // Voeg sync-tijd toe onderaan de lijst
    const lastSync = localStorage.getItem('kalanera_last_sync') || 'Onbekend';
    const syncDiv = document.createElement('div');
    syncDiv.className = 'sync-info';
    syncDiv.innerHTML = `<small style="display:block; text-align:center; margin-top:20px; color:var(--muted); font-size:11px;">
        Last sync with Pelion database: ${lastSync}</small>`;
    container.appendChild(syncDiv);
    
    // Animatie effect
    setTimeout(() => {
        document.querySelectorAll('.biz-card-mini').forEach((card, index) => {
            setTimeout(() => { card.classList.add('show'); }, index * 30);
        });
    }, 50);
}

// --- UTILS ---

function copyToClipboard(text, el) {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text).then(() => {
        const icon = el.querySelector('i');
        icon.className = 'fa fa-check';
        setTimeout(() => { icon.className = 'fa fa-copy'; }, 2000);
    });
}

// --- EVENT LISTENERS ---

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Zoekbalk & Menu ---
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

    // --- 2. PWA Installatie Logica (Android/Chrome) ---
    let deferredPrompt;
    const installBanner = document.getElementById('install-banner');
    const installButton = document.getElementById('custom-install-button');
    const closeBanner = document.getElementById('close-banner');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const bannerClosedAt = localStorage.getItem('install_banner_closed');
        const past24h = !bannerClosedAt || (Date.now() - bannerClosedAt > 24*60*60*1000);
        if (installBanner && past24h) installBanner.style.display = 'block';
    });

    if (installButton) {
        installButton.onclick = async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt = null;
            installBanner.style.display = 'none';
        };
    }

    if (closeBanner) {
        closeBanner.onclick = () => {
            installBanner.style.display = 'none';
            localStorage.setItem('install_banner_closed', Date.now());
        };
    }

    // --- 3. iOS Specifieke Logica (iPhone/iPad) ---
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);

    if (isIos && !isInStandaloneMode()) {
        const iosBanner = document.getElementById('ios-install-instructions');
        const closeIos = document.getElementById('close-ios-banner');
        const iosClosedAt = localStorage.getItem('ios_banner_closed');
        const past24h = !iosClosedAt || (Date.now() - iosClosedAt > 24*60*60*1000);

        if (iosBanner && past24h) iosBanner.style.display = 'block';

        if (closeIos) {
            closeIos.onclick = () => {
                iosBanner.style.display = 'none';
                localStorage.setItem('ios_banner_closed', Date.now());
            };
        }
    }

    // --- 4. Start de app ---
    init();
});