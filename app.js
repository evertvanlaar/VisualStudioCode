/**
 * app.js - De "hersenen" van de Kala Nera Business Directory
 */

const N8N_WEBHOOK_URL = 'https://n8n.vanlaar.cloud/webhook/local-businesses';
const STORAGE_KEY = 'kalanera_offline_data';

let allBusinesses = []; 
let activeCategory = 'all';
let activeLocation = 'all';
let deferredPrompt; 

const iconMap = {
    'Bakery': 'fa-bread-slice', 'Bakker': 'fa-bread-slice', 'Coffee': 'fa-coffee', 'Koffie': 'fa-coffee',
    'Eat': 'fa-utensils', 'Eten': 'fa-utensils', 'Drink': 'fa-glass-cheers', 'Pub': 'fa-beer',
    'Shop': 'fa-shopping-cart', 'Other': 'fa-shopping-bag', 'Supermarket': 'fa-shopping-basket',
    'Sleep': 'fa-bed', 'B&B': 'fa-hotel', 'Camp': 'fa-campground', 'Beauty': 'fa-spa',
    'Kapper': 'fa-cut', 'Sport': 'fa-running', 'Pharmacy': 'fa-pills', 'Garage': 'fa-car'
};

// --- HELPER FUNCTIES (Eerst definiëren om errors te voorkomen) ---
function getIcon(cat) {
    const key = Object.keys(iconMap).find(k => (cat || "").toLowerCase().includes(k.toLowerCase()));
    return `<i class="fa ${key ? iconMap[key] : 'fa-tag'}"></i>`;
}

function getColor(str) {
    if (!str) return '#4A6C4A';
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

function getWishlist() {
    try {
        const saved = localStorage.getItem('kalanera_wishlist');
        return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
}

// --- INITIALISATIE ---
async function init() {
    const cachedData = localStorage.getItem(STORAGE_KEY);
    const isWishlistPage = document.getElementById('empty-wishlist') !== null;

    const showData = () => {
        if (isWishlistPage) {
            renderWishlist(); 
        } else {
            renderEverything(); 
        }
    };

    // 1. Laad uit Cache (zodat er direct iets staat)
    if (cachedData) {
        try {
            allBusinesses = JSON.parse(cachedData);
            showData(); 
        } catch (e) { console.error("Cache corrupt."); }
    }

    // 2. Haal verse data op
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
            showData(); 
        }
    } catch (error) { 
        console.warn("Fetch mislukt, we blijven in offline mode."); 
    }

    updateOnlineStatus();
    updateWeather();
}

// --- UI RENDERING ---
function renderEverything() {
    generateCategoryButtons(allBusinesses);
    generateLocationButtons(allBusinesses);
    renderBusinesses(allBusinesses);
}

function renderBusinesses(data) {
    const container = document.getElementById('business-list');
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="status-msg">No businesses found.</p>';
        return;
    }

    const wishlist = getWishlist();
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
            const cleanUrl = (biz.Website || '').startsWith('http') ? biz.Website : 'https://' + biz.Website;
            const displayUrl = (biz.Website || '').replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
            const isFavorite = wishlist.includes(biz.Name);
            
            grid.innerHTML += `
            <div class="biz-card-mini" style="border-left: 4px solid ${getColor(category)}">
                <div class="mini-preview">
                    <a href="${cleanUrl}" target="_blank"><img src="${biz.PhotoURL || 'https://via.placeholder.com/180x130?text=No+Photo'}" onerror="this.src='https://via.placeholder.com/180x130?text=No+Photo'"></a>
                    <button class="wishlist-btn ${isFavorite ? 'active' : ''}" onclick="toggleWishlist('${biz.Name.replace(/'/g, "\\'")}', this)">
                        <i class="${isFavorite ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    </button>
                </div>
                <div class="mini-content">
                    <div class="mini-row-top"><h2 class="biz-name">${biz.Name}</h2><span class="biz-location"><i class="fa fa-map-marker-alt"></i> ${biz.Location || 'Kala Nera'}</span></div>
                    <div class="mini-row-sub"><a href="${cleanUrl}" target="_blank" class="mini-web-link"><i class="fa fa-external-link"></i> ${displayUrl || 'Visit Website'}</a></div>
                    <div class="mini-actions">
                        <div class="phone-group"><a href="tel:${biz.Phone}" class="btn-icon"><i class="fa fa-phone"></i></a><span class="phone-txt">${biz.Phone || '-'}</span><button class="copy-btn" onclick="copyToClipboard('${biz.Phone}', this)"><i class="fa fa-copy"></i></button></div>
                        <div class="action-right">
                            ${biz.Email ? `<a href="mailto:${biz.Email}" class="btn-icon"><i class="fa fa-envelope"></i></a>` : ''}
                            <a href="https://www.google.com/search?q=${encodeURIComponent(biz.Name + ' Kala Nera reviews')}" target="_blank" class="btn-icon review-btn"><i class="fa fa-star"></i></a>
                            <a href="${biz.GoogleMapsLink || '#'}" target="_blank" class="btn-icon nav-btn-action"><i class="fa fa-location-dot"></i></a>
                        </div>
                    </div>
                </div>
            </div>`;
        });
        container.appendChild(grid);
    });
}

