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

    if (cachedData) {
        try {
            allBusinesses = JSON.parse(cachedData);
            renderEverything(); 
        } catch (e) {
            console.error("Cache corrupt.");
        }
    }

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
            renderEverything();
        }
    } catch (error) {
        console.warn("Offline mode.");
    }
    updateOnlineStatus();
}

// --- UI RENDERING & FILTERS ---
function renderEverything() {
    generateCategoryButtons(allBusinesses);
    generateLocationButtons(allBusinesses);
    renderBusinesses(allBusinesses);
}

function updateOnlineStatus() {
    const offlineIndicator = document.getElementById('offline-indicator');
    if (offlineIndicator) {
        offlineIndicator.style.display = navigator.onLine ? 'none' : 'block';
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
window.addEventListener('beforeinstallprompt', (e) => {
    if (window.innerWidth > 767) return; 

    // Check 1: Staat hij al in standalone mode?
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    // Check 2: Hebben we hem al eens succesvol geïnstalleerd via deze browser?
    const isAlreadyFlagged = localStorage.getItem('kalanera_app_installed') === 'true';

    if (isStandalone || isAlreadyFlagged) {
        return; // Toon de knop niet
    }

    e.preventDefault();
    deferredPrompt = e;
    const installItem = document.getElementById('menu-install-item');
    if (installItem) installItem.classList.add('show-install');
});

document.addEventListener('DOMContentLoaded', () => {
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