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

    // 1. Laad eerst Cache (Snelheid!)
    if (cachedData) {
        try {
            allBusinesses = JSON.parse(cachedData);
            showData(); 
        } catch (e) {
            console.error("Cache corrupt.");
        }
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
        console.warn("Werkend in offline mode.");
    }

    // 3. Start extra services
    updateOnlineStatus();
    updateWeather();
    updateWishlistCount();
}

// --- UI RENDERING ---
function renderEverything() {
    generateCategoryButtons(allBusinesses);
    generateLocationButtons(allBusinesses);
    renderBusinesses(allBusinesses);
}

function updateOnlineStatus() {
    const offlineIndicator = document.getElementById('offline-indicator');
    const mapSection = document.querySelector('.map-section');

    if (navigator.onLine) {
        if (offlineIndicator) {
            offlineIndicator.classList.remove('is-visible');
            setTimeout(() => {
                if (navigator.onLine) offlineIndicator.style.display = 'none';
            }, 400);
        }
        if (mapSection) mapSection.style.display = 'block';
    } else {
        if (offlineIndicator) {
            offlineIndicator.style.display = 'flex'; 
            setTimeout(() => {
                offlineIndicator.classList.add('is-visible');
            }, 50);
        }
        if (mapSection) mapSection.style.display = 'none';
    }
}

// --- HELPERS ---
function getIcon(cat) {
    const key = Object.keys(iconMap).find(k => (cat || "").toLowerCase().includes(k.toLowerCase()));
    return `<i class="fa ${key ? iconMap[key] : 'fa-tag'}"></i>`;
}

function getColor(str) {
    let hash = 0;
    if (!str) return 'hsl(0, 0%, 50%)';
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

function renderBusinesses(data) {
    const container = document.getElementById('business-list');
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="status-msg">No businesses found matching your criteria.</p>';
        return;
    }

    let wishlist = getWishlist();

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
            let finalImageUrl = biz.PhotoURL || (rawUrl