// --- FILTERS ---
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
    const searchTerm = (document.getElementById('search-input')?.value || "").toLowerCase();
    const filtered = allBusinesses.filter(biz => {
        const matchesSearch = (biz.Name || "").toLowerCase().includes(searchTerm) || (biz.Category || "").toLowerCase().includes(searchTerm);
        const matchesCategory = activeCategory === 'all' || biz.Category === activeCategory;
        const matchesLocation = activeLocation === 'all' || biz.Location === activeLocation;
        return matchesSearch && matchesCategory && matchesLocation;
    });
    renderBusinesses(filtered);
}

// --- WISHLIST ---
function toggleWishlist(name, btn) {
    let wishlist = getWishlist();
    if (wishlist.includes(name)) {
        wishlist = wishlist.filter(n => n !== name);
        btn.classList.remove('active');
        btn.querySelector('i').className = 'fa-regular fa-heart';
    } else {
        wishlist.push(name);
        btn.classList.add('active');
        btn.querySelector('i').className = 'fa-solid fa-heart';
    }
    localStorage.setItem('kalanera_wishlist', JSON.stringify(wishlist));
    if (document.getElementById('empty-wishlist')) renderWishlist(); 
}

function renderWishlist() {
    const container = document.getElementById('business-list');
    const emptyMsg = document.getElementById('empty-wishlist');
    const wishlistNames = getWishlist();
    const favorites = allBusinesses.filter(biz => wishlistNames.includes(biz.Name));

    if (favorites.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        if (container) container.innerHTML = '';
    } else {
        if (emptyMsg) emptyMsg.style.display = 'none';
        renderBusinesses(favorites);
    }
}

// --- EXTRA FEATS ---
function copyToClipboard(text, el) {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text).then(() => {
        const icon = el.querySelector('i');
        icon.className = 'fa fa-check';
        setTimeout(() => { icon.className = 'fa fa-copy'; }, 2000);
    });
}

function updateOnlineStatus() {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) indicator.style.display = navigator.onLine ? 'none' : 'block';
}

async function updateWeather() {
    const tempEl = document.getElementById('weather-temp');
    const iconEl = document.getElementById('weather-icon');
    if (!tempEl) return;
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=39.30&longitude=23.12&current_weather=true`);
        const data = await response.json();
        const code = data.current_weather.weathercode;
        let icon = '☀️';
        if (code > 0) icon = '🌤️';
        if (code > 3) icon = '☁️';
        if (code > 60) icon = '🌧️';
        tempEl.innerText = `${Math.round(data.current_weather.temperature)}°C`;
        iconEl.innerText = icon;
    } catch (e) { tempEl.style.display = 'none'; }
}

// --- MENU LOGICA ---
function initializeMenu() {
    const menu = document.querySelector('#mobile-menu');
    const menuLinks = document.querySelector('#nav-list');
    if (menu && menuLinks) {
        // Gebruik onclick om zeker te weten dat er maar 1 listener is
        menu.onclick = function(e) {
            e.preventDefault();
            menuLinks.classList.toggle('active');
            menu.classList.toggle('is-active');
        };
    }
}

// --- PWA ---
window.addEventListener('beforeinstallprompt', (e) => {
    if (window.innerWidth > 767) return; 
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone || localStorage.getItem('kalanera_app_installed') === 'true') return;
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('menu-install-item')?.classList.add('show-install');
});

// --- EXECUTE ---
document.addEventListener('DOMContentLoaded', () => {
    initializeMenu();
    init();
    document.getElementById('search-input')?.addEventListener('input', applyFilters);
});

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);